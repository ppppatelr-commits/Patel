import { MENU_DATA } from '@/lib/menu-data';
import type { MenuCategory, MenuItem, RestaurantSettings } from '@/types';

/**
 * The shape of the local menu database (data/menu-store.json).
 *
 * The PDF data in `menu-data.ts` is the seed. Once the admin saves a change,
 * this store becomes the live menu that both the dashboard and the public
 * QR menu read from.
 */
export interface LocalMenuStore {
  version: 1;
  settings: RestaurantSettings;
  categories: MenuCategory[];
  items: MenuItem[];
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function uniqueId(existing: Iterable<string>, base: string): string {
  const used = new Set(existing);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function now(): string {
  return new Date().toISOString();
}

export function buildSeedSettings(): RestaurantSettings {
  return {
    id: 'local-settings-1',
    name: MENU_DATA.restaurant.name,
    phone_1: MENU_DATA.restaurant.phone1,
    phone_2: MENU_DATA.restaurant.phone2,
    tagline: MENU_DATA.restaurant.tagline,
    address: MENU_DATA.restaurant.address,
    logo_url: '/logo.png',
    developer_name: MENU_DATA.restaurant.developerName,
    developer_phone: MENU_DATA.restaurant.developerPhone,
    developer_credit_locked: true,
    created_at: now(),
    updated_at: now(),
  };
}

/**
 * Build the initial store from the PDF-derived MENU_DATA.
 *
 * IDs are deterministic so the admin page and the public menu always refer to
 * the same record. Duplicate dish names inside one category get a `--2`
 * suffix, which keeps both rows editable independently.
 */
export function buildSeedStore(): LocalMenuStore {
  const timestamp = now();

  const categories: MenuCategory[] = (
    MENU_DATA.categories as readonly { name: string; sort_order: number }[]
  ).map((category, index) => ({
    id: `cat-${slugify(category.name)}`,
    name: category.name,
    slug: slugify(category.name),
    sort_order: category.sort_order ?? index + 1,
    image_url: null,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const items: MenuItem[] = [];
  let sortIndex = 0;

  const itemsRecord = MENU_DATA.items as unknown as Record<
    string,
    { name: string; price: number; description?: string }[]
  >;

  for (const [categoryName, dishList] of Object.entries(itemsRecord)) {
    const category = categoryByName.get(categoryName);
    if (!category) continue;

    const seen = new Map<string, number>();
    for (const dish of dishList) {
      const dishSlug = slugify(dish.name);
      const occurrence = (seen.get(dishSlug) || 0) + 1;
      seen.set(dishSlug, occurrence);

      const id = `item-${category.slug}--${dishSlug}${occurrence > 1 ? `--${occurrence}` : ''}`;

      items.push({
        id,
        category_id: category.id,
        name: dish.name,
        description: (dish as any).description || null,
        price: dish.price,
        image_filename: `${dishSlug}.webp`,
        image_url: `/media/dishes/${category.slug}/${dishSlug}.webp`,
        sort_order: sortIndex,
        is_available: true,
        created_at: timestamp,
        updated_at: timestamp,
      });
      sortIndex += 1;
    }
  }

  return {
    version: 1,
    settings: buildSeedSettings(),
    categories,
    items,
  };
}
