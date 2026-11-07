/**
 * Image Auto-Match API — GitHub-backed.
 * Automatically matches dish images based on dish name.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readMenu, writeMenu, readCategories } from '@/lib/data-store';
import { listAllImages } from '@/lib/image-store';
import { matchImageToDish, findMatchingImages, dishNameToSlug, isLogoOrPlaceholder, detectDuplicateImages } from '@/lib/image-matching';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dishName = searchParams.get('dish');

    if (dishName) {
      // Find matching images for a specific dish
      const allImages = await listAllImages();
      const matches = findMatchingImages(dishName, allImages.map((img) => ({ name: img.name, path: img.path })));
      return NextResponse.json({ dish: dishName, matches });
    }

    // Return all dishes with their image status
    const menuData = await readMenu();
    const items = menuData?.items || [];

    // Get available images from GitHub
    let availableImages: Array<{ name: string; path: string }> = [];
    let availableImagePaths = new Set<string>();
    try {
      const allImages = await listAllImages();
      availableImages = allImages.map((img) => ({ name: img.name, path: img.path }));
      availableImagePaths = new Set(allImages.map((img) => img.path));
    } catch {
      // No images available
    }

    // Detect duplicate image assignments
    const duplicates = detectDuplicateImages(items.map((i) => ({ id: i.id, name: i.name, image: i.image ?? null })));

    const result = items.map((item) => {
      // Check if the image actually exists in GitHub
      const imageExists = item.image ? availableImagePaths.has(item.image) : false;
      const matches = findMatchingImages(item.name, availableImages);
      const bestMatch = matches.find((m) => m.matchType === 'exact');

      // Check if image is the logo or a placeholder
      const isLogo = isLogoOrPlaceholder(item.image ?? null);

      // Check if image is duplicated across multiple dishes
      const isDuplicate = item.image ? (duplicates.get(item.image)?.length || 0) > 1 : false;

      let status: string;
      if (!item.image || !imageExists) {
        status = 'missing';
      } else if (isLogo) {
        status = 'missing';
      } else if (isDuplicate) {
        status = 'needs_review';
      } else {
        // Preserve uploaded/generated; otherwise mark matched
        const prev = (item as any).imageStatus;
        if (prev === 'uploaded' || prev === 'generated') {
          status = prev;
        } else {
          status = 'matched';
        }
      }

      return {
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        image: item.image,
        imageStatus: status,
        imageExists,
        isLogo,
        isDuplicate,
        matchCount: matches.length,
        bestMatch: bestMatch || null,
        allMatches: matches,
      };
    });


    return NextResponse.json(result);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Image match GET error:', err);
    return NextResponse.json({ error: 'Failed to analyze images' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dishId, imagePath, imageStatus } = body;

    if (!dishId) {
      return NextResponse.json({ error: 'Dish ID is required' }, { status: 400 });
    }

    const menuData = await readMenu();
    if (!menuData) {
      return NextResponse.json({ error: 'Menu data not found' }, { status: 404 });
    }

    const itemIndex = menuData.items.findIndex((i) => i.id === dishId);
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
    }

    if (imagePath !== undefined) {
      menuData.items[itemIndex].image = imagePath;
    }
    if (imageStatus !== undefined) {
      menuData.items[itemIndex].imageStatus = imageStatus;
    }
    menuData.items[itemIndex].updatedAt = new Date().toISOString();

    await writeMenu(menuData);
    return NextResponse.json({ success: true, item: menuData.items[itemIndex] });
  } catch (err) {
    console.error('Image match POST error:', err);
    return NextResponse.json({ error: 'Failed to update image assignment' }, { status: 500 });
  }
}
