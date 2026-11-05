/**
 * GitHub-backed JSON data storage with server-side caching.
 *
 * Reads/writes menu.json, categories.json, restaurant.json, settings.json
 * through the private GitHub content repository.
 *
 * Cache: 15-second TTL for public reads.
 * Writes invalidate the relevant cache entry immediately.
 * All operations are server-side only.
 */

import { getGitHubFile, putGitHubFile, deleteGitHubFile } from '@/lib/github';

/**
 * Content repository file paths.
 */
const DATA_FILES = {
  menu: 'data/menu.json',
  categories: 'data/categories.json',
  restaurant: 'data/restaurant.json',
  settings: 'data/settings.json',
} as const;

/**
 * Cache entry with timestamp.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 15 * 1000; // 15 seconds

/**
 * In-memory server-side cache.
 * Keyed by file path.
 */
const dataCache = new Map<string, CacheEntry<unknown>>();

/**
 * Gets a cached value if still valid.
 */
function getCached<T>(key: string): T | null {
  const entry = dataCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    dataCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Sets a cached value.
 */
function setCached<T>(key: string, data: T): void {
  dataCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidates a cached value.
 */
function invalidateCached(key: string): void {
  dataCache.delete(key);
}

/**
 * Generic read: fetches JSON from GitHub, caches for 15 seconds.
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const cached = getCached<T>(filePath);
  if (cached) return cached;

  const data = await getGitHubFile<T>(filePath);
  if (data !== null) {
    setCached(filePath, data);
  }
  return data;
}

/**
 * Generic write: writes JSON to GitHub and invalidates cache.
 */
async function writeJsonFile<T>(
  filePath: string,
  data: T,
  commitMessage: string
): Promise<void> {
  await putGitHubFile(filePath, data as unknown as string | object, commitMessage);
  invalidateCached(filePath);
}

// ============================================================================
// MENU (menu.json)
// ============================================================================

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  image?: string | null;
  isAvailable: boolean;
  isFeatured?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuData {
  items: MenuItem[];
}

const MENU_CACHE_KEY = DATA_FILES.menu;

/**
 * Reads all menu items from GitHub.
 */
export async function readMenu(): Promise<MenuData | null> {
  return readJsonFile<MenuData>(MENU_CACHE_KEY);
}

/**
 * Writes all menu items to GitHub.
 */
export async function writeMenu(data: MenuData): Promise<void> {
  await writeJsonFile(MENU_CACHE_KEY, data, 'Update menu items');
}

/**
 * Reads a single menu item by ID.
 */
export async function readMenuItem(id: string): Promise<MenuItem | null> {
  const menu = await readMenu();
  if (!menu) return null;
  return menu.items.find((item) => item.id === id) || null;
}

// ============================================================================
// CATEGORIES (categories.json)
// ============================================================================

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoriesData {
  categories: MenuCategory[];
}

const CATEGORIES_CACHE_KEY = DATA_FILES.categories;

/**
 * Reads all categories from GitHub.
 */
export async function readCategories(): Promise<CategoriesData | null> {
  return readJsonFile<CategoriesData>(CATEGORIES_CACHE_KEY);
}

/**
 * Writes all categories to GitHub.
 */
export async function writeCategories(data: CategoriesData): Promise<void> {
  await writeJsonFile(CATEGORIES_CACHE_KEY, data, 'Update menu categories');
}

/**
 * Reads a single category by ID.
 */
export async function readCategory(id: string): Promise<MenuCategory | null> {
  const data = await readCategories();
  if (!data) return null;
  return data.categories.find((c) => c.id === id) || null;
}

// ============================================================================
// RESTAURANT SETTINGS (restaurant.json)
// ============================================================================

export interface RestaurantInfo {
  name: string;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  openingHours?: string | null;
  contactEmail?: string | null;
  socialLinks?: Record<string, string> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantData {
  restaurant: RestaurantInfo;
}

const RESTAURANT_CACHE_KEY = DATA_FILES.restaurant;

/**
 * Reads restaurant info from GitHub.
 */
export async function readRestaurant(): Promise<RestaurantData | null> {
  return readJsonFile<RestaurantData>(RESTAURANT_CACHE_KEY);
}

/**
 * Writes restaurant info to GitHub.
 */
export async function writeRestaurant(data: RestaurantData): Promise<void> {
  await writeJsonFile(RESTAURANT_CACHE_KEY, data, 'Update restaurant settings');
}

// ============================================================================
// SETTINGS (settings.json)
// ============================================================================

export interface AppSettings {
  currency: string;
  theme: string;
  menuLayout: string;
  orderingSettings: Record<string, unknown>;
  whatsappOrdering: boolean;
  imageSettings: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SettingsData {
  settings: AppSettings;
}

const SETTINGS_CACHE_KEY = DATA_FILES.settings;

/**
 * Reads app settings from GitHub.
 */
export async function readSettings(): Promise<SettingsData | null> {
  return readJsonFile<SettingsData>(SETTINGS_CACHE_KEY);
}

/**
 * Writes app settings to GitHub.
 */
export async function writeSettings(data: SettingsData): Promise<void> {
  await writeJsonFile(SETTINGS_CACHE_KEY, data, 'Update app settings');
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Invalidates all data caches (call after bulk operations).
 */
export async function invalidateAllCaches(): Promise<void> {
  dataCache.clear();
}

/**
 * Returns cache stats for debugging.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: dataCache.size,
    keys: Array.from(dataCache.keys()),
  };
}

export { CACHE_TTL_MS, DATA_FILES };