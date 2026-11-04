import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { readStore } from '@/lib/menu-store';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
// Allow up to 60 seconds for backup generation (large ZIP)
export const maxDuration = 60;

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');
const DISHES_DIR  = path.join(process.cwd(), 'public', 'media', 'dishes');
const APP_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/backup  — list existing backups
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Local mode: scan backups directory
    try {
      await fs.mkdir(BACKUPS_DIR, { recursive: true });
      const files = await fs.readdir(BACKUPS_DIR);
      const metaFiles = files.filter((f) => f.endsWith('.json'));
      const records = await Promise.all(
        metaFiles.map(async (f) => {
          try {
            const raw = await fs.readFile(path.join(BACKUPS_DIR, f), 'utf8');
            return JSON.parse(raw);
          } catch { return null; }
        })
      );
      return NextResponse.json(
        records
          .filter(Boolean)
          .sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
      );
    } catch {
      return NextResponse.json([]);
    }
  } catch (err) {
    console.error('Backup GET error:', err);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/backup  — create a new backup ZIP and return it as a download
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const label: string = body.label || `Backup ${new Date().toLocaleString('en-IN')}`;

    const supabase = createServerSupabaseClient();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
    const filename = `patel-backup-${timestamp}.zip`;

    // ── 1. Load all data ──────────────────────────────────────────────────
    let categories: any[] = [];
    let items: any[] = [];
    let settings: any = {};
    let imageHistory: any[] = [];

    if (supabase) {
      const [catRes, itemRes, settRes, histRes] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*').order('category_id').order('sort_order'),
        supabase.from('restaurant_settings').select('*').limit(1),
        supabase.from('image_history').select('*').order('replaced_at', { ascending: false }),
      ]);
      categories    = catRes.data  || [];
      items         = itemRes.data || [];
      settings      = settRes.data?.[0] || {};
      imageHistory  = histRes.data || [];
    } else {
      const store = await readStore();
      categories   = store.categories;
      items        = store.items;
      settings     = store.settings;
      // Load local history
      try {
        const raw = await fs.readFile(
          path.join(process.cwd(), 'data', 'image-history.json'), 'utf8'
        );
        imageHistory = JSON.parse(raw);
      } catch { imageHistory = []; }
    }

    // ── 2. Build ZIP ──────────────────────────────────────────────────────
    const zip = new JSZip();

    // Database export (sanitized — no secrets)
    const dbExport = {
      version: APP_VERSION,
      exported_at: now.toISOString(),
      label,
      categories,
      items,
      settings: {
        ...settings,
        // Remove any potential sensitive keys just in case
        supabase_url: undefined,
        service_role_key: undefined,
      },
    };
    zip.file('db/database.json', JSON.stringify(dbExport, null, 2));
    zip.file('db/image-history.json', JSON.stringify(imageHistory, null, 2));

    // ── 3. Pack dish images ───────────────────────────────────────────────
    let imageCount = 0;
    try {
      const catFolders = await fs.readdir(DISHES_DIR);
      for (const catFolder of catFolders) {
        const catPath = path.join(DISHES_DIR, catFolder);
        const stat = await fs.stat(catPath);
        if (!stat.isDirectory()) continue;

        const dishFiles = await fs.readdir(catPath);
        for (const dishFile of dishFiles) {
          if (!/\.(webp|png|jpe?g)$/i.test(dishFile)) continue;
          try {
            const buf = await fs.readFile(path.join(catPath, dishFile));
            zip.file(`images/dishes/${catFolder}/${dishFile}`, buf);
            imageCount++;
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { /* no images dir */ }

    // ── 4. Manifest ───────────────────────────────────────────────────────
    const manifest = {
      version: APP_VERSION,
      label,
      created_at: now.toISOString(),
      counts: {
        categories: categories.length,
        items: items.length,
        images: imageCount,
        image_history: imageHistory.length,
      },
      filename,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // ── 5. Generate ZIP buffer ────────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const sizeBytes = zipBuffer.length;

    // ── 6. Save metadata record ───────────────────────────────────────────
    const backupRecord = {
      id: crypto.randomUUID(),
      created_at: now.toISOString(),
      label,
      filename,
      size_bytes: sizeBytes,
      category_count: categories.length,
      item_count: items.length,
      image_count: imageCount,
      status: 'complete' as const,
      manifest,
    };

    if (supabase) {
      try {
        await supabase.from('backups').insert(backupRecord);
      } catch (e) {
        console.error(e);
      }
    } else {
      // Save meta locally
      try {
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        await fs.writeFile(
          path.join(BACKUPS_DIR, `${backupRecord.id}.json`),
          JSON.stringify(backupRecord, null, 2)
        );
        // Also save the zip locally so it can be re-downloaded
        await fs.writeFile(path.join(BACKUPS_DIR, filename), zipBuffer);
      } catch { /* ignore local save errors */ }
    }

    // ── 7. Return ZIP as download ─────────────────────────────────────────
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(sizeBytes),
        'X-Backup-Id': backupRecord.id,
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

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/backup?id=xxx  — delete a backup record
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createServerSupabaseClient();
    if (supabase) {
      await supabase.from('backups').delete().eq('id', id);
    } else {
      try {
        // Try to delete meta file and zip
        const metaPath = path.join(BACKUPS_DIR, `${id}.json`);
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        await fs.unlink(metaPath).catch(() => {});
        await fs.unlink(path.join(BACKUPS_DIR, meta.filename)).catch(() => {});
      } catch { /* not found */ }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}
