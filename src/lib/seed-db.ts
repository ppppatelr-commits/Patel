/**
 * Seed database — GitHub-backed.
 *
 * Ensures the GitHub content repository is seeded with the full menu
 * from MENU_DATA when it is empty or partially seeded.
 * Safe to call on every request — no-ops when categories and items
 * already exist in GitHub.
 * Returns true when seeding was performed.
 */

import { MENU_DATA } from '@/lib/menu-data';
import {
  readMenu,
  writeMenu,
  readCategories,
  writeCategories,
  writeRestaurant,
  MenuItem,
  MenuCategory,
} from '@/lib/data-store';
import { slugify } from '@/lib/media-paths';

export async function ensureSeeded(): Promise<boolean> {
  try {
    const [menuData, categoriesData] = await Promise.all([
      readMenu(),
      readCategories(),
    ]);

    const needCats = !categoriesData || categoriesData.categories.length === 0;
    const needItems = !menuData || menuData.items.length === 0;

    if (!needCats && !needItems) return false;

    // ── Seed restaurant settings ──
    await writeRestaurant({
      restaurant: {
        name: MENU_DATA.restaurant.name || 'Patel Restaurant',
        logo: '/logo.png',
        address: MENU_DATA.restaurant.address || '',
        phone: MENU_DATA.restaurant.phone1 || '',
        whatsapp: MENU_DATA.restaurant.phone2 || '',
        openingHours: null,
        contactEmail: null,
        socialLinks: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    // ── Seed categories ──
    if (needCats) {
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
      await writeCategories({ categories });
    }

    // ── Seed items ──
    if (needItems) {
      const cats = await readCategories();
      const categoryMap = new Map(cats?.categories.map((c) => [c.name, c.id]));

      const items: MenuItem[] = [];
      const itemsRecord = MENU_DATA.items as unknown as Record<
        string,
        { name: string; price: number; description?: string }[]
      >;

      for (const [catName, catItems] of Object.entries(itemsRecord)) {
        const categoryId = categoryMap.get(catName);
        if (!categoryId) continue;

        let sortIndex = 0;
        for (const item of catItems) {
          const itemSlug = slugify(item.name);
          items.push({
            id: `item-${slugify(catName)}--${itemSlug}${sortIndex > 0 ? `--${sortIndex + 1}` : ''}`,
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
        }
      }

      await writeMenu({ items });
    }

    return true;
  } catch (err) {
    console.error('Auto-seed failed:', err);
    return false;
  }
}