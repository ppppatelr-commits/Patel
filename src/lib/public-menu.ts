/**
 * Public menu data loader — GitHub-backed.
 *
 * Reads menu data from the private GitHub content repository via the
 * data-store layer, then converts to the @/types format used by frontend
 * components.
 *
 * Replaces the previous Supabase-based implementation.
 */

import {
  readMenu,
  readCategories,
  readRestaurant,
  type MenuItem as DataStoreItem,
  type MenuCategory as DataStoreCategory,
} from '@/lib/data-store';
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
 * Convert a data-store category to @/types format.
 */
function toCategoryType(c: DataStoreCategory): MenuCategory {
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
 * Convert a data-store item to @/types format.
 */
function toItemType(i: DataStoreItem): MenuItem {
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
 * Reads from GitHub JSON files (data/menu.json, data/categories.json,
 * data/restaurant.json) with a 15-second server-side cache.
 */
export async function getPublicMenu(): Promise<LocalMenuStore> {
  const [menuData, categoriesData, restaurantData] = await Promise.all([
    readMenu(),
    readCategories(),
    readRestaurant(),
  ]);

  const rawCategories = categoriesData?.categories || [];
  const rawItems = menuData?.items || [];
  const restaurant = (restaurantData?.restaurant as {
    name?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    logo?: string;
    createdAt?: string;
    updatedAt?: string;
  }) || {};

  // Normalize category sort orders
  const normalizedCategories = rawCategories
    .slice()
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999))
    .map((cat, index) => ({
      ...cat,
      sortOrder: index + 1,
    }));

  // Build category map for item normalization
  const catById = new Map(normalizedCategories.map((c) => [c.id, c]));

  // Normalize item sort orders within each category
  const itemsByCat = new Map<string, DataStoreItem[]>();
  for (const item of rawItems) {
    if (!itemsByCat.has(item.categoryId)) {
      itemsByCat.set(item.categoryId, []);
    }
    itemsByCat.get(item.categoryId)!.push({ ...item });
  }

  const normalizedItems: DataStoreItem[] = [];
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