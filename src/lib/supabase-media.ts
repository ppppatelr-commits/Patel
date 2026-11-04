import { createServerSupabaseClient } from '@/lib/supabase-server';
import { listDishImageFiles } from '@/lib/image-storage';

// Re-export toMediaItem for use in route
// (defined in route.ts, not here)

/**
 * Recursively list all files in the menu-images bucket under `dishes/`.
 * Returns a map of storagePath (e.g. "dishes/chicken-starters/chi-crispy.webp")
 * to its public URL.
 */
export async function listSupabaseMediaFiles(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const supabase = createServerSupabaseClient() as any;
  if (!supabase) return map;

  async function walk(prefix: string) {
    try {
      const { data, error } = await supabase.storage.from('menu-images').list(prefix, { limit: 1000 });
      if (error || !data) return;
      for (const entry of data) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const isFile = entry.metadata && typeof entry.metadata.size === 'number';
        if (isFile) {
          const { data: pub } = supabase.storage.from('menu-images').getPublicUrl(fullPath);
          if (pub?.publicUrl) map.set(fullPath, pub.publicUrl);
        } else {
          // It's a folder
          await walk(fullPath);
        }
      }
    } catch {
      // ignore
    }
  }

  await walk('dishes');
  return map;
}