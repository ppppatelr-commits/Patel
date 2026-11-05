/**
 * Admin Session Check API — Custom authentication.
 * Returns the current authenticated user from the session cookie.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
      name: session.email.split('@')[0],
      role: session.role,
    },
    isAdmin: session.role === 'admin',
    backend: 'custom',
  });
}