import { NextResponse } from 'next/server';
import { getPublicMenu } from '@/lib/public-menu';
import { ensureSeeded } from '@/lib/seed-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    await ensureSeeded();
    const menu = await getPublicMenu();
    return NextResponse.json(menu);
  } catch (error) {
    console.error('Menu API error:', error);
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 });
  }
}