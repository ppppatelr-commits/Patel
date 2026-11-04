import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { deleteByRelativePath, deleteDishImage, findDishImageById, isSafeDishesPath } from '@/lib/image-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided for bulk delete' }, { status: 400 });
    }

    let deletedCount = 0;

    for (const id of ids) {
      let removed = false;

      // Local file ID format: local-<category>-<filename>
      if (id.startsWith('local-')) {
        const file = await findDishImageById(id);
        if (file) {
          removed = await deleteByRelativePath(file.fileUrl);
        }
        if (removed) deletedCount++;
        continue;
      }

      // Supabase record ID
      if (supabase) {
        const { data: record } = await supabase.from('media_library').select('*').eq('id', id).maybeSingle();
        if (record) {
          if (record.file_path && isSafeDishesPath(record.file_path)) {
            await deleteByRelativePath(record.file_path);
          } else if (record.filename) {
            await deleteDishImage({ dish: record.dish_name || '', filename: record.filename });
          }
          await supabase.from('media_library').delete().eq('id', id);
          if (record.dish_name) {
            await supabase
              .from('menu_items')
              .update({ image_filename: null, image_url: null })
              .ilike('name', record.dish_name);
          }
          deletedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      requested: ids.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Bulk delete failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}
