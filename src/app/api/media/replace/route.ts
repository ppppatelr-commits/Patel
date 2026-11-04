import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isSafeDishesPath, archiveExistingImage } from '@/lib/image-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawPath = String(formData.get('path') || '');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!rawPath || !isSafeDishesPath(rawPath)) {
      return NextResponse.json({ error: 'A valid image path is required.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB' }, { status: 400 });
    }

    const clean = rawPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^public\//, '');
    const fullPath = path.join(process.cwd(), 'public', clean);
    const buffer = Buffer.from(await file.arrayBuffer());

    await fs.mkdir(path.dirname(fullPath), { recursive: true }).catch(() => {});

    // Keep the old image in the Media Library instead of destroying it (best-effort).
    const archivedUrl = await archiveExistingImage(rawPath);

    // Try to persist locally (best-effort on read-only hosts).
    let localSaved = false;
    try {
      await fs.writeFile(fullPath, buffer);
      localSaved = true;
    } catch {
      localSaved = false;
    }

    // Keep Supabase Storage in sync when it is configured.
    const supabase = createServerSupabaseClient() as any;
    let storageUrl: string | null = null;
    let storageError: string | null = null;
    if (supabase) {
      try {
        try {
          const { data: buckets } = await supabase.storage.listBuckets();
          if (!(buckets || []).some((b: any) => b.name === 'menu-images')) {
            await supabase.storage.createBucket('menu-images', { public: true });
          }
        } catch { /* ignore */ }
        const storagePath = clean.replace(/^media\/dishes\//, 'dishes/');
        const { error } = await supabase.storage.from('menu-images').upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });
        if (error) {
          storageError = error.message || String(error);
        } else {
          storageUrl = supabase.storage.from('menu-images').getPublicUrl(storagePath).data.publicUrl;
          // Propagate: update all dishes that use this image so they show the new image.
          try {
            await supabase
              .from('menu_items')
              .update({ image_url: storageUrl })
              .eq('image_filename', path.basename(clean));
          } catch { /* best-effort */ }
        }
      } catch (e) {
        storageError = (e as Error).message;
      }
    } else {
      storageError = 'Supabase is not configured on this deployment.';
    }

    if (!localSaved && !storageUrl) {
      return NextResponse.json(
        { error: 'Replace failed: storage is read-only on this host and Supabase Storage is unavailable.', details: storageError || 'Unknown error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileUrl: storageUrl || `/${clean}`,
      filename: path.basename(clean),
      archivedUrl,
      size: file.size,
      mimeType: file.type,
      storageUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Replace failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}