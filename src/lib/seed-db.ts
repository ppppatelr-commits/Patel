/**
 * Seed database — GitHub-backed.
 *
 * Ensures the GitHub content repository is seeded with the full menu
 * from MENU_DATA when it is empty or partially seeded.
 *
 * Concurrency safety:
 * - A global seed lock prevents multiple simultaneous seed operations.
 * - Each data file is checked independently before writing.
 * - Existing restaurant data, menu items, categories, and settings are
 *   NEVER overwritten with empty defaults.
 *
 * Returns true when seeding was performed, false if already seeded.
 */

import { MENU_DATA } from '@/lib/menu-data';
import {
  readMenu,
  writeMenu,
  readCategories,
  writeCategories,
  writeRestaurant,
  readRestaurant,
  MenuItem,
  MenuCategory,
} from '@/lib/data-store';
import { slugify } from '@/lib/media-paths';

// Global seed-in-progress lock. Prevents concurrent seed operations
// from racing against each other on every API request.
let seedPromise: Promise<boolean> | null = null;

export async function ensureSeeded(): Promise<boolean> {
  // If a seed is already in progress, await it instead of starting another.
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const [menuData, categoriesData, restaurantData] = await Promise.all([
        readMenu(),
        readCategories(),
        readRestaurant(),
      ]);

      const needCats = !categoriesData || categoriesData.categories.length === 0;
      const needItems = !menuData || menuData.items.length === 0;
      const needRestaurant = !restaurantData;

      // Nothing to seed — return early without any GitHub writes.
      if (!needCats && !needItems && !needRestaurant) return false;

      // ── Seed restaurant settings (only if missing) ──
      if (needRestaurant) {
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
      }

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

          const seen = new Map<string, number>();
          let sortIndex = 0;
          for (const item of catItems) {
            const itemSlug = slugify(item.name);
            const occurrence = (seen.get(itemSlug) || 0) + 1;
            seen.set(itemSlug, occurrence);
            items.push({
              id: `item-${slugify(catName)}--${itemSlug}${occurrence > 1 ? `--${occurrence}` : ''}`,
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
    } finally {
      // Release the seed lock so future requests can seed if needed.
      seedPromise = null;
    }
  })();

  return seedPromise;
}
