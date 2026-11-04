import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { isCloudAuthEnabled } from '@/lib/user-store';

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
      name: session.name,
      role: session.role,
    },
    isAdmin: session.role === 'admin',
    backend: isCloudAuthEnabled() ? 'supabase' : 'local',
  });
}
