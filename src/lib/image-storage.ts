/**
 * Image storage layer — GitHub-backed (replaces Supabase Storage).
 *
 * All image operations go through the private GitHub content repository
 * using server-side GitHub API calls. Sharp is used for WebP conversion
 * and optimization.
 *
 * Replaces the previous Supabase Storage implementation completely.
 */

import {
  uploadDishImage,
  replaceDishImage,
  deleteDishImage,
  dishImageExists,
  getDishImageBytes,
  listAllImages,
  listCategoryImages,
  dishImagePath,
  sanitizeCategorySlug,
  sanitizeDishFilename,
} from '@/lib/image-store';

/**
 * Storage provider is now always GitHub.
 */
export type StorageProvider = 'github';

export function getStorageProvider(): StorageProvider {
  return 'github';
}

/**
 * Absolute path helpers (kept for API compatibility with admin pages).
 * These point to the local public folder for development reference only;
 * production images are served from GitHub via the /media proxy route.
 */
export const DISHES_MEDIA_REL_DIR = 'media/dishes';
export const REFERENCE_MEDIA_REL_DIR = 'media/reference';

export function getDishesMediaDir(): string {
  return 'public/media/dishes';
}

export function getReferenceMediaDir(): string {
  return 'public/media/reference';
}

/**
 * Result of saving an image.
 */
export interface SavedImageResult {
  filename: string;
  filePath: string;
  fileUrl: string;
  provider: StorageProvider;
  saved: boolean;
}

/**
 * Saves a dish image to GitHub (replaces Supabase Storage upload).
 * Processes with Sharp (WebP conversion + resize).
 */
export async function saveDishImage(opts: {
  dish: string;
  category: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<SavedImageResult> {
  const { dish, category, buffer } = opts;
  const mimeType = opts.mimeType || 'image/webp';

  const result = await uploadDishImage(
    category,
    dish,
    buffer,
    mimeType,
    `Upload image: ${dish} (${category})`
  );

  return {
    filename: result.path.split('/').pop() || dish,
    filePath: result.path,
    fileUrl: '/' + result.path,
    provider: 'github',
    saved: true,
  };
}

/**
 * Checks if a path is safe for deletion (GitHub-backed version).
 */
export function isSafeDishesPath(rawPath: string): boolean {
  if (!rawPath || typeof rawPath !== 'string') return false;
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.includes('~')) return false;
  if (normalized.includes('media/reference') || normalized.includes('logo.')) {
    return false;
  }
  return normalized.startsWith('media/dishes/') || normalized.startsWith('public/media/dishes/');
}

/**
 * Deletes a dish image by relative path.
 */
export async function deleteByRelativePath(relPath: string): Promise<boolean> {
  if (!isSafeDishesPath(relPath)) {
    console.warn('Rejected unsafe delete path:', relPath);
    return false;
  }

  const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^public\//, '');
  const parts = clean.split('/');
  // Expect: media/dishes/category/file.ext
  if (parts.length < 4 || parts[0] !== 'media' || parts[1] !== 'dishes') {
    return false;
  }

  const categorySlug = parts[2];
  const fileName = parts[3];
  const dishSlug = fileName.replace(/\.(webp|png|jpe?g|gif)$/i, '');

  return deleteDishImage(categorySlug, dishSlug, `Delete image: ${dishSlug} (${categorySlug})`);
}

/**
 * Deletes a dish image given dish name and category.
 */
export async function deleteDishImageByDish(opts: {
  dish: string;
  category?: string;
  filename?: string;
}): Promise<boolean> {
  const { dish, category, filename } = opts;
  const finalFilename = filename || `${sanitizeDishFilename(dish)}.webp`;
  const catSlug = category ? sanitizeCategorySlug(category) : 'general';
  const dishSlug = finalFilename.replace(/\.(webp|png|jpe?g|gif)$/i, '');

  return deleteDishImage(catSlug, dishSlug, `Delete image: ${dishSlug} (${catSlug})`);
}

/**
 * Checks if a dish image exists in GitHub.
 */
export async function dishImageExistsInGitHub(opts: {
  dish: string;
  category: string;
  filename?: string;
}): Promise<boolean> {
  const finalFilename = opts.filename || `${sanitizeDishFilename(opts.dish)}.webp`;
  const catSlug = sanitizeCategorySlug(opts.category);
  const dishSlug = finalFilename.replace(/\.(webp|png|jpe?g|gif)$/i, '');

  return dishImageExists(catSlug, dishSlug);
}

/**
 * Lists all dish image files (GitHub-backed).
 */
export interface DishImageFile {
  category: string;
  categoryName: string;
  dish: string;
  filename: string;
  filePath: string;
  fileUrl: string;
  size: number;
  updatedAt: string;
}

export async function listDishImageFiles(): Promise<DishImageFile[]> {
  const allImages = await listAllImages();
  const rawUrlBase = `https://raw.githubusercontent.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/${process.env.GITHUB_BRANCH || 'main'}/`;

  return allImages.map((f) => {
    const category = f.category;
    const fileName = f.name;
    const dish = fileName.replace(/\.(webp|png|jpe?g|gif)$/i, '').replace(/-/g, ' ').toUpperCase();
    return {
      category,
      categoryName: category.replace(/-/g, ' ').toUpperCase(),
      dish,
      filename: fileName,
      filePath: f.path,
      fileUrl: f.downloadUrl || `${rawUrlBase}${f.path}`,
      size: f.size,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Archives an existing image (GitHub keeps history via commits, so this is
 * a no-op that returns null — the previous version is in Git history).
 */
export async function archiveExistingImage(relPath: string): Promise<string | null> {
  // GitHub commit history serves as image history. No separate archive file needed.
  return null;
}

/**
 * Finds a dish image by local ID format: local-[category]-[filename]
 */
export async function findDishImageById(id: string): Promise<DishImageFile | null> {
  if (!id || !id.startsWith('local-')) return null;
  const files = await listDishImageFiles();
  return files.find((f) => `local-${f.category}-${f.filename}` === id) || null;
}

/**
 * Gets menu image inventory (for admin dashboard stats).
 */
export async function getMenuImageInventory() {
  const existingFiles = await listDishImageFiles();
  return {
    totalImages: existingFiles.length,
    totalStorageBytes: existingFiles.reduce((sum, f) => sum + f.size, 0),
    existingFiles,
  };
}

// Re-export for convenience
export { dishImagePath, sanitizeCategorySlug, sanitizeDishFilename };