/**
 * Admin Password Change API — Custom authentication.
 * Changes the password of the currently signed-in admin account.
 * Updates ADMIN_PASSWORD_HASH in environment variables (server-side only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verifyAdminCredentials, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json(
        { error: 'Current and new password are required.' },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    // Verify current password
    const valid = await verifyAdminCredentials(session.email, currentPassword);
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 }
      );
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // In a production deployment, ADMIN_PASSWORD_HASH would be updated via
    // a secure admin configuration mechanism or redeployed env var.
    // Here we record that the hash was generated; the actual env var update
    // requires redeployment or a secure secrets management step.
    // For immediate effect in this serverless context, we store the new hash
    // in a server-side file that auth.ts can check.
    const fs = await import('fs');
    const path = await import('path');
    const hashFilePath = path.join(process.cwd(), 'data', 'admin-password-hash.txt');
    fs.mkdirSync(path.dirname(hashFilePath), { recursive: true });
    fs.writeFileSync(hashFilePath, newHash);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to change password.' },
      { status: 400 }
    );
  }
}