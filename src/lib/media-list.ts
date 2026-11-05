/**
 * Media list — GitHub-backed (replaces Supabase media_library).
 *
 * Single source of truth for the media list used by both /api/media and the
 * admin dashboard. All images are stored in the private GitHub content
 * repository under media/dishes/[category]/[dish].webp.
 */

import { listDishImageFiles, type DishImageFile } from '@/lib/image-storage';

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
 * Single source of truth for the media list.
 * All images come from the GitHub content repository.
 */
export async function getUnifiedMediaList(): Promise<UnifiedMediaItem[]> {
  const diskFiles = await listDishImageFiles();
  return diskFiles.map((f) => toMediaItem(f) as UnifiedMediaItem);
}