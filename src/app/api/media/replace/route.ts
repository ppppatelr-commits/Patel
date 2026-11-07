/**
 * Media Replace API — GitHub-backed.
 * Replaces an existing dish image in the private GitHub repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  replaceDishImage,
  dishImagePath,
  sanitizeCategorySlug,
  sanitizeDishFilename,
  invalidateImageListCache,
} from '@/lib/image-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawPath = String(formData.get('path') || '');
    const category = (formData.get('category') as string) || 'general';
    const dishName = (formData.get('dish') as string) || 'dish';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!rawPath) {
      return NextResponse.json(
        { error: 'A valid image path is required.' },
        { status: 400 }
      );
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Max 5MB' },
        { status: 400 }
      );
    }

    // Parse category and dish slug from path
    // Path format: media/dishes/[category]/[dish].webp
    const clean = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^public\//, '');
    const parts = clean.split('/');
    // Expect: media, dishes, category, filename
    const catSlug = parts.length >= 3 ? sanitizeCategorySlug(parts[2]) : sanitizeCategorySlug(category);
    const fileName = parts.length >= 4 ? sanitizeDishFilename(parts[3]) : sanitizeDishFilename(dishName);
    // Remove extension from dish slug
    const dishSlug = fileName.replace(/\.(webp|png|jpe?g|gif)$/i, '');

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await replaceDishImage(
      catSlug,
      dishSlug,
      buffer,
      file.type,
      `Replace image: ${dishSlug} (${catSlug})`
    );

    invalidateImageListCache();
    return NextResponse.json({
      success: true,
      filename: result.path.split('/').pop(),
      filePath: result.path,
      fileUrl: '/' + result.path,
      size: result.sizeBytes,
      mimeType: file.type,
    });
  } catch (err) {
    console.error('Media replace error:', err);
    return NextResponse.json(
      { error: 'Replace failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}