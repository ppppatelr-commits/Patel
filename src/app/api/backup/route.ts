/**
 * Backup API — GitHub-backed.
 * Creates and lists backups of menu data from the private GitHub repository.
 * Images are bundled from GitHub content repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readMenu,
  readCategories,
  readRestaurant,
  readSettings,
} from '@/lib/data-store';
import { listAllImages } from '@/lib/image-store';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const APP_VERSION = '1.0.0';

// GET /api/backup — list existing backups
export async function GET() {
  try {
    // In GitHub-backed mode, backups are not stored as separate records.
    // GitHub-backed mode: backups are created on-demand via POST.
    return NextResponse.json([]);
  } catch (err) {
    console.error('Backup GET error:', err);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

// POST /api/backup — create a new backup ZIP and return it as a download
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const label: string = body.label || `Backup ${new Date().toLocaleString('en-IN')}`;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
    const filename = `patel-backup-${timestamp}.zip`;

    // ── 1. Load all data from GitHub ──
    const [menuData, categoriesData, restaurantData, settingsData] =
      await Promise.all([
        readMenu(),
        readCategories(),
        readRestaurant(),
        readSettings(),
      ]);

    const categories = categoriesData?.categories || [];
    const items = menuData?.items || [];
    const settings = settingsData?.settings || {};
    const restaurant = restaurantData?.restaurant || {};

    // ── 2. Build ZIP ──
    const zip = new JSZip();

    const dbExport = {
      version: APP_VERSION,
      exported_at: now.toISOString(),
      label,
      categories,
      items,
      restaurant,
      settings,
    };
    zip.file('db/database.json', JSON.stringify(dbExport, null, 2));

    // ── 3. Pack dish images from GitHub ──
    let imageCount = 0;
    try {
      const allImages = await listAllImages();
      for (const img of allImages) {
        if (!img.downloadUrl) continue;
        try {
          const imgResp = await fetch(img.downloadUrl);
          if (imgResp.ok) {
            const buf = Buffer.from(await imgResp.arrayBuffer());
            zip.file(`images/dishes/${img.path}`, buf);
            imageCount++;
          }
        } catch {
          /* skip unreadable images */
        }
      }
    } catch {
      /* no images */
    }

    // ── 4. Manifest ──
    const manifest = {
      version: APP_VERSION,
      label,
      created_at: now.toISOString(),
      counts: {
        categories: categories.length,
        items: items.length,
        images: imageCount,
      },
      filename,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // ── 5. Generate ZIP buffer ──
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const sizeBytes = zipBuffer.length;

    // ── 6. Return ZIP as download ──
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(sizeBytes),
        'X-Category-Count': String(categories.length),
        'X-Item-Count': String(items.length),
        'X-Image-Count': String(imageCount),
      },
    });
  } catch (err) {
    console.error('Backup POST error:', err);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

// DELETE /api/backup?id=xxx — not applicable in GitHub-backed mode
export async function DELETE() {
  return NextResponse.json({ success: true, message: 'Backups are managed via GitHub.' });
}