/**
 * Media Bulk Delete API — GitHub-backed.
 * Deletes multiple images from the private GitHub repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteDishImage } from '@/lib/image-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No IDs provided for bulk delete' },
        { status: 400 }
      );
    }

    let deletedCount = 0;

    for (const id of ids) {
      // ID format: local-[category]-[filename]
      if (id.startsWith('local-')) {
        const parts = id.substring(6).split('-');
        // Reconstruct: last part is filename, rest is category
        if (parts.length >= 2) {
          const fileName = parts.pop()!;
          const catSlug = parts.join('-');
          const dishSlug = fileName.replace(/\.(webp|png|jpe?g|gif)$/i, '');
          try {
            await deleteDishImage(catSlug, dishSlug, `Bulk delete: ${dishSlug}`);
            deletedCount++;
          } catch {
            // Continue on error
          }
        }
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      requested: ids.length,
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    return NextResponse.json(
      { error: 'Bulk delete failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}