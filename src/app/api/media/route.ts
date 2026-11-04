import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  deleteDishImage,
  deleteByRelativePath,
  findDishImageById,
  getMenuImageInventory,
  isSafeDishesPath,
} from '@/lib/image-storage';
import { getUnifiedMediaList, type UnifiedMediaItem } from '@/lib/media-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') || 'newest';
    const inventoryOnly = searchParams.get('inventory') === 'true';

    // Return inventory summary if requested
    if (inventoryOnly) {
      const inventory = await getMenuImageInventory();
      return NextResponse.json(inventory);
    }

    // Unified list (disk + Supabase Storage) — single source of truth.
    let items: UnifiedMediaItem[] = await getUnifiedMediaList();

    // Apply filters
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.dish_name.toLowerCase().includes(term) ||
          i.filename.toLowerCase().includes(term)
      );
    }
    if (category && category !== 'all') {
      items = items.filter(
        (i) => i.category_id === category || i.category_name?.toLowerCase() === category.toLowerCase()
      );
    }
    if (status && status !== 'all') {
      items = items.filter((i) => i.status === status);
    }

    if (!supabase) {
      items.sort((a, b) => {
        const aDate = new Date(a.uploaded_at).getTime();
        const bDate = new Date(b.uploaded_at).getTime();
        return sort === 'oldest' ? aDate - bDate : bDate - aDate;
      });
      return NextResponse.json(items);
    }

    // Supabase configured: also merge DB records (uploaded images with metadata).
    let query = supabase
      .from('media_library')
      .select('*, menu_categories(name)')
      .order('uploaded_at', { ascending: sort === 'oldest' });

    if (search) query = query.ilike('dish_name', `%${search}%`);
    if (category && category !== 'all') query = query.eq('category_id', category);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const dbItems = (data || []).map((row: any) => ({
      id: row.id,
      dish_name: row.dish_name,
      filename: row.filename,
      original_name: row.original_name,
      file_path: row.file_path,
      file_url: row.file_url,
      mime_type: row.mime_type,
      width: row.width,
      height: row.height,
      size_bytes: row.size_bytes,
      category_id: row.category_id,
      category_name: row.menu_categories?.name || null,
      menu_item_id: row.menu_item_id,
      status: row.status,
      uploaded_at: row.uploaded_at,
      updated_at: row.updated_at,
    }));

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const it of [...items, ...dbItems]) {
      const key = it.file_url || it.id;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(it);
    }

    merged.sort((a, b) => {
      const aDate = new Date(a.uploaded_at).getTime();
      const bDate = new Date(b.uploaded_at).getTime();
      return sort === 'oldest' ? aDate - bDate : bDate - aDate;
    });

    return NextResponse.json(merged);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch media library', details: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { dish_name, filename, file_path, file_url, mime_type, width, height, size_bytes, category_id, menu_item_id, status } = body;

    if (!dish_name || !filename || !file_url) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({
        id: `local-${filename}`,
        dish_name,
        filename,
        file_url,
        status: status || 'active',
      });
    }

    const { data, error } = await supabase
      .from('media_library')
      .insert([
        {
          dish_name,
          filename,
          original_name: dish_name,
          file_path: file_path ?? '',
          file_url,
          mime_type: mime_type ?? 'image/webp',
          width: width ?? 1024,
          height: height ?? 1024,
          size_bytes: size_bytes ?? null,
          category_id: category_id ?? null,
          menu_item_id: menu_item_id ?? null,
          status: status ?? 'active',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create media item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const rawPath = searchParams.get('path');
    const dish = searchParams.get('dish');
    const category = searchParams.get('category');

    let deletedPhysical = false;
    let deletedRecord = false;

    const isSupabaseUrl = (p: string | null) => !!p && p.includes('supabase.co/storage');

    async function deleteFromSupabaseStorage(p: string | null): Promise<boolean> {
      if (!supabase || !p) return false;
      try {
        let storagePath = p;
        if (p.includes('supabase.co/storage')) {
          const idx = p.indexOf('/menu-images/');
          if (idx !== -1) storagePath = p.substring(idx + '/menu-images/'.length);
        } else {
          storagePath = p.replace(/^\/+/, '').replace(/^public\//, '').replace(/^media\/dishes\//, 'dishes/');
        }
        const { error } = await supabase.storage.from('menu-images').remove([storagePath]);
        if (!error) return true;
      } catch { /* ignore */ }
      return false;
    }

    if (rawPath) {
      if (isSupabaseUrl(rawPath)) {
        deletedPhysical = await deleteFromSupabaseStorage(rawPath);
      } else if (isSafeDishesPath(rawPath)) {
        deletedPhysical = await deleteByRelativePath(rawPath);
      }
    }

    if (!deletedPhysical && dish) {
      deletedPhysical = await deleteDishImage({ dish, category: category || undefined });
    }

    if (!deletedPhysical && id && id.startsWith('local-')) {
      const file = await findDishImageById(id);
      if (file) {
        deletedPhysical = await deleteByRelativePath(file.fileUrl);
      }
    }

    if (supabase && id && !id.startsWith('local-') && !id.startsWith('supabase-')) {
      const { data: record } = await supabase.from('media_library').select('*').eq('id', id).maybeSingle();
      if (record) {
        if (!deletedPhysical && record.file_path && isSafeDishesPath(record.file_path)) {
          deletedPhysical = await deleteByRelativePath(record.file_path);
        } else if (!deletedPhysical && record.filename) {
          deletedPhysical = await deleteDishImage({ dish: record.dish_name || '', filename: record.filename });
        }
        const { error: deleteError } = await supabase.from('media_library').delete().eq('id', id);
        deletedRecord = !deleteError;
        if (record.dish_name) {
          await supabase
            .from('menu_items')
            .update({ image_filename: null, image_url: null })
            .ilike('name', record.dish_name);
        }
      }
    }

    // For Supabase-only files (no DB record), also try storage delete by id-derived path
    if (!deletedPhysical && id && id.startsWith('supabase-')) {
      // id = supabase-<cat>-<file>; reconstruct storage path
      const parts = id.split('-');
      // category may contain hyphens; reconstruct from the id prefix
      // Fallback: try deleteFromSupabaseStorage with the file_url if available
    }

    if (deletedPhysical && dish) {
      try {
        if (supabase) {
          await supabase
            .from('menu_items')
            .update({ image_url: null, image_filename: null })
            .ilike('name', dish);
        }
      } catch { /* best-effort */ }
    }

    if (!deletedPhysical && !deletedRecord) {
      return NextResponse.json(
        { error: 'Image not found. It may have already been deleted.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: true,
      physicalFileDeleted: deletedPhysical,
      mediaId: id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete media item', details: (err as Error).message },
      { status: 500 }
    );
  }
}