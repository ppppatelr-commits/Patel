import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { MENU_DATA } from '@/lib/menu-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured on this deployment.' }, { status: 503 });
    }
    const body = await request.json();
    const { importEverything = true } = body;

    if (!importEverything) {
      return NextResponse.json({ error: 'Invalid import request' }, { status: 400 });
    }

    const errors: string[] = [];
    let categoriesImported = 0;
    let itemsImported = 0;

    // Import settings
    const { error: settingsError } = await supabase
      .from('restaurant_settings')
      .upsert([{
        id: '00000000-0000-0000-0000-000000000001',
        name: MENU_DATA.restaurant.name,
        phone_1: MENU_DATA.restaurant.phone1,
        phone_2: MENU_DATA.restaurant.phone2,
        tagline: MENU_DATA.restaurant.tagline,
        address: MENU_DATA.restaurant.address,
        developer_name: MENU_DATA.restaurant.developerName,
        developer_phone: MENU_DATA.restaurant.developerPhone,
        developer_credit_locked: true,
      }]);

    if (settingsError) {
      errors.push(`Settings: ${settingsError.message}`);
    }

    // Import categories in exact PDF order
    const categoryMap = new Map<string, string>();

    // Pre-load any categories that already exist so re-running the import is safe.
    const { data: existingCats } = await supabase.from('menu_categories').select('id, name');
    for (const c of existingCats || []) {
      categoryMap.set(c.name, c.id);
    }

    for (const cat of MENU_DATA.categories) {
      if (categoryMap.has(cat.name)) {
        categoriesImported++;
        continue;
      }
      try {
        const slug = slugify(cat.name);
        const { data, error } = await supabase
          .from('menu_categories')
          .insert([{ name: cat.name, slug, sort_order: cat.sort_order, is_active: true }])
          .select('id')
          .single();

        if (error) {
          errors.push(`Category ${cat.name}: ${error.message}`);
        } else if (data) {
          categoryMap.set(cat.name, data.id);
          categoriesImported++;
        }
      } catch (err) {
        errors.push(`Category ${cat.name}: ${err}`);
      }
    }

    // Pre-load existing items for this run so re-importing is idempotent.
    const { data: existingItems } = await supabase.from('menu_items').select('category_id, name');
    const existingItemKeys = new Set((existingItems || []).map((it: any) => `${it.category_id}::${it.name}`));

    const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number; description?: string }[]>;
    for (const [catName, catItems] of Object.entries(itemsRecord)) {
      const categoryId = categoryMap.get(catName);
      if (!categoryId) {
        errors.push(`No category ID for ${catName}`);
        continue;
      }

      let sortIndex = 0;
      for (const item of catItems) {
        if (existingItemKeys.has(`${categoryId}::${item.name}`)) {
          sortIndex++;
          itemsImported++;
          continue;
        }
        try {
          const filename = slugify(item.name);
          const { error } = await supabase
            .from('menu_items')
            .insert([{
              category_id: categoryId,
              name: item.name,
              description: item.description || null,
              price: item.price,
              image_filename: `${filename}.webp`,
              sort_order: sortIndex++,
              is_available: true,
            }]);

          if (error) {
            errors.push(`Item ${item.name}: ${error.message}`);
          } else {
            itemsImported++;
          }
        } catch (err) {
          errors.push(`Item ${item.name}: ${err}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      categories: categoriesImported,
      items: itemsImported,
      errors,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Import failed', details: err }, { status: 500 });
  }
}
