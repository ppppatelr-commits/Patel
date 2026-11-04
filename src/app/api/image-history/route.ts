import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { readStore, updateStore } from '@/lib/menu-store';
import type { ImageHistoryEntry } from '@/types';

export const dynamic = 'force-dynamic';

// ─── In-memory history for local mode (persisted via menu-store.json sidecar) ──
// We store image history in a separate local JSON file when Supabase not configured.
import fs from 'fs/promises';
import path from 'path';

const HISTORY_PATH = path.join(process.cwd(), 'data', 'image-history.json');

async function readLocalHistory(): Promise<ImageHistoryEntry[]> {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf8');
    return JSON.parse(raw) as ImageHistoryEntry[];
  } catch {
    return [];
  }
}

async function writeLocalHistory(entries: ImageHistoryEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await fs.writeFile(HISTORY_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

// GET /api/image-history?item_id=xxx  — returns history for one item
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    if (!supabase) {
      const history = await readLocalHistory();
      const filtered = history
        .filter((h) => h.menu_item_id === itemId)
        .sort((a, b) => new Date(b.replaced_at).getTime() - new Date(a.replaced_at).getTime());
      return NextResponse.json(filtered);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(itemId)) {
      // Stale seed item with a slug-based id — no DB history available.
      return NextResponse.json([]);
    }
    const { data, error } = await supabase
      .from('image_history')
      .select('*')
      .eq('menu_item_id', itemId)
      .order('replaced_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Image history GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch image history' }, { status: 500 });
  }
}

// POST /api/image-history — record a new image replacement
// Body: { menu_item_id, previous_url, previous_filename?, replaced_by?, notes? }
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

    const supabase = createServerSupabaseClient();
    const now = new Date().toISOString();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (supabase && !uuidRegex.test(String(menu_item_id))) {
      // Stale seed item with a slug-based id — skip recording to avoid DB errors.
      return NextResponse.json({ id: crypto.randomUUID(), menu_item_id, previous_url, skipped: true });
    }

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

    if (!supabase) {
      const history = await readLocalHistory();
      history.unshift(entry);
      // Keep at most 50 entries per item
      const kept = history.filter((h) => h.menu_item_id !== menu_item_id).concat(
        history.filter((h) => h.menu_item_id === menu_item_id).slice(0, 50)
      );
      await writeLocalHistory(kept);
      return NextResponse.json(entry);
    }

    const { data, error } = await supabase
      .from('image_history')
      .insert({
        id: entry.id,
        menu_item_id,
        replaced_at: now,
        previous_url,
        previous_filename: previous_filename || null,
        is_current: false,
        replaced_by: replaced_by || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Image history POST error:', err);
    return NextResponse.json({ error: 'Failed to record image history' }, { status: 500 });
  }
}

// DELETE /api/image-history?id=xxx — delete a single history entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    if (!supabase) {
      const history = await readLocalHistory();
      const filtered = history.filter((h) => h.id !== id);
      await writeLocalHistory(filtered);
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase.from('image_history').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Image history DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete history entry' }, { status: 500 });
  }
}

