import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isSafeDishesPath } from '@/lib/image-storage';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const relSubPath = segments.join('/');
    const relPath = `media/${relSubPath}`;

    // 1. Safety check
    if (relPath.includes('..') || relPath.includes('~')) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const supabase = createServerSupabaseClient() as any;

    // 2. Prefer Supabase Storage when configured — this is where replaced /
    //    uploaded images live on hosted (Vercel) environments, since the
    //    baked-in disk files are read-only and cannot be overwritten.
    if (supabase) {
      try {
        const { data, error } = await supabase.storage.from('menu-images').download(relSubPath);
        if (data && !error) {
          const arrayBuf = await data.arrayBuffer();
          const ext = path.extname(relSubPath).toLowerCase();
          let contentType = 'image/webp';
          if (ext === '.png') contentType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.svg') contentType = 'image/svg+xml';

          return new NextResponse(Buffer.from(arrayBuf), {
            headers: {
              'Content-Type': contentType,
              // Never cache: replaced images must reflect immediately.
              'Cache-Control': 'no-store',
            },
          });
        }
      } catch {
        // Fall through to disk
      }
    }

    // 3. Fall back to the baked-in file on disk.
    const localFullPath = path.join(process.cwd(), 'public', 'media', relSubPath);
    try {
      const fileBuffer = await fs.readFile(localFullPath);
      const ext = path.extname(localFullPath).toLowerCase();
      let contentType = 'image/webp';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.svg') contentType = 'image/svg+xml';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      // Local file not found on disk
    }

    return new NextResponse('Media not found', { status: 404 });
  } catch (err) {
    return new NextResponse('Error serving media', { status: 500 });
  }
}