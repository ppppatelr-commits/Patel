/**
 * Custom admin authentication module.
 * Replaces Supabase Auth completely.
 *
 * - Passwords hashed with bcryptjs (server-side only)
 * - Sessions stored in HttpOnly, Secure cookies
 * - Login rate limiting
 * - Protected session verification
 *
 * This module must only be imported on the server (API routes, Server Components).
 * Never expose bcrypt or session secrets to the browser.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'patel_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// In-memory rate limiter for login attempts (per IP)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 10;

/**
 * Environment configuration for auth.
 * Throws a clear error if secrets are missing in production.
 */
export function validateAuthConfig(): void {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET environment variable must be set to a string of at least 16 characters.'
    );
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminPasswordHash) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD_HASH environment variables must be set. ' +
      'Run the password initialization script to generate a hash.'
    );
  }
}

/**
 * Returns the session secret.
 */
function sessionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not configured properly.');
  }
  return secret;
}

/**
 * Signs data using HMAC-SHA256 (stateless session token).
 */
function sign(data: string): string {
  return crypto
    .createHmac('sha256', sessionSecret())
    .update(data)
    .digest('base64url');
}

/**
 * Session payload shape.
 */
interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  exp: number; // unix seconds
}

/**
 * Creates a signed session token.
 */
export function createSessionToken(user: { id: string; email: string; role: string }): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Verifies and decodes a session token.
 * Returns null if invalid or expired.
 */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = sign(body);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== 'admin' && payload.role !== 'user') return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the current dashboard session from cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Returns cookie options for the session cookie.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
  };
}

/**
 * Rate limiter: checks if an IP is allowed to attempt login.
 * Returns { allowed, remaining }.
 */
export function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 };
  }

  // Reset window if expired
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - record.count };
}

/**
 * Records a failed login attempt for an IP.
 */
export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  record.count += 1;
}

/**
 * Clears rate limit record for an IP (after successful login).
 */
export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Admin credential verification against environment variables.
 * Compares the provided password hash against ADMIN_PASSWORD_HASH.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; role: string } | null> {
  validateAuthConfig();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    return null;
  }

  if (email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }

  // Import bcryptjs dynamically to avoid bundling on client
  let bcrypt: typeof import('bcryptjs');
  try {
    bcrypt = await import('bcryptjs');
  } catch {
    throw new Error('bcryptjs is not installed. Run: npm install bcryptjs');
  }

  const isValid = await bcrypt.compare(password, adminPasswordHash);
  if (!isValid) return null;

  return {
    id: 'admin-1',
    email: adminEmail,
    role: 'admin',
  };
}

/**
 * Generates a bcrypt hash for a plaintext password.
 * Used during initial admin setup.
 */
export async function hashPassword(password: string): Promise<string> {
  let bcrypt: typeof import('bcryptjs');
  try {
    bcrypt = await import('bcryptjs');
  } catch {
    throw new Error('bcryptjs is not installed. Run: npm install bcryptjs');
  }
  return bcrypt.hash(password, 12);
}

export { SESSION_COOKIE };
export type { SessionPayload };