import { createServerSupabaseClient } from '@/lib/supabase-server';
import { readStore } from '@/lib/menu-store';
import { buildSeedStore, type LocalMenuStore } from '@/lib/menu-seed';
import { normalizeCategories, normalizeItems } from '@/lib/sort-utils';

/**
 * Load the live menu for the public pages and the menu API.
 *
 * - Supabase configured: read the cloud tables.
 * - Otherwise: read the local JSON store (seeded from the PDF data).
 */
export async function getPublicMenu(): Promise<LocalMenuStore> {
  const supabase = createServerSupabaseClient();

  if (supabase) {
    try {
      const [settingsResult, categoriesResult, itemsResult] = await Promise.all([
        supabase
          .from('restaurant_settings')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .maybeSingle(),
        supabase.from('menu_categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('menu_items').select('*').order('sort_order', { ascending: true }),
      ]);

      const seed = buildSeedStore();

      const rawCategories =
        categoriesResult.data && categoriesResult.data.length > 0
          ? categoriesResult.data
          : seed.categories;
      const rawItems =
        itemsResult.data && itemsResult.data.length > 0 ? itemsResult.data : seed.items;

      return {
        version: 1,
        settings: settingsResult.data || seed.settings,
        categories: normalizeCategories(rawCategories),
        items: normalizeItems(rawItems),
      };
    } catch (error) {
      console.error('Supabase menu read failed, using local store:', error);
    }
  }

  const store = await readStore();
  return {
    ...store,
    categories: normalizeCategories(store.categories),
    items: normalizeItems(store.items),
  };
}
