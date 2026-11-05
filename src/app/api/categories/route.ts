/**
 * Categories API — GitHub-backed.
 * Reads/writes data/categories.json through the private GitHub repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readCategories,
  writeCategories,
  MenuCategory,
} from '@/lib/data-store';
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

export async function GET() {
  try {
    const data = await readCategories();
    const categories = data?.categories || [];
    return NextResponse.json(categories);
  } catch (err) {
    console.error('Categories GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sort_order, image_url, is_active, description } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    const slug = slugify(trimmedName);
    const requestedSort = sort_order ? Number(sort_order) : undefined;

    const data = (await readCategories()) || { categories: [] };
    const existing = data.categories;

    // Check duplicate slug
    if (existing.some((c) => c.slug === slug)) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 400 }
      );
    }

    const newCat: MenuCategory = {
      id: uuidv4(),
      name: trimmedName,
      slug,
      sortOrder: requestedSort || existing.length + 1,
      image: image_url || null,
      isActive: is_active !== false,
      description: description || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [...existing, newCat].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    // Renumber sequentially
    updatedList.forEach((c, idx) => (c.sortOrder = idx + 1));

    await writeCategories({ categories: updatedList });

    const created = updatedList.find((c) => c.id === newCat.id) || newCat;
    return NextResponse.json(created);
  } catch (err) {
    console.error('Categories POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Batch reorder
    if (Array.isArray(body.reorder)) {
      const data = (await readCategories()) || { categories: [] };
      const orderedIds: string[] = body.reorder
        .slice()
        .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((item: any) => item.id);

      const catMap = new Map(data.categories.map((c) => [c.id, c]));
      const result: MenuCategory[] = [];
      for (const id of orderedIds) {
        const cat = catMap.get(id);
        if (cat) result.push(cat);
      }
      for (const remaining of catMap.values()) {
        if (!result.find((c) => c.id === remaining.id)) result.push(remaining);
      }
      result.forEach((c, idx) => (c.sortOrder = idx + 1));

      await writeCategories({ categories: result });
      return NextResponse.json({ success: true });
    }

    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const data = (await readCategories()) || { categories: [] };
    const catIndex = data.categories.findIndex((c) => c.id === id);
    if (catIndex === -1) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const cat = { ...data.categories[catIndex] };

    if (updates.name !== undefined) cat.name = String(updates.name).trim();
    if (updates.slug !== undefined) cat.slug = String(updates.slug).trim();
    if (updates.image_url !== undefined) cat.image = updates.image_url || null;
    if (updates.description !== undefined) cat.description = updates.description || null;
    if (updates.is_active !== undefined) cat.isActive = updates.is_active !== false;
    cat.updatedAt = new Date().toISOString();

    if (updates.sort_order !== undefined) {
      const targetSort = Number(updates.sort_order);
      if (targetSort !== cat.sortOrder) {
        data.categories.splice(catIndex, 1);
        const insertIdx = Math.max(0, Math.min(targetSort - 1, data.categories.length));
        data.categories.splice(insertIdx, 0, cat);
        data.categories.forEach((c, idx) => (c.sortOrder = idx + 1));
      } else {
        data.categories[catIndex] = cat;
      }
    } else {
      data.categories[catIndex] = cat;
      data.categories.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    await writeCategories({ categories: data.categories });
    const saved = data.categories.find((c) => c.id === id) || cat;
    return NextResponse.json(saved);
  } catch (err) {
    console.error('Categories PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update category' },
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
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const data = (await readCategories()) || { categories: [] };
    const initialLength = data.categories.length;
    data.categories = data.categories.filter((c) => c.id !== id);

    if (data.categories.length === initialLength) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Renumber remaining
    data.categories.sort((a, b) => a.sortOrder - b.sortOrder);
    data.categories.forEach((c, idx) => (c.sortOrder = idx + 1));

    await writeCategories({ categories: data.categories });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Categories DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}