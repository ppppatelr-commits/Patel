import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { writeStore, readStore } from '@/lib/menu-store';
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // restore can take longer

const DISHES_DIR   = path.join(process.cwd(), 'public', 'media', 'dishes');
const DATA_DIR     = path.join(process.cwd(), 'data');
const BACKUPS_DIR  = path.join(DATA_DIR, 'backups');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/restore  — upload and restore a backup ZIP
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Must send multipart/form-data with a "file" field' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Only .zip backup files are accepted' }, { status: 400 });
    }

    // ── 1. Read and parse ZIP ─────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch {
      return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
    }

    // ── 2. Validate structure ─────────────────────────────────────────────
    const manifestFile = zip.file('manifest.json');
    const dbFile       = zip.file('db/database.json');

    if (!manifestFile || !dbFile) {
      return NextResponse.json(
        { error: 'Invalid backup: missing manifest.json or db/database.json' },
        { status: 400 }
      );
    }

    const manifest   = JSON.parse(await manifestFile.async('string'));
    const dbExport   = JSON.parse(await dbFile.async('string'));

    // Basic validation
    if (!Array.isArray(dbExport.categories) || !Array.isArray(dbExport.items)) {
      return NextResponse.json({ error: 'Backup database.json is malformed' }, { status: 400 });
    }

    // ── 3. Safety: create auto-backup before restoring ────────────────────
    // (fire-and-forget — don't fail restore if this fails)
    createAutoBackup().catch(console.error);

    const supabase = createServerSupabaseClient();

    // ── 4A. Supabase mode ─────────────────────────────────────────────────
    if (supabase) {
      // Clear existing data
      await supabase.from('menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('menu_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Re-insert categories
      if (dbExport.categories.length > 0) {
        const catRows = dbExport.categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          sort_order: c.sort_order,
          image_url: c.image_url || null,
          is_active: c.is_active !== false,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        const { error } = await supabase.from('menu_categories').upsert(catRows);
        if (error) throw new Error(`Categories restore failed: ${error.message}`);
      }

      // Re-insert items
      if (dbExport.items.length > 0) {
        const BATCH = 50;
        for (let i = 0; i < dbExport.items.length; i += BATCH) {
          const batch = dbExport.items.slice(i, i + BATCH).map((it: any) => ({
            id: it.id,
            category_id: it.category_id,
            name: it.name,
            price: it.price,
            image_url: it.image_url || null,
            image_filename: it.image_filename || null,
            sort_order: it.sort_order || 0,
            is_available: it.is_available !== false,
            created_at: it.created_at,
            updated_at: it.updated_at,
          }));
          const { error } = await supabase.from('menu_items').upsert(batch);
          if (error) throw new Error(`Items restore batch ${i} failed: ${error.message}`);
        }
      }

      // Restore image history if present
      const histFile = zip.file('db/image-history.json');
      if (histFile) {
        try {
          const history = JSON.parse(await histFile.async('string'));
          if (Array.isArray(history) && history.length > 0) {
            // Clear and re-insert
            await supabase.from('image_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const histRows = history.map((h: any) => ({
              id: h.id,
              menu_item_id: h.menu_item_id,
              replaced_at: h.replaced_at,
              previous_url: h.previous_url,
              previous_filename: h.previous_filename || null,
              is_current: h.is_current || false,
              replaced_by: h.replaced_by || null,
              notes: h.notes || null,
            }));
            const BATCH = 50;
            for (let i = 0; i < histRows.length; i += BATCH) {
            try {
              await supabase.from('image_history').upsert(histRows.slice(i, i + BATCH));
            } catch { /* non-fatal */ }
            }
          }
        } catch { /* non-fatal */ }
      }
    } else {
      // ── 4B. Local mode ───────────────────────────────────────────────────
      await writeStore({
        version: 1,
        settings: dbExport.settings || {},
        categories: dbExport.categories,
        items: dbExport.items,
      });

      // Restore image history
      const histFile = zip.file('db/image-history.json');
      if (histFile) {
        try {
          const history = JSON.parse(await histFile.async('string'));
          if (Array.isArray(history)) {
            await fs.mkdir(DATA_DIR, { recursive: true });
            await fs.writeFile(
              path.join(DATA_DIR, 'image-history.json'),
              JSON.stringify(history, null, 2)
            );
          }
        } catch { /* non-fatal */ }
      }
    }

    // ── 5. Restore image files ────────────────────────────────────────────
    // Only on local/non-serverless environments
    let imagesRestored = 0;
    try {
      // Check if we can write to public dir
      await fs.mkdir(DISHES_DIR, { recursive: true });
      const testFile = path.join(DISHES_DIR, '.write-test');
      await fs.writeFile(testFile, '');
      await fs.unlink(testFile);

      // We can write — restore images from ZIP
      const imageFiles = Object.keys(zip.files).filter(
        (f) => f.startsWith('images/dishes/') && !f.endsWith('/')
      );

      for (const zipPath of imageFiles) {
        // Security: prevent path traversal
        const rel = zipPath.replace('images/dishes/', '');
        if (rel.includes('..') || rel.includes('~') || rel.startsWith('/')) continue;

        const parts = rel.split('/');
        if (parts.length !== 2) continue; // must be category/filename.ext

        const [catFolder, filename] = parts;
        if (!filename.match(/\.(webp|png|jpe?g)$/i)) continue;

        const destDir = path.join(DISHES_DIR, catFolder);
        await fs.mkdir(destDir, { recursive: true });
        const buf = await zip.files[zipPath].async('nodebuffer');
        await fs.writeFile(path.join(destDir, filename), buf);
        imagesRestored++;
      }
    } catch {
      // Read-only FS (Vercel) — images stay as URLs in DB, skip file restore
    }

    return NextResponse.json({
      success: true,
      restored: {
        categories: dbExport.categories.length,
        items: dbExport.items.length,
        images: imagesRestored,
      },
      manifest,
    });
  } catch (err) {
    console.error('Restore error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Restore failed' },
      { status: 500 }
    );
  }
}

/** Creates a quick safety backup before a restore (local mode only). */
async function createAutoBackup() {
  try {
    const store = await readStore();
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(BACKUPS_DIR, `auto-pre-restore-${ts}.json`),
      JSON.stringify({
        version: '1.0.0',
        created_at: new Date().toISOString(),
        label: 'Auto pre-restore safety backup',
        categories: store.categories,
        items: store.items,
      }, null, 2)
    );
  } catch { /* non-fatal */ }
}

