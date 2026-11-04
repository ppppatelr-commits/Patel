import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { readStore, updateStore } from '@/lib/menu-store';
import { ensureDescriptionColumn } from '@/lib/db-migrate';
import { slugify, uniqueId, type LocalMenuStore } from '@/lib/menu-seed';
import {
  normalizeItems,
  insertItem,
  moveItem,
  removeItem,
  reorderCategoryItems,
} from '@/lib/sort-utils';
import type { MenuItem } from '@/types';

export const dynamic = 'force-dynamic';

function resolveImageUrl(
  store: LocalMenuStore,
  categoryId: string,
  filename: string,
  explicitUrl?: string | null
): string {
  if (explicitUrl) return explicitUrl;
  if (filename.includes('/')) return `/media/dishes/${filename.replace(/^\/+/, '')}`;
  const category = store.categories.find((c) => c.id === categoryId);
  return `/media/dishes/${category?.slug || 'general'}/${filename}`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureDescriptionColumn();
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    if (!supabase) {
      const store = await readStore();
      const allItems = normalizeItems(store.items);
      const items = categoryId
        ? allItems.filter((item) => item.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order)
        : allItems;
      return NextResponse.json(items);
    }

    let query = supabase.from('menu_items').select('*').order('sort_order', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Menu items API error:', err);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const colOk = await ensureDescriptionColumn();
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { category_id, name, price, image_url, image_filename, sort_order, is_available } = body;

    if (!category_id || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'Category and name are required' }, { status: 400 });
    }

    const trimmedName = String(name).trim();
    const targetSort = sort_order ? Number(sort_order) : undefined;

    if (!supabase) {
      let createdItem: MenuItem | null = null;

      await updateStore((store) => {
        const category = store.categories.find((c) => c.id === category_id);
        if (!category) throw new Error('Category not found');

        const filename = image_filename ? String(image_filename) : null;
        const newItem: MenuItem = {
          id: uniqueId(
            store.items.map((existing) => existing.id),
            `item-${category.slug}--${slugify(trimmedName)}`
          ),
          category_id,
          name: trimmedName,
          description: body.description ? String(body.description).trim() : null,
          price: Number(price) || 0,
          image_filename: filename,
          image_url: filename
            ? resolveImageUrl(store, category_id, filename, image_url)
            : null,
          sort_order: 0,
          is_available: is_available !== undefined ? is_available !== false : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        store.items = insertItem(store.items, newItem, targetSort);
        createdItem = store.items.find((i) => i.id === newItem.id) || newItem;
      });

      return NextResponse.json(createdItem);
    }

    // Supabase mode
    const { data: existingRows, error: fetchErr } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true });
    if (fetchErr) throw fetchErr;

    const existing: MenuItem[] = existingRows || [];
    const newItemObj: MenuItem = {
      id: crypto.randomUUID(),
      category_id,
      name: trimmedName,
      description: colOk ? (body.description ? String(body.description).trim() : null) : undefined,
      price: Number(price) || 0,
      image_url: image_url ?? null,
      image_filename: image_filename ?? null,
      sort_order: 0,
      is_available: is_available !== undefined ? is_available !== false : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedList = insertItem(existing, newItemObj, targetSort);

    // Upsert affected category items in Supabase
    const catItems = updatedList.filter((i) => i.category_id === category_id);
    for (const item of catItems) {
      await supabase.from('menu_items').upsert({
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        ...(colOk ? { description: item.description ?? null } : {}),
        price: item.price,
        image_url: item.image_url,
        image_filename: item.image_filename,
        sort_order: item.sort_order,
        is_available: item.is_available,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(catItems.find((i) => i.name === trimmedName) || newItemObj);
  } catch (err) {
    const message = (err as Error).message;
    const status = message === 'Category not found' ? 404 : 500;
    return NextResponse.json({ error: message || 'Failed to create menu item' }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const colOk = await ensureDescriptionColumn();
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Batch reorder support (drag & drop within category or overall)
    if (Array.isArray(body.reorder)) {
      const categoryId: string | undefined = body.category_id;
      const reorderList: { id: string; sort_order: number }[] = body.reorder;

      if (!supabase) {
        await updateStore((store) => {
          if (categoryId) {
            const orderedIds = reorderList
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((r) => r.id);
            store.items = reorderCategoryItems(store.items, categoryId, orderedIds);
          } else {
            // Group by category and reorder
            const byCategory = new Map<string, { id: string; sort_order: number }[]>();
            for (const entry of reorderList) {
              const item = store.items.find((i) => i.id === entry.id);
              if (item) {
                if (!byCategory.has(item.category_id)) byCategory.set(item.category_id, []);
                byCategory.get(item.category_id)!.push(entry);
              }
            }
            for (const [cId, list] of byCategory.entries()) {
              const orderedIds = list
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((r) => r.id);
              store.items = reorderCategoryItems(store.items, cId, orderedIds);
            }
          }
        });
        return NextResponse.json({ success: true });
      }

      // Supabase mode
      for (const entry of reorderList) {
        await supabase
          .from('menu_items')
          .update({ sort_order: Number(entry.sort_order) || 1 })
          .eq('id', entry.id);
      }
      return NextResponse.json({ success: true });
    }

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    if (!supabase) {
      let savedItem: MenuItem | null = null;

      await updateStore((store) => {
        const index = store.items.findIndex((item) => item.id === id);
        if (index === -1) throw new Error('Item not found');

        const current = store.items[index];
        const newCatId = updates.category_id;

        if (newCatId !== undefined && !store.categories.some((c) => c.id === newCatId)) {
          throw new Error('Category not found');
        }

        if (updates.price !== undefined) {
          const nextPrice = Number(updates.price);
          if (!Number.isFinite(nextPrice) || nextPrice < 0) {
            throw new Error('Invalid price');
          }
          current.price = nextPrice;
        }

        if (updates.name !== undefined) {
          current.name = String(updates.name).trim();
        }

        if (updates.description !== undefined) {
          current.description = updates.description ? String(updates.description).trim() : null;
        }

        if (updates.image_filename !== undefined) {
          const filename = updates.image_filename ? String(updates.image_filename) : null;
          current.image_filename = filename;
          if (!filename) {
            current.image_url = null;
          } else if (updates.image_url) {
            current.image_url = String(updates.image_url);
          } else {
            current.image_url = resolveImageUrl(store, newCatId || current.category_id, filename);
          }
        } else if (updates.image_url !== undefined) {
          current.image_url = updates.image_url ? String(updates.image_url) : null;
        }

        if (updates.is_available !== undefined) {
          current.is_available = updates.is_available !== false;
        }

        current.updated_at = new Date().toISOString();

        // Handle sort order and category movement
        const targetSort = updates.sort_order !== undefined ? Number(updates.sort_order) : undefined;
        store.items = moveItem(store.items, id, targetSort, newCatId);

        savedItem = store.items.find((i) => i.id === id) || current;
      });

      return NextResponse.json(savedItem);
    }

    // Supabase mode
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(id))) {
      return NextResponse.json(
        { error: 'This item is out of date. Please refresh the page to load the latest menu and try again.' },
        { status: 409 }
      );
    }

    // Handle missing `description` column gracefully (pre-migration databases).
    let updatePayload = { ...updates };
    if (!colOk && 'description' in updatePayload) {
      const { description, ...rest } = updatePayload as any;
      updatePayload = rest;
    }

    let { data, error } = await supabase
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error && /description/i.test(error.message || '')) {
      const { description, ...rest } = updatePayload as any;
      const retry = await supabase
        .from('menu_items')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = (err as Error).message;
    const status =
      message === 'Item not found' || message === 'Category not found'
        ? 404
        : message === 'Invalid price'
          ? 400
          : 500;
    return NextResponse.json({ error: message || 'Failed to update menu item' }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    if (!supabase) {
      let removed = false;
      await updateStore((store) => {
        const item = store.items.find((i) => i.id === id);
        if (!item) return;

        store.items = removeItem(store.items, id);
        removed = true;
      });

      if (!removed) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Supabase mode
    const { data: item } = await supabase.from('menu_items').select('*').eq('id', id).single();
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;

    // Renumber remaining items in that category
    if (item?.category_id) {
      const { data: catRemaining } = await supabase
        .from('menu_items')
        .select('*')
        .eq('category_id', item.category_id)
        .order('sort_order', { ascending: true });

      if (catRemaining) {
        for (let idx = 0; idx < catRemaining.length; idx++) {
          const it = catRemaining[idx];
          await supabase.from('menu_items').update({ sort_order: idx + 1 }).eq('id', it.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 });
  }
}
