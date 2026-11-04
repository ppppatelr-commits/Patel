import { createServerSupabaseClient } from '@/lib/supabase-server';
import { MENU_DATA } from '@/lib/menu-data';
import { slugify } from '@/lib/media-paths';

/**
 * Ensures the Supabase database is seeded with the full menu when it is empty
 * or partially seeded. Safe to call on every request — no-ops when both
 * categories and items already exist.
 * Returns true when seeding was performed.
 */
export async function ensureSeeded(): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return false;

  try {
    const { count: catCount } = await supabase
      .from('menu_categories')
      .select('*', { count: 'exact', head: true });

    const { count: itemCount } = await supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true });

    const needCats = !catCount || catCount === 0;
    const needItems = !itemCount || itemCount === 0;

    if (!needCats && !needItems) return false;

    // Settings (idempotent upsert)
    await supabase.from('restaurant_settings').upsert([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: MENU_DATA.restaurant.name,
        phone_1: MENU_DATA.restaurant.phone1,
        phone_2: MENU_DATA.restaurant.phone2,
        tagline: MENU_DATA.restaurant.tagline,
        address: MENU_DATA.restaurant.address,
        developer_name: MENU_DATA.restaurant.developerName,
        developer_phone: MENU_DATA.restaurant.developerPhone,
        developer_credit_locked: true,
      },
    ]);

    let categoryMap = new Map<string, string>();

    if (needCats) {
      const catRows = MENU_DATA.categories.map((c: any) => ({
        name: c.name,
        slug: slugify(c.name),
        sort_order: c.sort_order,
        is_active: true,
      }));
      const { data: insertedCats } = await supabase
        .from('menu_categories')
        .insert(catRows)
        .select('id, name');
      for (const c of insertedCats || []) categoryMap.set(c.name, c.id);
    } else {
      const { data: existingCats } = await supabase
        .from('menu_categories')
        .select('id, name');
      for (const c of existingCats || []) categoryMap.set(c.name, c.id);
    }

    if (needItems) {
      const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number; description?: string }[]>;
      const itemRows: any[] = [];
      for (const [catName, catItems] of Object.entries(itemsRecord)) {
        const categoryId = categoryMap.get(catName);
        if (!categoryId) continue;
        let sortIndex = 0;
        for (const item of catItems) {
          itemRows.push({
            category_id: categoryId,
            name: item.name,
            description: item.description || null,
            price: item.price,
            image_filename: `${slugify(item.name)}.webp`,
            sort_order: sortIndex++,
            is_available: true,
          });
        }
      }

      const BATCH = 50;
      for (let i = 0; i < itemRows.length; i += BATCH) {
        await supabase.from('menu_items').insert(itemRows.slice(i, i + BATCH));
      }
    }

    return true;
  } catch (err) {
    console.error('Auto-seed failed:', err);
    return false;
  }
}