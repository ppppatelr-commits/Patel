import { NextRequest, NextResponse } from 'next/server';
import { getSession, type SessionPayload } from '@/lib/session';
import { deleteUser, updateUser, type UpdateUserInput } from '@/lib/user-store';
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const input: UpdateUserInput = {};
    if (typeof body?.email === 'string') input.email = body.email;
    if (typeof body?.name === 'string') input.name = body.name;
    if (typeof body?.password === 'string' && body.password !== '') input.password = body.password;
    if (body?.role === 'admin' || body?.role === 'user') input.role = body.role as UserRole;

    const user = await updateUser(id, input);
    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;

  const { id } = await params;

  if (id === gate.session.sub) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  try {
    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
