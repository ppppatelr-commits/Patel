import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateUser, verifyCredentials } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

/** Change the password of the currently signed-in account. */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    const valid = await verifyCredentials(session.email, currentPassword);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    await updateUser(session.sub, { password: newPassword });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Failed to change password.' }, { status: 400 });
  }
}
