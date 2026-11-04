import { listDishImageFiles, type DishImageFile } from '@/lib/image-storage';
import { listSupabaseMediaFiles } from '@/lib/supabase-media';

export interface UnifiedMediaItem {
  id: string;
  dish_name: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_url: string;
  mime_type: string;
  width: number;
  height: number;
  size_bytes: number;
  category_id: string;
  category_name: string;
  menu_item_id: null;
  status: string;
  uploaded_at: string;
  updated_at: string;
}

function toMediaItem(f: DishImageFile): UnifiedMediaItem {
  return {
    id: `local-${f.category}-${f.filename}`,
    dish_name: f.dish,
    filename: f.filename,
    original_name: f.dish,
    file_path: f.fileUrl,
    file_url: f.fileUrl,
    mime_type: 'image/webp',
    width: 1024,
    height: 1024,
    size_bytes: f.size,
    category_id: f.category,
    category_name: f.categoryName,
    menu_item_id: null,
    status: 'active',
    uploaded_at: f.updatedAt || new Date().toISOString(),
    updated_at: f.updatedAt || new Date().toISOString(),
  };
}

/**
 * Single source of truth for the media list used by both /api/media and the
 * admin dashboard, so the "missing images" count is consistent everywhere.
 */
export async function getUnifiedMediaList(): Promise<UnifiedMediaItem[]> {
  const diskFiles = await listDishImageFiles();
  let items: UnifiedMediaItem[] = diskFiles.map((f) => toMediaItem(f) as UnifiedMediaItem);

  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient();
  if (!supabase) return items;

  const supaMap = await listSupabaseMediaFiles();
  if (supaMap.size === 0) return items;

  // Override disk entries whose Supabase counterpart exists.
  items = items.map((item) => {
    const storagePath = `dishes/${item.category_id}/${item.filename}`;
    const supaUrl = supaMap.get(storagePath);
    if (supaUrl) return { ...item, file_url: supaUrl, file_path: supaUrl };
    return item;
  });

  // Add Supabase-only files (uploaded, no baked-in counterpart).
  const existingUrls = new Set(items.map((i) => i.file_url));
  for (const [storagePath, url] of supaMap.entries()) {
    if (existingUrls.has(url)) continue;
    if (items.some((d) => d.file_url === url)) continue;
    const parts = storagePath.split('/');
    if (parts.length < 3) continue;
    const cat = parts[1];
    const file = parts.slice(2).join('/');
    items.push({
      id: `supabase-${cat}-${file}`,
      dish_name: file.replace(/\.(webp|png|jpe?g)$/i, '').replace(/-/g, ' ').toUpperCase(),
      filename: file,
      original_name: file,
      file_path: url,
      file_url: url,
      mime_type: 'image/webp',
      width: 1024,
      height: 1024,
      size_bytes: 0,
      category_id: cat,
      category_name: cat.replace(/-/g, ' ').toUpperCase(),
      menu_item_id: null,
      status: 'active',
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    existingUrls.add(url);
  }

  return items;
}