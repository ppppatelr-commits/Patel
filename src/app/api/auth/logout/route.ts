/**
 * Admin Logout API — Clears the session cookie.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('patel_session', '', { path: '/', maxAge: 0 });
  res.cookies.set('hr_auth', '', { path: '/', maxAge: 0 });
  return res;
}