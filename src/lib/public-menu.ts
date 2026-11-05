/**
 * Public menu data loader — baked-in data.
 *
 * Reads menu data from local JSON files baked into the application at build time.
 * This avoids runtime dependency on the GitHub API for serving customers.
 *
 * Admin changes still commit to the private GitHub content repository (PR-),
 * and can be pulled in on redeploy.
 */

import categoriesData from '@/data/categories.json';
import menuData from '@/data/menu.json';
import restaurantData from '@/data/restaurant.json';
import type {
  MenuCategory,
  MenuItem,
  RestaurantSettings,
} from '@/types';

export interface LocalMenuStore {
  version: number;
  settings: RestaurantSettings;
  categories: MenuCategory[];
  items: MenuItem[];
}

/**
 * Convert a local category to @/types format.
 */
function toCategoryType(c: any): MenuCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    sort_order: c.sortOrder,
    image_url: c.image || null,
    is_active: c.isActive,
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

/**
 * Convert a local item to @/types format.
 */
function toItemType(i: any): MenuItem {
  return {
    id: i.id,
    category_id: i.categoryId,
    name: i.name,
    description: i.description || null,
    price: i.price,
    image_url: i.image || null,
    image_filename: i.image ? i.image.split('/').pop() || null : null,
    sort_order: i.sortOrder,
    is_available: i.isAvailable,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

/**
 * Load the live menu for public pages and the menu API.
 *
 * Data is baked into the application from the local JSON files imported above.
 * These files come from the content repository (PR-) and are updated on redeploy.
 */
export async function getPublicMenu(): Promise<LocalMenuStore> {
  const rawCategories = Array.isArray(categoriesData?.categories)
    ? categoriesData.categories
    : [];
  const rawItems = Array.isArray(menuData?.items)
    ? menuData.items
    : [];
  const restaurant = restaurantData?.restaurant || {};

  // Normalize category sort orders
  const normalizedCategories = rawCategories
    .slice()
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999))
    .map((cat, index) => ({
      ...cat,
      sortOrder: index + 1,
    }));

  // Build category map for item normalization
  const itemsByCat = new Map<string, any[]>();
  for (const item of rawItems) {
    if (!itemsByCat.has(item.categoryId)) {
      itemsByCat.set(item.categoryId, []);
    }
    itemsByCat.get(item.categoryId)!.push({ ...item });
  }

  const normalizedItems: any[] = [];
  for (const catItems of itemsByCat.values()) {
    catItems.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
    catItems.forEach((it, idx) => {
      normalizedItems.push({ ...it, sortOrder: idx + 1 });
    });
  }

  const settings: RestaurantSettings = {
    id: 'restaurant-settings-1',
    name: restaurant.name || 'Patel Restaurant',
    phone_1: restaurant.phone || '',
    phone_2: restaurant.whatsapp || '',
    tagline: '',
    address: restaurant.address || '',
    logo_url: restaurant.logo || '/logo.png',
    developer_name: 'Salman Furniturewala',
    developer_phone: '+91 7303321019',
    developer_credit_locked: true,
    created_at: restaurant.createdAt || new Date().toISOString(),
    updated_at: restaurant.updatedAt || new Date().toISOString(),
  };

  return {
    version: 1,
    settings,
    categories: normalizedCategories.map(toCategoryType),
    items: normalizedItems.map(toItemType),
  };
}