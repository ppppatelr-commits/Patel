import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { AppUser, UserRole } from '@/types';

export const SESSION_COOKIE = 'hr_session';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

let warnedAboutSecret = false;

function secret(): string {
  // AUTH_SECRET must be set in production. The fallback keeps local dev working.
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 16) return configured;

  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[auth] AUTH_SECRET is missing or too short. Using an insecure development secret. Set AUTH_SECRET to a long random string in production.'
      );
    }
  }

  return 'patel-local-dev-secret-change-me';
}

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number; // unix seconds
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function createSessionToken(user: AppUser): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== 'admin' && payload.role !== 'user') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Read and verify the current dashboard session from cookies. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
  };
}
