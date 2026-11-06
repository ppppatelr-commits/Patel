/**
 * Media Proxy API — Secure image delivery from private GitHub repository.
 *
 * Customers request images at /media/dishes/[category]/[dish].webp.
 * This server-side route:
 * 1. Validates and sanitizes the requested path (no path traversal).
 * 2. Downloads the image from the private GitHub content repository
 *    using the server-side GitHub token (never exposed to client).
 * 3. Returns image bytes with appropriate cache headers.
 * 4. Handles missing images safely with 404.
 *
 * GitHub token is never sent to the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDishImageBytes } from '@/lib/image-store';

export const dynamic = 'force-dynamic';

/**
 * Validates that the requested path is a safe dish image path.
 * Format: dishes/[category-slug]/[dish-slug].webp
 * Blocks path traversal and access to non-image files.
 */
function isSafeImagePath(rawPath: string): boolean {
  if (!rawPath || typeof rawPath !== 'string') return false;

  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // Block path traversal
  if (normalized.includes('..') || normalized.includes('~')) return false;

  // Must start with dishes/
  if (!normalized.startsWith('dishes/')) return false;

  // Must have exactly: dishes/category/file.ext
  const parts = normalized.split('/');
  if (parts.length !== 3) return false;

  const [, category, filename] = parts;
  if (!category || !filename) return false;

  // Only allow image extensions
  const ext = filename.toLowerCase();
  if (
    !ext.endsWith('.webp') &&
    !ext.endsWith('.png') &&
    !ext.endsWith('.jpg') &&
    !ext.endsWith('.jpeg') &&
    !ext.endsWith('.gif')
  ) {
    return false;
  }

  // No null bytes
  if (normalized.includes('\0')) return false;

  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const relSubPath = segments.join('/'); // e.g. "dishes/chicken-starters/chi-crispy.webp"

    // Safety validation
    if (!isSafeImagePath(relSubPath)) {
      return new NextResponse('Invalid image path', { status: 400 });
    }

    // Extract category and dish slug from path
    const parts = relSubPath.split('/');
    // parts = ['dishes', category, filename]
    const categorySlug = parts[1];
    const fileName = parts[2];
    const dishSlug = fileName.replace(/\.(webp|png|jpe?g|gif)$/i, '');

    // Download image bytes from private GitHub (server-side token)
    const result = await getDishImageBytes(categorySlug, dishSlug);

    if (!result) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Determine cache headers
    // Images are versioned by filename; use long cache for immutable images.
    // For replaceable images, the admin should use a new filename or we rely
    // on the 15s data cache + short image cache.
    const isWebp = result.contentType === 'image/webp';

    return new NextResponse(
      new Uint8Array(result.buffer),
      {
        headers: {
          'Content-Type': result.contentType,
          'Content-Length': String(result.size),
          // No caching - always fetch fresh image (prevents stale images after upload/replace)
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (err) {
    console.error('Media proxy error:', err);
    return new NextResponse('Error serving image', { status: 500 });
  }
}