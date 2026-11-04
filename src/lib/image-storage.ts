import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { MENU_DATA } from '@/lib/menu-data';
import {
  DISHES_MEDIA_REL_DIR,
  REFERENCE_MEDIA_REL_DIR,
  slugify,
  categorySlug,
  dishFilename,
  dishMediaRelativePath,
  buildDishImageUrl,
  CATEGORY_SLUG_MAP,
} from '@/lib/media-paths';

export {
  DISHES_MEDIA_REL_DIR,
  REFERENCE_MEDIA_REL_DIR,
  slugify,
  categorySlug,
  dishFilename,
  dishMediaRelativePath,
  buildDishImageUrl,
  CATEGORY_SLUG_MAP,
};

/**
 * Absolute path to public/media/dishes directory
 */
export function getDishesMediaDir(): string {
  return path.join(process.cwd(), 'public', DISHES_MEDIA_REL_DIR);
}

/**
 * Absolute path to public/media/reference directory
 */
export function getReferenceMediaDir(): string {
  return path.join(process.cwd(), 'public', REFERENCE_MEDIA_REL_DIR);
}

export type StorageProvider = 'local' | 'supabase';

export function getStorageProvider(): StorageProvider {
  const supabase = createServerSupabaseClient() as any;
  if (supabase) return 'supabase';
  return 'local';
}

export interface SavedImageResult {
  filename: string;
  filePath: string;
  fileUrl: string;
  provider: StorageProvider;
  saved: boolean;
}

/**
 * Saves generated dish image into public/media/dishes/[category]/[dish].webp
 * and uploads to Supabase Storage if configured.
 */
export async function saveDishImage(opts: {
  dish: string;
  category: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<SavedImageResult> {
  const { dish, category, buffer } = opts;
  const filename = dishFilename(dish);
  const catSlug = categorySlug(category);
  const relPath = `${DISHES_MEDIA_REL_DIR}/${catSlug}/${filename}`;
  const filePath = path.join(process.cwd(), 'public', relPath);
  const fileUrl = `/${relPath}`;
  const provider = getStorageProvider();

  // Always save locally to ensure physical presence in public/media/dishes/
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer);

  // If Supabase Storage is configured, also upload to menu-images bucket
  if (provider === 'supabase') {
    try {
      const supabase = createServerSupabaseClient() as any;
      const { error } = await supabase.storage.from('menu-images').upload(`dishes/${catSlug}/${filename}`, buffer, {
        contentType: opts.mimeType || 'image/webp',
        upsert: true,
      });
      if (!error) {
        const publicUrl = supabase.storage.from('menu-images').getPublicUrl(`dishes/${catSlug}/${filename}`).data.publicUrl;
        return {
          filename,
          filePath: `supabase://menu-images/dishes/${catSlug}/${filename}`,
          fileUrl: publicUrl,
          provider,
          saved: true,
        };
      }
    } catch {
      // Fallback to local
    }
  }

  return { filename, filePath, fileUrl, provider, saved: true };
}

/**
 * Validates that a path is safely located inside public/media/dishes
 * and does NOT allow directory traversal or deletion of reference images.
 */
export function isSafeDishesPath(rawPath: string): boolean {
  if (!rawPath || typeof rawPath !== 'string') return false;

  // Prevent directory traversal
  if (rawPath.includes('..') || rawPath.includes('~')) return false;

  // Normalize path separators
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // Protect master reference images and system assets from deletion
  if (normalized.includes('media/reference') || normalized.includes('logo.')) {
    return false;
  }

  // Must reside inside media/dishes
  return normalized.startsWith('media/dishes/') || normalized.startsWith('public/media/dishes/');
}

/**
 * Safely deletes an image file by its relative or storage path.
 * Strict safety rules enforced.
 */
export async function deleteByRelativePath(relPath: string): Promise<boolean> {
  if (!isSafeDishesPath(relPath)) {
    console.warn('Rejected unsafe delete path:', relPath);
    return false;
  }

  const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^public\//, '');
  const supabase = createServerSupabaseClient() as any;

  let deleted = false;

  if (supabase) {
    try {
      const storagePath = clean.replace(/^media\/dishes\//, 'dishes/');
      const { error } = await supabase.storage.from('menu-images').remove([storagePath]);
      if (!error) deleted = true;
    } catch (err) {
      console.warn('Supabase storage delete error:', (err as Error).message);
    }
  }

  const fullPath = path.join(process.cwd(), 'public', clean);
  try {
    const stat = await fs.stat(fullPath);
    if (stat.isFile()) {
      await fs.unlink(fullPath);
      deleted = true;
    }
  } catch {
    // File already does not exist
  }

  return deleted;
}

/**
 * Safely deletes a dish image given its dish name and category.
 */
export async function deleteDishImage(opts: { dish: string; category?: string; filename?: string }): Promise<boolean> {
  const { dish, filename } = opts;
  const finalFilename = filename || dishFilename(dish);
  const catSlug = opts.category ? categorySlug(opts.category) : '';

  // If category is provided, construct exact relative path
  if (catSlug) {
    const rel = `${DISHES_MEDIA_REL_DIR}/${catSlug}/${finalFilename}`;
    return deleteByRelativePath(rel);
  }

  // Otherwise search in all subdirectories of public/media/dishes
  const root = getDishesMediaDir();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const targetFile = path.join(root, entry.name, finalFilename);
      try {
        await fs.access(targetFile);
        await fs.unlink(targetFile);
        return true;
      } catch {
        // Continue searching
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return false;
}

/**
 * Checks if a dish image physically exists on disk.
 */
export async function dishImageExists(opts: { dish: string; category: string; filename?: string }): Promise<boolean> {
  const finalFilename = opts.filename || dishFilename(opts.dish);
  const catSlug = categorySlug(opts.category);
  const filePath = path.join(getDishesMediaDir(), catSlug, finalFilename);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    // Also check if it exists in any category folder if category was misassigned
    return false;
  }
}

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

/**
 * Lists all generated dish image files physically present in public/media/dishes
 */
export async function listDishImageFiles(): Promise<DishImageFile[]> {
  const root = getDishesMediaDir();
  const files: DishImageFile[] = [];

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const catDir = path.join(root, entry.name);
      const catFiles = await fs.readdir(catDir);
      for (const f of catFiles) {
        if (!f.endsWith('.webp') && !f.endsWith('.png') && !f.endsWith('.jpg') && !f.endsWith('.jpeg')) continue;
        const filePath = path.join(catDir, f);
        const stat = await fs.stat(filePath);

        // Find matching original dish name and category name from MENU_DATA
        const slugWithoutExt = f.replace(/\.(webp|png|jpe?g)$/i, '');
        const previousMatch = slugWithoutExt.match(/^(.*)-previous-\d{14}(?:-\d+)?$/);
        const lookupSlug = previousMatch ? previousMatch[1] : slugWithoutExt;
        const matchedDish = findDishBySlug(lookupSlug);
        const baseDishName =
          matchedDish?.name ||
          (previousMatch ? lookupSlug : slugWithoutExt).replace(/-/g, ' ').toUpperCase();

        files.push({
          category: entry.name,
          categoryName: matchedDish?.category || entry.name.replace(/-/g, ' ').toUpperCase(),
          dish: previousMatch ? `${baseDishName} (previous)` : baseDishName,
          filename: f,
          filePath,
          fileUrl: `/${DISHES_MEDIA_REL_DIR}/${entry.name}/${f}`,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        });
      }
    }
  } catch {
    // Directory does not exist yet
  }

  return files;
}

