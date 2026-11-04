import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { slugify, archiveExistingImage } from '@/lib/image-storage';

export const dynamic = 'force-dynamic';

async function ensureBucket(supabase: any) {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = (buckets || []).some((b: any) => b.name === 'menu-images');
    if (!exists) {
      await supabase.storage.createBucket('menu-images', { public: true });
    }
  } catch {
    // Best-effort; ignore.
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dishName = (formData.get('dish') as string) || 'dish';
    const category = (formData.get('category') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB' }, { status: 400 });
    }

    const categorySlug = category.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    const dishSlug = slugify(dishName);
    const filename = `${dishSlug}.webp`; // Always use .webp for consistency

    const dir = path.join(process.cwd(), 'public', 'media', 'dishes', categorySlug);
    const filePath = path.join(dir, filename);
    const fileUrl = `/media/dishes/${categorySlug}/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Keep the old image in the Media Library instead of destroying it (best-effort).
    const archivedUrl = await archiveExistingImage(fileUrl);

    // Try to persist locally (works on long-running servers; read-only on Vercel).
    let localSaved = false;
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, buffer);
      localSaved = true;
    } catch {
      localSaved = false;
    }

    // Supabase Storage (cloud-native persistence) — free tier.
    const supabase = createServerSupabaseClient() as any;
    let storageUrl: string | null = null;
    let storageError: string | null = null;
    if (supabase) {
      try {
        await ensureBucket(supabase);
        const storagePath = `dishes/${categorySlug}/${filename}`;
        const { error } = await supabase.storage.from('menu-images').upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });
        if (error) {
          storageError = error.message || String(error);
        } else {
          storageUrl = supabase.storage.from('menu-images').getPublicUrl(storagePath).data.publicUrl;
        }
      } catch (e) {
        storageError = (e as Error).message;
      }
    } else {
      storageError = 'Supabase is not configured on this deployment.';
    }

    // If neither local nor cloud storage succeeded, surface the failure with details.
    if (!localSaved && !storageUrl) {
      return NextResponse.json(
        {
          error: 'Upload failed: storage is read-only on this host and Supabase Storage is unavailable.',
          details: storageError || 'Unknown error',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      filename,
      filePath: localSaved ? filePath : (storageUrl || filePath),
      fileUrl: storageUrl || fileUrl,
      archivedUrl,
      size: file.size,
      mimeType: file.type,
      storageUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed', details: (err as Error).message }, { status: 500 });
  }
}