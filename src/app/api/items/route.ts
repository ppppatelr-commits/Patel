/**
 * Menu Items API — GitHub-backed.
 * Reads/writes data/menu.json through the private GitHub repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readMenu,
  writeMenu,
  MenuItem,
  readCategories,
} from '@/lib/data-store';
import { ensureSeeded } from '@/lib/seed-db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    const data = await readMenu();
    let items = data?.items || [];

    if (categoryId) {
      items = items.filter((item) => item.categoryId === categoryId);
    }

    // Sort by category order then item sortOrder
    const categories = await readCategories();
    const catMap = new Map(
      categories?.categories.map((c) => [c.id, c.sortOrder ?? 999]) || []
    );

    items.sort((a, b) => {
      const catA = catMap.get(a.categoryId) ?? 999;
      const catB = catMap.get(b.categoryId) ?? 999;
      if (catA !== catB) return catA - catB;
      return a.sortOrder - b.sortOrder;
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error('Items GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      categoryId: rawCategoryId,
      category_id,
      name,
      price,
      image_url,
      image_filename,
      sort_order,
      is_available,
      description,
    } = body;
    const categoryId = rawCategoryId || category_id;

    if (!categoryId || !name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'Category and name are required' },
        { status: 400 }
      );
    }

    // Verify category exists
    const cats = await readCategories();
    if (!cats?.categories.some((c) => c.id === categoryId)) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    const targetSort = sort_order ? Number(sort_order) : undefined;

    const data = (await readMenu()) || { items: [] };
    const existing = data.items;

    const newItem: MenuItem = {
      id: uuidv4(),
      categoryId,
      name: trimmedName,
      description: description ? String(description).trim() : null,
      price: Number(price) || 0,
      image: image_url || image_filename || null,
      isAvailable: is_available !== undefined ? is_available !== false : true,
      sortOrder: targetSort || existing.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [...existing, newItem];
    // Renumber within category
    const catItems = updatedList
      .filter((i) => i.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    catItems.forEach((it, idx) => (it.sortOrder = idx + 1));
    const otherItems = updatedList.filter((i) => i.categoryId !== categoryId);
    const finalList = [...otherItems, ...catItems];

    await writeMenu({ items: finalList });

    const created = finalList.find((i) => i.id === newItem.id) || newItem;
    return NextResponse.json(created);
  } catch (err) {
    console.error('Items POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Batch reorder
    if (Array.isArray(body.reorder)) {
      const data = (await readMenu()) || { items: [] };
      const categoryId = body.category_id;

      const reorderList = body.reorder as { id: string; sort_order: number }[];

      if (categoryId) {
        const orderedIds = reorderList
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => r.id);
        const catItems = data.items.filter((i) => i.categoryId === categoryId);
        const catMap = new Map(catItems.map((i) => [i.id, i]));
        const result: MenuItem[] = [];
        for (const id of orderedIds) {
          const item = catMap.get(id);
          if (item) result.push(item);
        }
        for (const remaining of catMap.values()) {
          if (!result.find((i) => i.id === remaining.id)) result.push(remaining);
        }
        result.forEach((it, idx) => (it.sortOrder = idx + 1));

        // Replace category items in data
        const otherItems = data.items.filter((i) => i.categoryId !== categoryId);
        data.items = [...otherItems, ...result];
      } else {
        // Reorder all
        const orderedIds = reorderList
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => r.id);
        const itemMap = new Map(data.items.map((i) => [i.id, i]));
        const result: MenuItem[] = [];
        for (const id of orderedIds) {
          const item = itemMap.get(id);
          if (item) result.push(item);
        }
        data.items = result;
      }

      await writeMenu({ items: data.items });
      return NextResponse.json({ success: true });
    }

    const { id, ...rawUpdates } = body;
    const updates = { ...rawUpdates };
    if (updates.category_id !== undefined && updates.categoryId === undefined) {
      updates.categoryId = updates.category_id;
    }
    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    const data = (await readMenu()) || { items: [] };
    const itemIndex = data.items.findIndex((i) => i.id === id);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const current = { ...data.items[itemIndex] };

    if (updates.price !== undefined) {
      const nextPrice = Number(updates.price);
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      }
      current.price = nextPrice;
    }
    if (updates.name !== undefined) current.name = String(updates.name).trim();
    if (updates.description !== undefined)
      current.description = updates.description
        ? String(updates.description).trim()
        : null;
    if (updates.categoryId !== undefined) {
      const cats = await readCategories();
      if (!cats?.categories.some((c) => c.id === updates.categoryId)) {
        return NextResponse.json({ error: 'Category not found' }, { status: 400 });
      }
      current.categoryId = updates.categoryId;
    }
    if (updates.image !== undefined) current.image = updates.image || null;
    if (updates.image_url !== undefined && updates.image === undefined) {
      // Strip leading slash to store as GitHub path (media/dishes/...)
      const url = updates.image_url || '';
      current.image = url.startsWith('/') ? url.slice(1) : url || null;
    }
    if (updates.image_filename !== undefined && updates.image === undefined && updates.image_url === undefined) {
      const catSlug = (await readCategories())?.categories.find(c => c.id === current.categoryId)?.slug || 'general';
      current.image = updates.image_filename
        ? (updates.image_filename.includes('/') ? updates.image_filename : `media/dishes/${catSlug}/${updates.image_filename}`)
        : null;
    }
    if (updates.is_available !== undefined)
      current.isAvailable = updates.is_available !== false;
    current.updatedAt = new Date().toISOString();

    const targetSort =
      updates.sort_order !== undefined ? Number(updates.sort_order) : undefined;
    const newCatId = updates.categoryId || current.categoryId;

    // Remove from current position
    data.items.splice(itemIndex, 1);

    // Insert into new category at target sort
    const catItems = data.items
      .filter((i) => i.categoryId === newCatId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const insertIdx =
      targetSort !== undefined
        ? Math.max(0, Math.min(targetSort - 1, catItems.length))
        : catItems.length;
    current.categoryId = newCatId;
    current.sortOrder = insertIdx + 1;
    catItems.splice(insertIdx, 0, current);
    catItems.forEach((it, idx) => (it.sortOrder = idx + 1));

    const otherItems = data.items.filter((i) => i.categoryId !== newCatId);
    data.items = [...otherItems, ...catItems];

    await writeMenu({ items: data.items });
    const saved = data.items.find((i) => i.id === id) || current;
    return NextResponse.json(saved);
  } catch (err) {
    console.error('Items PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update menu item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    const data = (await readMenu()) || { items: [] };
    const item = data.items.find((i) => i.id === id);
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    data.items = data.items.filter((i) => i.id !== id);

    // Renumber remaining items in that category
    const catItems = data.items
      .filter((i) => i.categoryId === item.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    catItems.forEach((it, idx) => (it.sortOrder = idx + 1));

    const otherItems = data.items.filter((i) => i.categoryId !== item.categoryId);
    data.items = [...otherItems, ...catItems];

    await writeMenu({ items: data.items });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Items DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 }
    );
  }
}