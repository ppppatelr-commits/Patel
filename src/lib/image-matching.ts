/**
 * Smart AI Dish Image Manager — Image Matching Utilities
 *
 * Provides automatic image-to-dish matching based on dish names,
 * image status classification, and bulk management helpers.
 */

import { slugify } from '@/lib/media-paths';

export type ImageStatus = 'matched' | 'generated' | 'uploaded' | 'missing' | 'needs_review';

/**
 * Common abbreviations used in image filenames.
 */
const ABBREVIATIONS: Record<string, string> = {
  chi: 'chicken',
  mtn: 'mutton',
  veg: 'vegetable',
  btr: 'butter',
  spl: 'special',
  msl: 'masala',
  kadai: 'kadhai',
  pkd: 'pakoda',
  pcs: 'pieces',
  kg: 'kilogram',
  full: 'full',
  half: 'half',
};

/**
 * Expands abbreviations in a slug.
 * "chi-clear-soup" → "chicken-clear-soup"
 */
function expandAbbreviations(slug: string): string {
  return slug
    .split('-')
    .map((word) => ABBREVIATIONS[word] || word)
    .join('-');
}

/**
 * Normalizes a dish name into a slug for matching.
 * "Chicken Hot and Sour Soup" → "chicken-hot-and-sour-soup"
 */
export function dishNameToSlug(dishName: string): string {
  return slugify(dishName);
}

/**
 * Normalizes an image filename slug, expanding abbreviations.
 * "chi-clear-soup" → "chicken-clear-soup"
 */
export function imageFilenameToSlug(filename: string): string {
  const base = slugify(filename.replace(/\.(webp|png|jpe?g|gif)$/i, ''));
  return expandAbbreviations(base);
}

/**
 * Checks if an image path is the restaurant logo or a generic placeholder.
 */
export function isLogoOrPlaceholder(imagePath: string | null): boolean {
  if (!imagePath) return false;
  const lower = imagePath.toLowerCase();
  return (
    lower.includes('logo') ||
    lower.includes('placeholder') ||
    lower === '/patel-logo-gold.png' ||
    lower === 'logo.png' ||
    lower.endsWith('/patel-logo-gold.png')
  );
}

/**
 * Detects duplicate image assignments.
 * Returns a map of image path → array of dish IDs that use it.
 */
export function detectDuplicateImages(
  items: Array<{ id: string; name: string; image: string | null }>
): Map<string, string[]> {
  const imageToDishes = new Map<string, string[]>();
  for (const item of items) {
    if (item.image) {
      const existing = imageToDishes.get(item.image) || [];
      existing.push(item.id);
      imageToDishes.set(item.image, existing);
    }
  }
  // Only return entries with more than one dish
  const duplicates = new Map<string, string[]>();
  for (const [path, dishIds] of imageToDishes) {
    if (dishIds.length > 1) {
      duplicates.set(path, dishIds);
    }
  }
  return duplicates;
}



/**
 * Checks if an image filename matches a dish name.
 * Returns 'matched' if exact slug match, 'needs_review' if partial match, null if no match.
 */
export function matchImageToDish(
  dishName: string,
  imageFilename: string | null
): ImageStatus {
  if (!imageFilename) return 'missing';

  const dishSlug = dishNameToSlug(dishName);
  const imageSlug = imageFilenameToSlug(imageFilename);

  if (dishSlug === imageSlug) return 'matched';

  // Check if one contains the other (partial match)
  if (dishSlug.includes(imageSlug) || imageSlug.includes(dishSlug)) {
    return 'needs_review';
  }

  // Check word overlap
  const dishWords = dishSlug.split('-').filter(Boolean);
  const imageWords = imageSlug.split('-').filter(Boolean);
  const commonWords = dishWords.filter((w) => imageWords.includes(w));
  const overlapRatio = commonWords.length / Math.max(dishWords.length, imageWords.length);

  if (overlapRatio >= 0.6) return 'needs_review';

  return 'needs_review'; // If an image exists but doesn't clearly match, flag for review
}

/**
 * Determines the image status for a menu item.
 * If the image file doesn't exist (verified externally), returns 'missing'.
 */
export function determineImageStatus(
  dishName: string,
  imageFilename: string | null,
  currentStatus?: ImageStatus,
  imageExists?: boolean
): ImageStatus {
  if (!imageFilename) return 'missing';
  if (imageExists === false) return 'missing';
  if (currentStatus === 'generated' || currentStatus === 'uploaded') return currentStatus;
  return matchImageToDish(dishName, imageFilename);
}

/**
 * Finds matching images for a dish from a list of available images.
 */
export function findMatchingImages(
  dishName: string,
  availableImages: Array<{ name: string; path: string }>
): Array<{ name: string; path: string; matchType: 'exact' | 'partial' }> {
  const dishSlug = dishNameToSlug(dishName);
  const results: Array<{ name: string; path: string; matchType: 'exact' | 'partial' }> = [];

  for (const img of availableImages) {
    const imageSlug = imageFilenameToSlug(img.name);
    if (imageSlug === dishSlug) {
      results.push({ ...img, matchType: 'exact' });
    } else if (imageSlug.includes(dishSlug) || dishSlug.includes(imageSlug)) {
      results.push({ ...img, matchType: 'partial' });
    } else {
      const dishWords = dishSlug.split('-').filter(Boolean);
      const imageWords = imageSlug.split('-').filter(Boolean);
      const commonWords = dishWords.filter((w) => imageWords.includes(w));
      const overlapRatio = commonWords.length / Math.max(dishWords.length, imageWords.length);
      if (overlapRatio >= 0.5) {
        results.push({ ...img, matchType: 'partial' });
      }
    }
  }

  // Sort: exact matches first, then partial
  results.sort((a, b) => {
    if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
    if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
    return 0;
  });

  return results;
}

/**
 * Generates a standardized filename for a dish image.
 */
export function generateImageFilename(dishName: string): string {
  return `${dishNameToSlug(dishName)}.webp`;
}
