/**
 * Smart AI Dish Image Manager — Image Matching Utilities
 *
 * Provides automatic image-to-dish matching based on dish names,
 * image status classification, and bulk management helpers.
 */

import { slugify } from '@/lib/media-paths';

export type ImageStatus = 'matched' | 'generated' | 'uploaded' | 'missing' | 'needs_review';

/**
 * Normalizes a dish name into a slug for matching.
 * "Chicken Hot and Sour Soup" → "chicken-hot-and-sour-soup"
 */
export function dishNameToSlug(dishName: string): string {
  return slugify(dishName);
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
    lower === '/logo.png' ||
    lower === 'logo.png' ||
    lower.endsWith('/logo.png')
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
 * Normalizes an image filename into a slug for matching.
 * "chicken-hot-and-sour-soup.webp" → "chicken-hot-and-sour-soup"
 */
export function imageFilenameToSlug(filename: string): string {
  return slugify(filename.replace(/\.(webp|png|jpe?g|gif)$/i, ''));
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
