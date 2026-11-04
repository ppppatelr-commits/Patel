import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    revalidatePath('/', 'layout');
    revalidatePath('/menu');
    revalidatePath('/admin');
    revalidatePath('/admin/media');
    revalidatePath('/admin/items');
    revalidatePath('/admin/categories');
    revalidatePath('/admin/settings');
    return NextResponse.json({ success: true, revalidated: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}