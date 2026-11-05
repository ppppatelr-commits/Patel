/**
 * Image History API — GitHub-backed.
 * Stores image replacement history in data/image-history.json
 * in the private GitHub content repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGitHubFile, putGitHubFile } from '@/lib/github';
import type { ImageHistoryEntry } from '@/types';

const HISTORY_FILE = 'data/image-history.json';

export const dynamic = 'force-dynamic';

async function readHistory(): Promise<ImageHistoryEntry[]> {
  try {
    const data = await getGitHubFile<ImageHistoryEntry[]>(HISTORY_FILE);
    return data || [];
  } catch {
    return [];
  }
}

async function writeHistory(entries: ImageHistoryEntry[]): Promise<void> {
  await putGitHubFile(HISTORY_FILE, entries, 'Update image history');
}

// GET /api/image-history?item_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const history = await readHistory();
    const filtered = history
      .filter((h) => h.menu_item_id === itemId)
      .sort((a, b) => new Date(b.replaced_at).getTime() - new Date(a.replaced_at).getTime());

    return NextResponse.json(filtered);
  } catch (err) {
    console.error('Image history GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch image history' }, { status: 500 });
  }
}

// POST /api/image-history
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { menu_item_id, previous_url, previous_filename, replaced_by, notes } = body;

    if (!menu_item_id || !previous_url) {
      return NextResponse.json(
        { error: 'menu_item_id and previous_url are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const entry: ImageHistoryEntry = {
      id: crypto.randomUUID(),
      menu_item_id,
      replaced_at: now,
      previous_url,
      previous_filename: previous_filename || null,
      storage_path: null,
      is_current: false,
      replaced_by: replaced_by || null,
      notes: notes || null,
    };

    const history = await readHistory();
    history.unshift(entry);
    // Keep at most 50 entries per item
    const kept = history
      .filter((h) => h.menu_item_id !== menu_item_id)
      .concat(history.filter((h) => h.menu_item_id === menu_item_id).slice(0, 50));

    await writeHistory(kept);
    return NextResponse.json(entry);
  } catch (err) {
    console.error('Image history POST error:', err);
    return NextResponse.json({ error: 'Failed to record image history' }, { status: 500 });
  }
}

// DELETE /api/image-history?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const history = await readHistory();
    const filtered = history.filter((h) => h.id !== id);
    await writeHistory(filtered);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Image history DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete history entry' }, { status: 500 });
  }
}