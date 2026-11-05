/**
 * Admin Login API — Custom authentication (replaces Supabase Auth).
 * Verifies credentials against environment variables and sets a session cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminCredentials,
  createSessionToken,
  sessionCookieOptions,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginRateLimit,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    // Rate limit check
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Verify credentials
    const user = await verifyAdminCredentials(email, password);

    if (!user) {
      recordFailedLogin(ip);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Successful login — clear rate limit and set session
    clearLoginRateLimit(ip);

    const token = createSessionToken(user);
    const res = NextResponse.json({
      user,
      session: { access_token: token },
    });
    res.cookies.set('patel_session', token, sessionCookieOptions());
    // Clear legacy cookie if present
    res.cookies.set('hr_auth', '', { path: '/', maxAge: 0 });

    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}