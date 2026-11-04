import { NextRequest, NextResponse } from 'next/server';
import { getSession, type SessionPayload } from '@/lib/session';
import { createUser, listUsers, type CreateUserInput } from '@/lib/user-store';
import type { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  if (session.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Administrator access required' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;

  try {
    return NextResponse.json(await listUsers());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;

  try {
    const body = await request.json().catch(() => ({}));
    const role: UserRole = body?.role === 'admin' ? 'admin' : 'user';
    const input: CreateUserInput = {
      email: String(body?.email || ''),
      password: String(body?.password || ''),
      name: String(body?.name || ''),
      role,
    };
    const user = await createUser(input);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
