/**
 * Restore API — GitHub-backed.
 * Uploads and restores a backup ZIP into the GitHub content repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  writeMenu,
  writeCategories,
  writeRestaurant,
  writeSettings,
  MenuItem,
  MenuCategory,
} from '@/lib/data-store';
import { uploadDishImage } from '@/lib/image-store';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Must send multipart/form-data with a "file" field' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Only .zip backup files are accepted' }, { status: 400 });
    }

    // ── 1. Read and parse ZIP ──
    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch {
      return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
    }

    // ── 2. Validate structure ──
    const manifestFile = zip.file('manifest.json');
    const dbFile = zip.file('db/database.json');

    if (!manifestFile || !dbFile) {
      return NextResponse.json(
        { error: 'Invalid backup: missing manifest.json or db/database.json' },
        { status: 400 }
      );
    }

    const manifest = JSON.parse(await manifestFile.async('string'));
    const dbExport = JSON.parse(await dbFile.async('string'));

    if (!Array.isArray(dbExport.categories) || !Array.isArray(dbExport.items)) {
      return NextResponse.json({ error: 'Backup database.json is malformed' }, { status: 400 });
    }

    // ── 3. Restore categories ──
    const categories: MenuCategory[] = dbExport.categories.map((c: any) => ({
      id: c.id || `cat-${slugify(c.name)}`,
      name: c.name,
      slug: c.slug || slugify(c.name),
      description: c.description || null,
      image: c.image || null,
      sortOrder: c.sort_order ?? c.sortOrder ?? 0,
      isActive: c.is_active !== false,
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
    }));

    await writeCategories({ categories });

    // ── 4. Restore items ──
    const categoryMap = new Map(categories.map((c) => [c.id, c.id]));
    // Also map by name for items that reference category by name
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

    const items: MenuItem[] = dbExport.items.map((it: any) => {
      // Find category ID - try by category_id first, then by name
      let categoryId = it.category_id || it.categoryId;
      if (!categoryId && it.category_name) {
        categoryId = categoryByName.get(it.category_name);
      }
      if (!categoryId) {
        categoryId = categories[0]?.id || '';
      }

      return {
        id: it.id || `item-${slugify(it.name)}-${Math.random().toString(36).slice(2, 9)}`,
        categoryId,
        name: it.name,
        description: it.description || null,
        price: it.price || 0,
        image: it.image_url || it.image || null,
        is_available: it.is_available !== false,
        sortOrder: it.sort_order ?? it.sortOrder ?? 0,
        createdAt: it.created_at || it.createdAt || new Date().toISOString(),
        updatedAt: it.updated_at || it.updatedAt || new Date().toISOString(),
      };
    });

    await writeMenu({ items });

    // ── 5. Restore restaurant settings ──
    if (dbExport.restaurant) {
      await writeRestaurant({
        restaurant: {
          name: dbExport.restaurant.name || 'Patel Restaurant',
          logo: dbExport.restaurant.logo || '/patel-logo-gold.png',
          address: dbExport.restaurant.address || null,
          phone: dbExport.restaurant.phone || null,
          whatsapp: dbExport.restaurant.whatsapp || null,
          openingHours: dbExport.restaurant.openingHours || null,
          contactEmail: dbExport.restaurant.contactEmail || null,
          socialLinks: dbExport.restaurant.socialLinks || null,
          createdAt: dbExport.restaurant.createdAt || new Date().toISOString(),
          updatedAt: dbExport.restaurant.updatedAt || new Date().toISOString(),
        },
      });
    }

    // ── 6. Restore settings ──
    if (dbExport.settings) {
      await writeSettings({
        settings: {
          currency: dbExport.settings.currency || 'INR',
          theme: dbExport.settings.theme || 'dark',
          menuLayout: dbExport.settings.menuLayout || 'grid',
          orderingSettings: dbExport.settings.orderingSettings || {},
          whatsappOrdering: dbExport.settings.whatsappOrdering !== false,
          imageSettings: dbExport.settings.imageSettings || {},
          createdAt: dbExport.settings.createdAt || new Date().toISOString(),
          updatedAt: dbExport.settings.updatedAt || new Date().toISOString(),
        },
      });
    }

    // ── 7. Restore image files from ZIP ──
    let imagesRestored = 0;
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

      try {
        const buf = await zip.files[zipPath].async('nodebuffer');
        // Determine mime type
        const ext = filename.toLowerCase();
        let mimeType = 'image/webp';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';

        // Upload to GitHub (this will convert to WebP and optimize)
        await uploadDishImage(
          catFolder,
          filename.replace(/\.(webp|png|jpe?g|gif)$/i, ''),
          buf,
          mimeType,
          `Restore image: ${filename} (${catFolder})`
        );
        imagesRestored++;
      } catch {
        /* skip images that fail to restore */
      }
    }

    return NextResponse.json({
      success: true,
      restored: {
        categories: categories.length,
        items: items.length,
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