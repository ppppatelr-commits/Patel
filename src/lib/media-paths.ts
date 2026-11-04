/**
 * Client-safe media path and naming helpers
 * Can be safely imported in both Client Components and Server Components
 */

export const DISHES_MEDIA_REL_DIR = 'media/dishes';
export const REFERENCE_MEDIA_REL_DIR = 'media/reference';

/**
 * Normalizes text to a clean URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Explicit mapping of restaurant menu categories to the requested clean folder names
 * (per Section 5 of specification)
 */
export const CATEGORY_SLUG_MAP: Record<string, string> = {
  'SOUPS / SHORBA': 'soups-shorba',
  'MUTTON STARTERS': 'mutton-starters',
  'MUTTON MAIN COURSE': 'mutton-main-course',
  'KHAZANA - E - TANDOOR': 'khazana-e-tandoor',
  'CHICKEN MAIN COURSE': 'chicken-main-course',
  'EGGS': 'eggs',
  'CHINESE STARTERS': 'chinese-starters',
  'CHINESE POULTRY': 'chinese-poultry',
  'NOODLES': 'noodles',
  'CHINESE RICE': 'chinese-rice',
  'SEA FOOD & SALAD': 'sea-food-salad',
  'VEG APPETIZERS': 'veg-appetizers',
  'SABZION KI SAUGHAAT': 'sabzion-ki-saughaat',
  'VEG MAIN DISHES': 'veg-main-dishes',
  'BASMATI KA KHAZANA': 'basmati-ka-khazana',
  'ROTI KI TOKRI': 'roti-ki-tokri',
  'PIZZA': 'pizza',
  'BURGER': 'burger',
  'SANDWICH': 'sandwich',
  'ROLL': 'roll',
  'MOCKTAILS': 'mocktails',
  'DESSERTS': 'desserts',
  'FALOODA': 'falooda',
  'ICE CREAM': 'ice-cream',
  'PREMIUM FLAVOUR ICE CREAM': 'premium-flavour-ice-cream',
  'DESI REFRESHMENTS': 'desi-refreshments',
  'SWEETS': 'sweets',
  'KUNAFA': 'kunafa',
  'MILK SHAKE': 'milk-shake',
  'JUICE': 'juice',
  'BROWNIE': 'brownie',
  'PATEL SPECIAL': 'patel-special',
  'CATERERS': 'caterers',
  'TEA & COFFEE': 'tea-coffee',
};

/**
 * Returns the standardized category folder slug
 */
export function categorySlug(name: string): string {
  const clean = (name || '').trim().toUpperCase();
  if (CATEGORY_SLUG_MAP[clean]) {
    return CATEGORY_SLUG_MAP[clean];
  }
  return slugify(name);
}

/**
 * Returns the standardized dish filename: [dish-slug].webp
 */
export function dishFilename(dish: string): string {
  return `${slugify(dish)}.webp`;
}

/**
 * Returns relative path from public folder: media/dishes/[category]/[dish].webp
 */
export function dishMediaRelativePath(categoryName: string, dish: string): string {
  return `${DISHES_MEDIA_REL_DIR}/${categorySlug(categoryName)}/${dishFilename(dish)}`;
}

/**
 * Returns web-accessible URL: /media/dishes/[category]/[dish].webp
 */
export function buildDishImageUrl(categoryName: string, dish: string): string {
  return `/${DISHES_MEDIA_REL_DIR}/${categorySlug(categoryName)}/${dishFilename(dish)}`;
}

