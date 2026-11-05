/**
 * Media Upload API — GitHub-backed.
 * Uploads dish images to the private GitHub content repository.
 * Processes images with Sharp (WebP conversion + resize).
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadDishImage } from '@/lib/image-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dishName = (formData.get('dish') as string) || 'dish';
    const category = (formData.get('category') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadDishImage(
      category,
      dishName,
      buffer,
      file.type,
      `Upload image: ${dishName} (${category})`
    );

    return NextResponse.json({
      success: true,
      filename: result.path.split('/').pop(),
      filePath: result.path,
      fileUrl: result.url,
      size: result.sizeBytes,
      mimeType: file.type,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    console.error('Media upload error:', err);
    return NextResponse.json(
      { error: 'Upload failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}