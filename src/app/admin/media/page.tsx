'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';
import { MediaItem } from '@/types';
import { MENU_DATA } from '@/lib/menu-data';

export default function MediaLibraryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filtered, setFiltered] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [editFilename, setEditFilename] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<MediaItem | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState({ totalDishes: 0, totalImages: 0, available: 0, missing: 0, storageUsed: 0 });
  const [missingList, setMissingList] = useState<{ name: string; category: string }[]>([]);
  const [showMissing, setShowMissing] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadStats = useCallback((items: MediaItem[]) => {
    const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>;
    let totalDishes = 0;
    for (const catItems of Object.values(itemsRecord)) totalDishes += catItems.length;
    const covered = new Set<string>();
    for (const item of items) {
      if (item.status === 'active' && item.dish_name) covered.add(item.dish_name.toLowerCase());
    }
    const missing: { name: string; category: string }[] = [];
    for (const [cat, catItems] of Object.entries(itemsRecord)) {
      for (const d of catItems) {
        if (!covered.has(d.name.toLowerCase())) {
          missing.push({ name: d.name, category: cat });
        }
      }
    }
    const storageUsed = items.reduce((sum, i) => sum + (i.size_bytes || 0), 0);
    setStats({ totalDishes, totalImages: items.length, available: items.filter((i) => i.status === 'active').length, missing: missing.length, storageUsed });
    setMissingList(missing);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [mediaRes, catsRes] = await Promise.all([
        fetch('/api/media', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);
      const items: MediaItem[] = mediaRes.ok ? await mediaRes.json() : [];
      const cats = catsRes.ok ? await catsRes.json() : [];
      setMedia(Array.isArray(items) ? items : []);
      setCategories(Array.isArray(cats) ? cats.map((c: any) => ({ id: c.id, name: c.name })) : []);
      loadStats(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load media library:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const term = search.trim().toLowerCase();
    const normalized = term.replace(/[-_]+/g, ' ');
    let result = media.filter((item) => {
      const dish = item.dish_name.toLowerCase();
      const file = item.filename.toLowerCase();
      const matchSearch = !term
        ? true
        : dish.includes(term) ||
          file.includes(term) ||
          dish.replace(/[-_]+/g, ' ').includes(normalized) ||
          file.replace(/[-_]+/g, ' ').includes(normalized);
      const matchCat = categoryFilter === 'all' || item.category_id === categoryFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
    result.sort((a, b) => {
      const aDate = new Date(a.uploaded_at).getTime();
      const bDate = new Date(b.uploaded_at).getTime();
      return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
    setFiltered(result);
  }, [media, search, categoryFilter, statusFilter, sortOrder]);

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

  async function renameMedia(id: string, newFilename: string) {
    if (!newFilename.trim()) return;
    if (!hasSupabaseConfig) {
      alert('Renaming requires the database (Supabase) to be configured.');
      return;
    }
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('media_library').update({ filename: newFilename.trim() }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setEditItem(null);
    loadData();
  }

  function deleteMedia(item: MediaItem) {
    setDeleteTarget(item);
  }

  function startReplace(item: MediaItem) {
    setReplaceTarget(item);
    // Reset the input so choosing the same file twice still fires onChange.
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = replaceTarget;
    e.target.value = '';
    if (!file || !target) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', target.file_path);

    try {
      const res = await fetch('/api/media/replace', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert('Replace failed: ' + (data.error || 'Unknown error'));
        return;
      }
      setReplaceTarget(null);
      setPreviewItem(null);
      // Update the replaced item in place to point at the new (Supabase) URL so
      // the thumbnail reflects the change immediately, instead of re-fetching
      // the stale disk URL.
      await loadData();
      if (data.storageUrl) {
        setMedia((prev) =>
          prev.map((m) =>
            m.id === target.id
              ? { ...m, file_url: data.storageUrl, file_path: data.storageUrl }
              : m
          )
        );
      }
      setCacheBust((v) => v + 1);
      alert(
        'Image replaced: ' + target.filename +
        (data.archivedUrl ? '\n\nThe previous image was kept in the Media Library.' : '')
      );
    } catch (err) {
      alert('Replace error: ' + (err as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const params = new URLSearchParams({ id: deleteTarget.id });
    if (deleteTarget.file_path) params.set('path', deleteTarget.file_path);
    const res = await fetch(`/api/media?${params.toString()}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert('Error: ' + (json?.error || 'Failed to delete')); return; }
    setDeleteTarget(null);
    setSelectedIds(new Set());
    await loadData();
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected image(s)?`)) return;
    const res = await fetch('/api/media/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert('Error: ' + (json?.error || 'Failed to bulk delete')); return; }
    const deleted = Number(json?.deleted || 0);
    const requested = Number(json?.requested || selectedIds.size);
    if (deleted < requested) {
      alert(`Deleted ${deleted} of ${requested} image(s). Some files were not found on disk.`);
    }
    setSelectedIds(new Set());
    await loadData();
  }

  function downloadMedia(url: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function getDimensions(item: MediaItem): string {
    if (item.width && item.height) return `${item.width} x ${item.height}`;
    return 'Unknown';
  }

  function getSize(item: MediaItem): string {
    if (!item.size_bytes) return 'Unknown';
    const kb = (item.size_bytes / 1024).toFixed(1);
    return `${kb} KB`;
  }

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Shared file input for Replace actions */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceFile}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Media Library</h1>
          <p className="text-secondary">WordPress-style media management for all AI-generated food images</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg transition-all text-sm uppercase tracking-wider cursor-pointer">
            Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dishName = prompt('Enter dish name for this image:', file.name.replace(/\.[^.]+$/, ''));
                if (!dishName) { e.target.value = ''; return; }
                const formData = new FormData();
                formData.append('file', file);
                formData.append('dish', dishName);
                formData.append('category', 'general');
                try {
                  const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    alert('Uploaded: ' + data.filename);
                    loadData();
                  } else {
                    alert('Upload failed: ' + (data.error || 'Unknown error'));
                  }
                } catch (err) {
                  alert('Upload error: ' + (err as Error).message);
                }
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 rounded-lg text-sm ${viewMode === 'grid' ? 'bg-[#d4af37] text-[#0a0a0a] font-bold' : 'bg-[#0a0a0a] border border-white/10 text-secondary'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-lg text-sm ${viewMode === 'list' ? 'bg-[#d4af37] text-[#0a0a0a] font-bold' : 'bg-[#0a0a0a] border border-white/10 text-secondary'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-[#141414] rounded-xl border border-white/10 p-5">
          <div className="flex justify-between items-center text-secondary text-xs uppercase tracking-wider mb-2">
            <span>Total Dishes</span>
            <span className="text-lg">Dish</span>
          </div>
          <div className="text-3xl font-black text-white">{stats.totalDishes}</div>
          <p className="text-[11px] text-secondary mt-1">33 menu categories</p>
        </div>
        <div className="bg-[#141414] rounded-xl border border-white/10 p-5">
          <div className="flex justify-between items-center text-secondary text-xs uppercase tracking-wider mb-2">
            <span>Total Images</span>
            <span className="text-lg">Image</span>
          </div>
          <div className="text-3xl font-black text-white">{stats.totalImages}</div>
          <p className="text-[11px] text-secondary mt-1">Generated files</p>
        </div>
        <div className="bg-[#141414] rounded-xl border border-white/10 p-5">
          <div className="flex justify-between items-center text-secondary text-xs uppercase tracking-wider mb-2">
            <span>Available</span>
            <span className="text-lg">OK</span>
          </div>
          <div className="text-3xl font-black text-white">{stats.available}</div>
          <p className="text-[11px] text-secondary mt-1">Active files</p>
        </div>
        <div
          className="bg-[#141414] rounded-xl border border-[#d4af37]/30 p-5 cursor-pointer hover:border-[#d4af37] transition-colors"
          onClick={() => setShowMissing(true)}
          title="Click to see which dishes are missing images"
        >
          <div className="flex justify-between items-center text-secondary text-xs uppercase tracking-wider mb-2">
            <span>Missing</span>
            <span className="text-lg">Warn</span>
          </div>
          <div className="text-3xl font-black text-[#d4af37]">{stats.missing}</div>
          <p className="text-[11px] text-secondary mt-1">Click to view list</p>
        </div>
        <div className="bg-[#141414] rounded-xl border border-white/10 p-5">
          <div className="flex justify-between items-center text-secondary text-xs uppercase tracking-wider mb-2">
            <span>Storage Used</span>
            <span className="text-lg">Disk</span>
          </div>
          <div className="text-3xl font-black text-white">{formatBytes(stats.storageUsed)}</div>
          <p className="text-[11px] text-secondary mt-1">Total media size</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#141414] rounded-2xl border border-white/10 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search by dish name or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="deleted">Deleted</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-secondary">
            <p>No media images found.</p>
            <p className="text-xs mt-2">Upload or generate images to populate the media library.</p>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-xl p-4 flex items-center justify-between">
          <span className="text-[#d4af37] font-semibold">{selectedIds.size} image(s) selected</span>
          <button onClick={bulkDelete} className="text-red-400 font-semibold text-sm hover:text-red-300 transition-colors">
            Bulk Delete
          </button>
        </div>
      )}

      {/* Media Grid */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-2'}>
        {filtered.map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`relative group ${isSelected ? 'ring-2 ring-[#d4af37]' : ''} bg-[#141414] border border-white/5 rounded-xl overflow-hidden transition-all hover:border-white/20 ${viewMode === 'grid' ? 'flex flex-col' : 'flex items-center gap-4 p-3 h-24'}`}
            >
              {viewMode === 'grid' ? (
                <>
                  <div className="relative aspect-[1/1] bg-[#0a0a0a] overflow-hidden">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="absolute top-2 left-2 z-10 accent-[#d4af37]"
                    />
                    <img
                      src={item.file_url + (cacheBust ? `?cb=${cacheBust}` : '')}
                      alt={item.dish_name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="text-white/80 hover:text-[#d4af37] transition-colors"
                        title="Preview"
                      >
                        View
                      </button>
                    </div>
                    <span className="absolute bottom-2 left-2 bg-[#0a0a0a]/80 backdrop-blur text-[10px] px-2 py-1 rounded text-white/80 truncate max-w-[80%]">
                      {item.dish_name}
                    </span>
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-sm text-white truncate" title={item.dish_name}>{item.dish_name}</h4>
                    <p className="text-xs text-[#d4af37] font-mono truncate" title={item.filename}>{item.filename}</p>
                    <p className="text-[10px] text-secondary/60 font-mono truncate" title={item.file_url}>{item.file_url}</p>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-secondary">
                      <span>{getDimensions(item)}</span>
                      <span>{item.status}</span>
                    </div>
                  </div>
                  <div className="p-2 border-t border-white/5 grid grid-cols-2 gap-1.5">
                    <button onClick={() => setPreviewItem(item)} className="py-1.5 text-[11px] text-secondary hover:text-[#d4af37] bg-[#0a0a0a] rounded text-center">Preview</button>
                    <button onClick={() => startReplace(item)} className="py-1.5 text-[11px] text-[#d4af37] hover:bg-[#d4af37]/10 bg-[#0a0a0a] rounded text-center">Replace</button>
                    <button onClick={() => downloadMedia(item.file_url)} className="py-1.5 text-[11px] text-secondary hover:text-[#d4af37] bg-[#0a0a0a] rounded text-center">Download</button>
                    <button onClick={() => { setEditItem(item); setEditFilename(item.filename); }} className="py-1.5 text-[11px] text-secondary hover:text-[#d4af37] bg-[#0a0a0a] rounded text-center">Rename</button>
                    <button onClick={() => deleteMedia(item)} className="col-span-2 py-1.5 text-[11px] text-red-400 hover:bg-red-400/10 rounded text-center">Delete</button>
                  </div>
                </>
              ) : (
                /* LIST VIEW */
                <div className="flex items-center gap-4 p-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="accent-[#d4af37] cursor-pointer"
                  />
                  <img
                    src={item.file_url + (cacheBust ? `?cb=${cacheBust}` : '')}
                    alt={item.dish_name}
                    className="w-14 h-14 rounded-xl object-cover border border-white/10 flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-white text-sm truncate">{item.dish_name}</h4>
                    <p className="text-xs text-secondary font-mono truncate">{item.file_url}</p>
                    <span className="text-[11px] text-[#d4af37]">
                      {(item as any).category_name || item.category_id}
                    </span>
                  </div>
                  <div className="text-right text-xs text-secondary font-mono hidden md:block">
                    <div>1024 x 1024</div>
                    <div>{formatBytes(item.size_bytes || 0)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => startReplace(item)}
                      className="px-3 py-1.5 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] rounded-lg text-xs font-semibold"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => deleteMedia(item)}
                      className="px-3 py-1.5 bg-red-400/10 hover:bg-red-400/20 text-red-400 rounded-lg text-xs font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="bg-[#141414] rounded-2xl border border-white/10 p-12 text-center">
          <div className="text-4xl mb-4">Image</div>
          <h3 className="font-bold text-xl text-white mb-2">No Images Found</h3>
          <p className="text-secondary text-sm mb-6">
            {media.length === 0
              ? 'The media library is empty. Upload dish images to get started.'
              : 'No images match your current search or filters.'}
          </p>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPreviewItem(null); }}>
          <div className="relative max-w-2xl max-h-[80vh] bg-[#141414] rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <button onClick={() => setPreviewItem(null)} className="absolute top-3 right-3 z-20 text-secondary hover:text-white text-2xl">&times;</button>
            <img src={previewItem.file_url + (cacheBust ? `?cb=${cacheBust}` : '')} alt={previewItem.dish_name} className="w-full h-full object-contain max-h-[60vh]" />
            <div className="p-6">
              <h3 className="font-bold text-xl text-white mb-2">{previewItem.dish_name}</h3>
              <div className="space-y-1 text-sm text-secondary">
                <p>Filename: {previewItem.filename}</p>
                <p>Format: {previewItem.mime_type}</p>
                <p>Dimensions: 1024 x 1024</p>
                <p>Size: {getSize(previewItem)}</p>
                <p>Category: {(previewItem as any).category_name || previewItem.category_id || 'Unassigned'}</p>
                <p>Status: <span className="text-[#d4af37]">{previewItem.status}</span></p>
                <p>Uploaded: {new Date(previewItem.uploaded_at).toLocaleString()}</p>
                <div>
                  <span className="text-secondary text-xs block">Storage Path (URL)</span>
                  <span className="text-secondary font-mono text-xs break-all">{previewItem.file_url}</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button onClick={() => downloadMedia(previewItem.file_url)} className="flex-1 min-w-[120px] bg-[#d4af37] text-[#0a0a0a] font-bold py-2 rounded text-center">Download Image</button>
                <button onClick={() => startReplace(previewItem)} className="flex-1 min-w-[120px] border border-[#d4af37]/40 text-[#d4af37] py-2 rounded text-center hover:bg-[#d4af37]/10">Replace</button>
                <button onClick={() => { setEditItem(previewItem); setEditFilename(previewItem.filename); setPreviewItem(null); }} className="flex-1 min-w-[120px] border border-white/10 text-white py-2 rounded text-center hover:bg-white/5">Rename</button>
                <button onClick={() => { setDeleteTarget(previewItem); setPreviewItem(null); }} className="flex-1 min-w-[120px] border border-red-400/30 text-red-400 py-2 rounded text-center hover:bg-red-400/10">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}>
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="font-bold text-lg text-white mb-4">Rename Image</h3>
            <p className="text-secondary text-sm mb-4">Original dish: {editItem.dish_name}</p>
            <input
              type="text"
              value={editFilename}
              onChange={(e) => setEditFilename(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditItem(null)} className="flex-1 py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5">Cancel</button>
              <button onClick={() => renameMedia(editItem.id, editFilename)} className="flex-1 py-2 rounded bg-[#d4af37] text-[#0a0a0a] font-bold hover:bg-[#d4af37]">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="font-bold text-lg text-white mb-4">Delete Image</h3>
            <p className="text-secondary mb-4">Are you sure you want to delete <span className="text-white font-medium">"{deleteTarget.dish_name}"</span>?</p>
            {deleteTarget.menu_item_id && (
              <p className="text-red-400 text-sm mb-4">Warning: This image is used by a menu item. Deleting it will remove the image from the menu.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 rounded bg-red-400 text-[#0a0a0a] font-bold hover:bg-red-300">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
      {/* Missing Images Modal */}
      {showMissing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowMissing(false); }}>
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-white mb-2">Missing Dish Images ({missingList.length})</h3>
            <p className="text-secondary text-sm mb-4">These dishes have no image yet. Upload one to remove them from this list.</p>
            {missingList.length === 0 ? (
              <p className="text-green-400 text-sm">All dishes have images! 🎉</p>
            ) : (
              <ul className="space-y-2">
                {missingList.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#0a0a0a] border border-white/10">
                    <span className="text-white text-sm font-medium">{m.name}</span>
                    <span className="text-secondary text-xs">{m.category}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <button onClick={() => setShowMissing(false)} className="w-full py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}