/**
 * Copy the current bytes at `relPath` to a sibling "previous" file so the
 * original path can be overwritten without losing the old image.
 *
 * Returns the public URL of the archived copy, or null when there was no
 * existing file to preserve.
 */
export async function archiveExistingImage(relPath: string): Promise<string | null> {
  if (!isSafeDishesPath(relPath)) return null;

  const clean = relPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^public\//, '');
  const fullPath = path.join(process.cwd(), 'public', clean);

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  const dir = path.dirname(fullPath);
  const ext = path.extname(fullPath);
  const base = path.basename(fullPath, ext);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

  let archivedName = `${base}-previous-${stamp}${ext}`;
  let archivedPath = path.join(dir, archivedName);
  let counter = 1;
  while (true) {
    try {
      await fs.access(archivedPath);
      archivedName = `${base}-previous-${stamp}-${counter}${ext}`;
      archivedPath = path.join(dir, archivedName);
      counter += 1;
    } catch {
      break;
    }
  }

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.copyFile(fullPath, archivedPath);
  } catch {
    // Read-only filesystem (e.g. Vercel) — archiving is best-effort.
    return null;
  }
  const publicRoot = path.join(process.cwd(), 'public');
  const archivedRel = path.relative(publicRoot, archivedPath).replace(/\\/g, '/');
  return `/${archivedRel}`;
}

/**
 * Resolve a Media Library local ID (local-<category>-<filename>) to the
 * actual file on disk. Returns null when the file no longer exists.
 */
export async function findDishImageById(id: string): Promise<DishImageFile | null> {
  if (!id || !id.startsWith('local-')) return null;
  const files = await listDishImageFiles();
  return files.find((f) => `local-${f.category}-${f.filename}` === id) || null;
}

/**
 * Helper to match a slug back to the exact MENU_DATA item
 */
function findDishBySlug(slug: string): { name: string; category: string } | null {
  const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>;
  for (const [catName, catItems] of Object.entries(itemsRecord)) {
    for (const item of catItems) {
      if (slugify(item.name) === slug) {
        return { name: item.name, category: catName };
      }
    }
  }
  return null;
}

/**
 * Analyzes MENU_DATA vs physical files on disk, returning complete stats
 * including all missing images.
 */
export async function getMenuImageInventory() {
  const existingFiles = await listDishImageFiles();
  const existingSlugs = new Set(existingFiles.map((f) => slugify(f.dish)));

  const allDishes: Array<{
    name: string;
    category: string;
    price: number;
    filename: string;
    categorySlug: string;
    expectedUrl: string;
    hasImage: boolean;
    imageFile?: DishImageFile;
  }> = [];

  const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>;
  for (const [catName, catItems] of Object.entries(itemsRecord)) {
    const catSlug = categorySlug(catName);
    for (const item of catItems) {
      const slug = slugify(item.name);
      const filename = `${slug}.webp`;
      const expectedUrl = `/${DISHES_MEDIA_REL_DIR}/${catSlug}/${filename}`;
      const matchingFile = existingFiles.find((f) => slugify(f.dish) === slug);
      const hasImage = !!matchingFile;

      allDishes.push({
        name: item.name,
        category: catName,
        price: item.price,
        filename,
        categorySlug: catSlug,
        expectedUrl,
        hasImage,
        imageFile: matchingFile,
      });
    }
  }

  const missingDishes = allDishes.filter((d) => !d.hasImage);
  const availableDishes = allDishes.filter((d) => d.hasImage);
  const totalStorage = existingFiles.reduce((sum, f) => sum + f.size, 0);

  return {
    totalDishes: allDishes.length,
    totalImages: existingFiles.length,
    availableCount: availableDishes.length,
    missingCount: missingDishes.length,
    totalStorageBytes: totalStorage,
    allDishes,
    missingDishes,
    availableDishes,
    existingFiles,
  };
}
