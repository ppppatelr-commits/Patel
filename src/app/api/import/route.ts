/**
 * Import API — GitHub-backed.
 * Imports menu data from MENU_DATA (menu-data.ts) into the GitHub content
 * repository JSON files.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  writeMenu,
  writeCategories,
  writeRestaurant,
  MenuItem,
  MenuCategory,
} from '@/lib/data-store';
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
    const body = await request.json();
    const { importEverything = true } = body;

    if (!importEverything) {
      return NextResponse.json({ error: 'Invalid import request' }, { status: 400 });
    }

    const errors: string[] = [];
    let categoriesImported = 0;
    let itemsImported = 0;

    // ── Import restaurant settings ──
    const restaurantData = {
      restaurant: {
        name: MENU_DATA.restaurant.name || 'Patel Restaurant',
        logo: '/patel-logo-gold.png',
        address: MENU_DATA.restaurant.address || '',
        phone: MENU_DATA.restaurant.phone1 || '',
        whatsapp: MENU_DATA.restaurant.phone2 || '',
        openingHours: null,
        contactEmail: null,
        socialLinks: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    try {
      await writeRestaurant(restaurantData);
    } catch (err) {
      errors.push(`Settings: ${(err as Error).message}`);
    }

    // ── Import categories ──
    const categories: MenuCategory[] = MENU_DATA.categories.map((cat, index) => ({
      id: `cat-${slugify(cat.name)}`,
      name: cat.name,
      slug: slugify(cat.name),
      description: null,
      image: null,
      sortOrder: cat.sort_order ?? index + 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    try {
      await writeCategories({ categories });
      categoriesImported = categories.length;
    } catch (err) {
      errors.push(`Categories: ${(err as Error).message}`);
    }

    // ── Import items ──
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));
    const items: MenuItem[] = [];

    const itemsRecord = MENU_DATA.items as unknown as Record<
      string,
      { name: string; price: number; description?: string }[]
    >;

    let globalSortIndex = 0;
    for (const [catName, catItems] of Object.entries(itemsRecord)) {
      const categoryId = categoryMap.get(catName);
      if (!categoryId) {
        errors.push(`No category ID for ${catName}`);
        continue;
      }

      let sortIndex = 0;
      for (const item of catItems) {
        const itemSlug = slugify(item.name);
        items.push({
          id: `item-${categoryMap.get(catName)?.slice(4) || 'x'}--${itemSlug}${sortIndex > 0 ? `--${sortIndex + 1}` : ''}`,
          categoryId,
          name: item.name,
          description: item.description || null,
          price: item.price,
          image: `media/dishes/${slugify(catName)}/${itemSlug}.webp`,
          isAvailable: true,
          sortOrder: sortIndex++,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        globalSortIndex++;
        itemsImported++;
      }
    }

    try {
      await writeMenu({ items });
    } catch (err) {
      errors.push(`Items: ${(err as Error).message}`);
    }

    return NextResponse.json({
      success: true,
      categories: categoriesImported,
      items: itemsImported,
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Import failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}