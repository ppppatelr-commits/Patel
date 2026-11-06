'use client';

import { useState, useEffect, useCallback } from 'react';
import { MenuItem, MenuCategory } from '@/types';
import Toast from '@/components/toast';

interface ImageMatchItem {
  id: string;
  name: string;
  categoryId: string;
  image: string | null;
  imageStatus: string;
  matchCount: number;
  bestMatch: { name: string; path: string; matchType: string } | null;
  allMatches: Array<{ name: string; path: string; matchType: string }>;
}

export default function ImageManagerPage() {
  const [items, setItems] = useState<ImageMatchItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, failed: 0 });

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [matchRes, catsRes] = await Promise.all([
        fetch('/api/image-match', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);
      const matchData = matchRes.ok ? await matchRes.json() : [];
      const catsData = catsRes.ok ? await catsRes.json() : [];
      setItems(Array.isArray(matchData) ? matchData : []);
      setCategories(Array.isArray(catsData) ? catsData.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sort_order: c.sortOrder ?? c.sort_order ?? 0,
        image_url: c.image ? `/${c.image}` : null,
        is_active: c.isActive !== false,
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: c.updatedAt || new Date().toISOString(),
      })) : []);
    } catch (err) {
      console.error('Failed to load image manager:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.imageStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {
    all: items.length,
    matched: items.filter((i) => i.imageStatus === 'matched').length,
    generated: items.filter((i) => i.imageStatus === 'generated').length,
    uploaded: items.filter((i) => i.imageStatus === 'uploaded').length,
    missing: items.filter((i) => i.imageStatus === 'missing').length,
    needs_review: items.filter((i) => i.imageStatus === 'needs_review').length,
  };

  async function assignImage(dishId: string, imagePath: string) {
    try {
      const res = await fetch('/api/image-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishId, imagePath, imageStatus: 'matched' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Image assigned to ${items.find((i) => i.id === dishId)?.name}`);
        await loadData();
      } else {
        showToast(data.error || 'Failed to assign image', 'error');
      }
    } catch (err) {
      showToast('Failed to assign image', 'error');
    }
  }

  async function generateImage(dishId: string, dishName: string) {
    setGenerating((prev) => new Set(prev).add(dishId));
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish: dishName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Update the menu item with the generated image
        await fetch('/api/image-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dishId, imagePath: data.filePath, imageStatus: 'generated' }),
        });
        showToast(`Generated image for ${dishName}`);
        await loadData();
      } else {
        showToast(data.error || 'Failed to generate image', 'error');
      }
    } catch (err) {
      showToast('Failed to generate image', 'error');
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(dishId);
        return next;
      });
    }
  }

  async function bulkGenerateMissing() {
    const missingItems = filtered.filter((i) => i.imageStatus === 'missing');
    if (missingItems.length === 0) {
      showToast('No missing images to generate');
      return;
    }
    setBulkGenerating(true);
    setBulkProgress({ done: 0, total: missingItems.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < missingItems.length; i++) {
      const item = missingItems[i];
      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish: item.name }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await fetch('/api/image-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishId: item.id, imagePath: data.filePath, imageStatus: 'generated' }),
          });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setBulkProgress({ done: i + 1, total: missingItems.length, failed });
    }
    setBulkGenerating(false);
    showToast(`Bulk generation complete: ${missingItems.length - failed} succeeded, ${failed} failed`);
    await loadData();
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  }

  const statusColors: Record<string, string> = {
    matched: 'bg-green-500/20 text-green-400',
    generated: 'bg-blue-500/20 text-blue-400',
    uploaded: 'bg-purple-500/20 text-purple-400',
    missing: 'bg-red-500/20 text-red-400',
    needs_review: 'bg-yellow-500/20 text-yellow-400',
  };

  if (loading) return <div className="p-8 text-secondary">Loading image manager...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Smart Image Manager</h1>
          <p className="text-secondary">Manage dish images — match, upload, generate, and review</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={bulkGenerateMissing}
            disabled={bulkGenerating}
            className={`px-6 py-3 font-bold rounded-lg uppercase text-sm tracking-wide transition-all ${
              bulkGenerating ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            }`}
          >
            {bulkGenerating ? `Generating ${bulkProgress.done}/${bulkProgress.total}...` : '🎨 Generate Missing'}
          </button>
        </div>
      </div>

      {bulkGenerating && (
        <div className="bg-[#141414] rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white">Generating images...</span>
            <span className="text-sm text-secondary">{bulkProgress.done}/{bulkProgress.total} ({bulkProgress.failed} failed)</span>
          </div>
          <div className="w-full bg-[#0a0a0a] rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'matched', 'generated', 'uploaded', 'missing', 'needs_review'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === status
                ? 'bg-[#d4af37] text-[#0a0a0a]'
                : 'bg-[#141414] text-secondary hover:text-white border border-white/10'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search dish name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-72 px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 text-white text-sm focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
      />

      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((item) => (
          <div key={item.id} className="bg-[#141414] rounded-xl border border-white/10 overflow-hidden">
            <div className="relative aspect-square bg-[#0a0a0a]">
              {item.image ? (
                <img
                  src={`/${item.image}`}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/api/placeholder/' + encodeURIComponent(item.name || 'dish'); }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-secondary text-xs">No Image</div>
              )}
              <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[item.imageStatus] || 'bg-gray-500/20 text-gray-400'}`}>
                {item.imageStatus.replace('_', ' ')}
              </span>
            </div>
            <div className="p-3">
              <h4 className="font-medium text-white text-sm truncate" title={item.name}>{item.name}</h4>
              <p className="text-xs text-secondary truncate">{catMap.get(item.categoryId) || 'Unknown'}</p>
              {item.bestMatch && item.imageStatus !== 'matched' && (
                <p className="text-[10px] text-yellow-400 mt-1 truncate" title={item.bestMatch.path}>
                  Suggested: {item.bestMatch.name}
                </p>
              )}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => generateImage(item.id, item.name)}
                  disabled={generating.has(item.id)}
                  className="flex-1 py-1 text-[10px] font-bold rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                >
                  {generating.has(item.id) ? '...' : '🎨 Gen'}
                </button>
                {item.bestMatch && item.imageStatus !== 'matched' && (
                  <button
                    onClick={() => assignImage(item.id, item.bestMatch!.path)}
                    className="flex-1 py-1 text-[10px] font-bold rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  >
                    ✓ Assign
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-secondary">No dishes found matching your filters.</div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
