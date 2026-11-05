/**
 * Media Library API — GitHub-backed.
 * Lists images from the private GitHub content repository.
 * Supports search, category filter, and inventory.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listAllImages, listCategoryImages } from '@/lib/image-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const inventoryOnly = searchParams.get('inventory') === 'true';

    if (inventoryOnly) {
      // Return inventory summary across all categories
      const allImages = await listAllImages();
      return NextResponse.json({
        totalImages: allImages.length,
        totalStorageBytes: allImages.reduce((sum, i) => sum + i.size, 0),
        images: allImages,
      });
    }

    let images;
    if (category && category !== 'all') {
      images = await listCategoryImages(category);
    } else {
      images = await listAllImages();
    }

    // Apply search filter
    if (search) {
      const term = search.toLowerCase();
      images = images.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.path.toLowerCase().includes(term)
      );
    }

    // Sort newest first (by path, since we don't have upload dates from GitHub API easily)
    images.sort((a, b) => b.path.localeCompare(a.path));

    return NextResponse.json(images);
  } catch (err) {
    console.error('Media GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch media library' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dish_name, filename, file_path, file_url, mime_type, category_id, status } = body;

    if (!dish_name || !filename || !file_url) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    // Record media metadata — we store it alongside the image path
    // The actual image is already in GitHub via upload/replace routes
    return NextResponse.json({
      id: `local-${filename}`,
      dish_name,
      filename,
      file_url,
      status: status || 'active',
      category_id: category_id || null,
    });
  } catch (err) {
    console.error('Media POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create media item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const rawPath = searchParams.get('path');
    const dish = searchParams.get('dish');
    const category = searchParams.get('category');

    let deleted = false;

    if (rawPath) {
      // Parse category and dish from path: media/dishes/[cat]/[dish].webp
      const clean = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^public\//, '');
      const parts = clean.split('/');
      if (parts.length >= 4 && parts[0] === 'media' && parts[1] === 'dishes') {
        const catSlug = parts[2];
        const fileName = parts[3];
        const dishSlug = fileName.replace(/\.(webp|png|jpe?g|gif)$/i, '');
        deleted = await deleteDishImageFromGitHub(catSlug, dishSlug);
      }
    }

    if (!deleted && dish) {
      // Fallback: try to find and delete by dish name
      const catSlug = category || 'general';
      const dishSlug = dish.toLowerCase().replace(/[^a-z0-9]/g, '-');
      deleted = await deleteDishImageFromGitHub(catSlug, dishSlug);
    }

    if (!deleted) {
      return NextResponse.json(
        { error: 'Image not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    console.error('Media DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete media item' },
      { status: 500 }
    );
  }
}

async function deleteDishImageFromGitHub(
  categorySlug: string,
  dishSlug: string
): Promise<boolean> {
  const { deleteDishImage } = await import('@/lib/image-store');
  try {
    return await deleteDishImage(categorySlug, dishSlug, `Delete image: ${dishSlug} (${categorySlug})`);
  } catch {
    return false;
  }
}