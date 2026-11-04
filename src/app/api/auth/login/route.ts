import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/user-store';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = createSessionToken(user);
    const res = NextResponse.json({
      user,
      session: { access_token: token },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    // Clear the old dev cookie if it is still around.
    res.cookies.set('hr_auth', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
