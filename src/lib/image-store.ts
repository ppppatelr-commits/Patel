/**
 * GitHub-backed image storage with Sharp optimization.
 *
 * Uploads, replaces, deletes, and lists dish images in the private GitHub
 * content repository under media/dishes/[category-slug]/[dish-slug].webp.
 *
 * All image processing happens server-side using Sharp (already a dependency).
 * The GitHub token is never exposed to the client.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import {
  downloadGitHubFile,
  listGitHubDirectory,
  putGitHubFile,
  deleteGitHubFile,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
} from '@/lib/github';

/**
 * Image optimization configuration.
 */
const IMAGE_CONFIG = {
  // Target dimensions (max width/height, maintaining aspect ratio)
  maxWidth: 1024,
  maxHeight: 1024,
  // WebP quality 80 = good balance of size/quality (~100-200 KB target)
  webpQuality: 80,
  // Allowed input types
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  // Max upload size: 5 MB
  maxSizeBytes: 5 * 1024 * 1024,
} as const;

/**
 * Validates and sanitizes a category slug for use in a file path.
 * Prevents path traversal attacks.
 */
export function sanitizeCategorySlug(slug: string): string {
  const clean = slug
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!clean || clean === '..' || clean.includes('..')) {
    throw new Error('Invalid category slug.');
  }
  return clean;
}

/**
 * Validates and sanitizes a dish filename.
 */
export function sanitizeDishFilename(filename: string): string {
  const clean = filename
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!clean || clean === '..' || clean.includes('..')) {
    throw new Error('Invalid dish filename.');
  }
  return clean;
}

/**
 * Returns the GitHub path for a dish image.
 */
export function dishImagePath(categorySlug: string, dishSlug: string, subfolder?: string): string {
  const cat = sanitizeCategorySlug(categorySlug);
  let file = sanitizeDishFilename(dishSlug);
  // Ensure .webp extension
  if (!file.match(/\.(webp|png|jpe?g|gif)$/i)) {
    file = file + '.webp';
  }
  if (subfolder) {
    const sub = sanitizeCategorySlug(subfolder);
    return `media/dishes/${cat}/${sub}/${file}`;
  }
  return `media/dishes/${cat}/${file}`;
}

/**
 * Processes an uploaded image buffer:
 * 1. Converts to WebP
 * 2. Resizes to max dimensions (maintaining aspect ratio)
 * 3. Strips metadata
 * 4. Returns optimized buffer
 */
export async function optimizeImageBuffer(
  buffer: Buffer
): Promise<{ optimizedBuffer: Buffer; sizeBytes: number }> {
  const pipeline = sharp(buffer)
    .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_CONFIG.webpQuality, effort: 6 })
    .withMetadata();

  const optimizedBuffer = await pipeline.toBuffer();
  return { optimizedBuffer, sizeBytes: optimizedBuffer.length };
}

/**
 * Uploads a new dish image to GitHub.
 * Processes with Sharp (WebP conversion + resize).
 */
export async function uploadDishImage(
  categorySlug: string,
  dishSlug: string,
  imageBuffer: Buffer,
  mimeType: string,
  commitMessage?: string,
  subfolder?: string
): Promise<{
  path: string;
  url: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}> {
  // Validate input
  if (!IMAGE_CONFIG.allowedTypes.includes(mimeType as (typeof IMAGE_CONFIG.allowedTypes)[number])) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF.`);
  }
  if (imageBuffer.length > IMAGE_CONFIG.maxSizeBytes) {
    throw new Error('Image too large. Maximum 5 MB.');
  }

  // Optimize with Sharp
  const { optimizedBuffer, sizeBytes } = await optimizeImageBuffer(imageBuffer);

  // Get dimensions before optimization (optional metadata)
  let width: number | undefined;
  let height: number | undefined;
  try {
    const metadata = await sharp(imageBuffer).metadata();
    width = metadata.width;
    height = metadata.height;
  } catch {
    // Ignore metadata errors
  }

  const filePath = dishImagePath(categorySlug, dishSlug, subfolder);

  const msg =
    commitMessage || `Upload image: ${dishSlug} (${categorySlug})`;

  await putGitHubFile(filePath, optimizedBuffer, msg);

  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

  return {
    path: filePath,
    url: '/' + filePath,
    sizeBytes,
    width,
    height,
  };
}

/**
 * Replaces an existing dish image.
 * Archives is handled by GitHub commit history (no separate previous file needed).
 */
export async function replaceDishImage(
  categorySlug: string,
  dishSlug: string,
  imageBuffer: Buffer,
  mimeType: string,
  commitMessage?: string,
  subfolder?: string
): Promise<{
  path: string;
  url: string;
  sizeBytes: number;
}> {
  // Same as upload but with replace semantics
  return uploadDishImage(
    categorySlug,
    dishSlug,
    imageBuffer,
    mimeType,
    commitMessage || `Replace image: ${dishSlug} (${categorySlug})`,
    subfolder
  );
}

/**
 * Deletes a dish image from GitHub.
 */
export async function deleteDishImage(
  categorySlug: string,
  dishSlug: string,
  commitMessage?: string,
  subfolder?: string
): Promise<boolean> {
  const filePath = dishImagePath(categorySlug, dishSlug, subfolder);

  try {
    await deleteGitHubFile(
      filePath,
      commitMessage || `Delete image: ${dishSlug} (${categorySlug})`
    );
    return true;
  } catch (err) {
    // If file doesn't exist, treat as already deleted
    if (err instanceof Error && err.message.includes('404')) {
      return true;
    }
    throw err;
  }
}

/**
 * Lists all images in a category folder.
 */
export async function listCategoryImages(
  categorySlug: string
): Promise<Array<{
  name: string;
  path: string;
  size: number;
  downloadUrl: string | null;
}>> {
  const dirPath = `media/dishes/${sanitizeCategorySlug(categorySlug)}`;
  const files = await listGitHubDirectory(dirPath);

  return files
    .filter((f) => f.type === 'file')
    .map((f) => ({
      name: f.name,
      path: f.path,
      size: f.size,
      downloadUrl: f.download_url,
    }));
}

/**
 * Lists all images across all categories.
 */
export async function listAllImages(): Promise<Array<{
  name: string;
  path: string;
  size: number;
  category: string;
  downloadUrl: string | null;
}>> {
  const root = 'media/dishes';
  const categories = await listGitHubDirectory(root);

  const result: Array<{
    name: string;
    path: string;
    size: number;
    category: string;
    downloadUrl: string | null;
  }> = [];

  for (const cat of categories) {
    if (cat.type !== 'dir') continue;
    const files = await listGitHubDirectory(cat.path);
    for (const f of files.filter((x) => x.type === 'file')) {
      result.push({
        name: f.name,
        path: f.path,
        size: f.size,
        category: cat.name,
        downloadUrl: f.download_url,
      });
    }
  }

  return result;
}

/**
 * Checks if a dish image exists in GitHub.
 */
export async function dishImageExists(
  categorySlug: string,
  dishSlug: string
): Promise<boolean> {
  const filePath = dishImagePath(categorySlug, dishSlug);
  try {
    const result = await downloadGitHubFile(filePath);
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Downloads image bytes from GitHub (used by the proxy route).
 */
export async function getDishImageBytes(
  categorySlug: string,
  dishSlug: string
): Promise<{ buffer: Buffer; contentType: string; size: number } | null> {
  const filePath = dishImagePath(categorySlug, dishSlug);
  return downloadGitHubFile(filePath);
}

export { IMAGE_CONFIG };