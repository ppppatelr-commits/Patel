/**
 * Public menu data loader.
 *
 * Reads menu data from the GitHub content repository (live data).
 * Falls back to baked-in local JSON files if GitHub is unavailable.
 *
 * Admin changes commit to the private GitHub content repository,
 * and are reflected on the public menu immediately.
 */

import categoriesData from '@/data/categories.json';
import menuData from '@/data/menu.json';
import restaurantData from '@/data/restaurant.json';
import {
  readMenu,
  readCategories,
  readRestaurant,
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
 * Convert a GitHub category to @/types format.
 */
function toCategoryType(c: any): MenuCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    sort_order: c.sortOrder ?? c.sort_order ?? 999,
    image_url: c.image ? `/${c.image}` : (c.image_url || null),
    is_active: c.isActive !== false && c.is_active !== false,
    created_at: c.createdAt || c.created_at || new Date().toISOString(),
    updated_at: c.updatedAt || c.updated_at || new Date().toISOString(),
  };
}

/**
 * Convert a GitHub item to @/types format.
 */
function toItemType(i: any): MenuItem {
  return {
    id: i.id,
    category_id: i.categoryId || i.category_id,
    name: i.name,
    description: i.description || null,
    price: i.price,
    image_url: i.image ? `/${i.image}` : (i.image_url || null),
    image_filename: i.image ? i.image.split('/').pop() || null : (i.image_filename || null),
    sort_order: i.sortOrder ?? i.sort_order ?? 0,
    is_available: i.isAvailable !== false && i.is_available !== false,
    created_at: i.createdAt || i.created_at || new Date().toISOString(),
    updated_at: i.updatedAt || i.updated_at || new Date().toISOString(),
  };
}

/**
 * Load the live menu for public pages and the menu API.
 *
 * Tries GitHub first (live data). Falls back to baked-in local JSON
 * files if GitHub is unavailable or returns empty data.
 */
export async function getPublicMenu(): Promise<LocalMenuStore> {
  // Try GitHub first
  try {
    const [ghCategories, ghMenu, ghRestaurant] = await Promise.all([
      readCategories(),
      readMenu(),
      readRestaurant(),
    ]);

    const ghCats = ghCategories?.categories;
    const ghItems = ghMenu?.items;
    const ghRestaurantInfo = ghRestaurant?.restaurant;

    if (Array.isArray(ghCats) && ghCats.length > 0 && Array.isArray(ghItems) && ghItems.length > 0) {
      const restaurant = (ghRestaurantInfo || {}) as any;

      const normalizedCategories = ghCats
        .slice()
        .sort((a: any, b: any) => (a.sortOrder || 999) - (b.sortOrder || 999))
        .map((cat: any, index: number) => ({
          ...toCategoryType(cat),
          sort_order: index + 1,
        }));

      const itemsByCat = new Map<string, any[]>();
      for (const item of ghItems) {
        if (!itemsByCat.has(item.categoryId)) {
          itemsByCat.set(item.categoryId, []);
        }
        itemsByCat.get(item.categoryId)!.push({ ...item });
      }

      const normalizedItems: any[] = [];
      for (const catItems of itemsByCat.values()) {
        catItems.sort((a: any, b: any) => (a.sortOrder || 999) - (b.sortOrder || 999));
        catItems.forEach((it: any, idx: number) => {
          normalizedItems.push({ ...toItemType(it), sort_order: idx + 1 });
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
        categories: normalizedCategories,
        items: normalizedItems,
      };
    }
  } catch (err) {
    console.error('GitHub public menu load failed, falling back to local files:', err);
  }

  // Fallback to baked-in local JSON files
  const rawCategories = Array.isArray(categoriesData?.categories)
    ? categoriesData.categories
    : [];
  const rawItems = Array.isArray(menuData?.items)
    ? menuData.items
    : [];
  const restaurant = restaurantData?.restaurant || {};

  const normalizedCategories = rawCategories
    .slice()
    .sort((a: any, b: any) => (a.sortOrder || 999) - (b.sortOrder || 999))
    .map((cat: any, index: number) => ({
      ...toCategoryType(cat),
      sort_order: index + 1,
    }));

  const itemsByCat = new Map<string, any[]>();
  for (const item of rawItems) {
    if (!itemsByCat.has(item.categoryId)) {
      itemsByCat.set(item.categoryId, []);
    }
    itemsByCat.get(item.categoryId)!.push({ ...item });
  }

  const normalizedItems: any[] = [];
  for (const catItems of itemsByCat.values()) {
    catItems.sort((a: any, b: any) => (a.sortOrder || 999) - (b.sortOrder || 999));
    catItems.forEach((it: any, idx: number) => {
      normalizedItems.push({ ...toItemType(it), sort_order: idx + 1 });
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
    categories: normalizedCategories,
    items: normalizedItems,
  };
}