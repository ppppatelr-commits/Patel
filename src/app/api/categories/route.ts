import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { readStore, updateStore } from '@/lib/menu-store';
import { slugify, uniqueId } from '@/lib/menu-seed';
import {
  normalizeCategories,
  insertCategory,
  moveCategory,
  removeCategory,
  reorderCategories,
} from '@/lib/sort-utils';
import type { MenuCategory } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      const store = await readStore();
      const categories = normalizeCategories(store.categories);
      return NextResponse.json(categories);
    }

    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Categories API error:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { name, sort_order, image_url, is_active } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const trimmedName = String(name).trim();
    const slug = slugify(trimmedName);
    const requestedSort = sort_order ? Number(sort_order) : undefined;

    if (!supabase) {
      let createdCategory: MenuCategory | null = null;

      await updateStore((store) => {
        const id = uniqueId(
          store.categories.map((c) => c.id),
          `cat-${slug}`
        );

        const newCat: MenuCategory = {
          id,
          name: trimmedName,
          slug,
          sort_order: requestedSort || store.categories.length + 1,
          image_url: image_url || null,
          is_active: is_active !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        store.categories = insertCategory(store.categories, newCat, requestedSort);
        createdCategory = store.categories.find((c) => c.id === id) || newCat;
      });

      return NextResponse.json(createdCategory);
    }

    // Supabase cloud mode: maintain sequential ordering
    const { data: existingRows, error: fetchErr } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (fetchErr) throw fetchErr;

    const existing: MenuCategory[] = existingRows || [];
    const newCatObj: MenuCategory = {
      id: crypto.randomUUID(),
      name: trimmedName,
      slug,
      sort_order: requestedSort || existing.length + 1,
      image_url: image_url || null,
      is_active: is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedList = insertCategory(existing, newCatObj, requestedSort);

    // Upsert all categories with their new sort orders
    const { error: upsertErr } = await supabase.from('menu_categories').upsert(
      updatedList.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sort_order: c.sort_order,
        image_url: c.image_url,
        is_active: c.is_active,
        updated_at: new Date().toISOString(),
      }))
    );
    if (upsertErr) throw upsertErr;

    return NextResponse.json(updatedList.find((c) => c.slug === slug) || newCatObj);
  } catch (err) {
    console.error('Error creating category:', err);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Batch reorder support (drag & drop)
    if (Array.isArray(body.reorder)) {
      const orderedIds: string[] = body.reorder
        .slice()
        .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
        .map((item: any) => item.id);

      if (!supabase) {
        await updateStore((store) => {
          store.categories = reorderCategories(store.categories, orderedIds);
        });
        return NextResponse.json({ success: true });
      }

      const { data: existingRows } = await supabase
        .from('menu_categories')
        .select('*');
      const updatedList = reorderCategories(existingRows || [], orderedIds);

      for (const cat of updatedList) {
        await supabase
          .from('menu_categories')
          .update({ sort_order: cat.sort_order })
          .eq('id', cat.id);
      }
      return NextResponse.json({ success: true });
    }

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    if (!supabase) {
      let savedCategory: MenuCategory | null = null;

      await updateStore((store) => {
        const cat = store.categories.find((c) => c.id === id);
        if (!cat) throw new Error('Category not found');

        if (updates.name !== undefined) cat.name = String(updates.name).trim();
        if (updates.slug !== undefined) cat.slug = String(updates.slug).trim();
        if (updates.image_url !== undefined) cat.image_url = updates.image_url || null;
        if (updates.is_active !== undefined) cat.is_active = updates.is_active !== false;
        cat.updated_at = new Date().toISOString();

        if (updates.sort_order !== undefined) {
          const targetSort = Number(updates.sort_order);
          if (targetSort !== cat.sort_order) {
            store.categories = moveCategory(store.categories, id, targetSort);
          } else {
            store.categories = normalizeCategories(store.categories);
          }
        } else {
          store.categories = normalizeCategories(store.categories);
        }

        savedCategory = store.categories.find((c) => c.id === id) || cat;
      });

      return NextResponse.json(savedCategory);
    }

    // Supabase mode
    const { data: existingRows, error: fetchErr } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (fetchErr) throw fetchErr;

    const existing: MenuCategory[] = existingRows || [];
    const cat = existing.find((c) => c.id === id);
    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (updates.name !== undefined) cat.name = String(updates.name).trim();
    if (updates.slug !== undefined) cat.slug = String(updates.slug).trim();
    if (updates.image_url !== undefined) cat.image_url = updates.image_url || null;
    if (updates.is_active !== undefined) cat.is_active = updates.is_active !== false;
    cat.updated_at = new Date().toISOString();

    let updatedList = existing;
    if (updates.sort_order !== undefined) {
      const targetSort = Number(updates.sort_order);
      updatedList = moveCategory(existing, id, targetSort);
    } else {
      updatedList = normalizeCategories(existing);
    }

    const { error: upsertErr } = await supabase.from('menu_categories').upsert(
      updatedList.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sort_order: c.sort_order,
        image_url: c.image_url,
        is_active: c.is_active,
        updated_at: c.updated_at,
      }))
    );
    if (upsertErr) throw upsertErr;

    return NextResponse.json(updatedList.find((c) => c.id === id) || cat);
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(
      { error: message || 'Failed to update category' },
      { status: message === 'Category not found' ? 404 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    if (!supabase) {
      const removed = await updateStore((store) => {
        const index = store.categories.findIndex((category) => category.id === id);
        if (index === -1) return false;

        store.categories = removeCategory(store.categories, id);
        // Deleting a category also removes its dishes
        store.items = store.items.filter((item) => item.category_id !== id);
        return true;
      });

      if (!removed) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Delete category in Supabase
    const { error: deleteErr } = await supabase.from('menu_categories').delete().eq('id', id);
    if (deleteErr) throw deleteErr;

    // Renumber remaining categories sequentially
    const { data: remaining } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (remaining && remaining.length > 0) {
      const renumbered = normalizeCategories(remaining);
      for (const c of renumbered) {
        await supabase
          .from('menu_categories')
          .update({ sort_order: c.sort_order })
          .eq('id', c.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting category:', err);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
