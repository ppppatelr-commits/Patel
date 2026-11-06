'use client';

import { useState, useEffect } from 'react';
import { MenuItem, MenuCategory } from '@/types';
import type { ImageHistoryEntry } from '@/types';
import { buildSeedStore } from '@/lib/menu-seed';
import Toast from '@/components/toast';

// UNIQUE_MARKER_20261102_1430
export default function ItemsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editData, setEditData] = useState<{
    name: string;
    description: string;
    price: string;
    image_filename: string;
    image_url: string;
    category_id: string;
    sort_order: number;
    is_available: boolean;
  }>({ name: '', description: '', price: '', image_filename: '', image_url: '', category_id: '', sort_order: 1, is_available: true });

  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [addData, setAddData] = useState<{
    name: string;
    description: string;
    price: string;
    image_filename: string;
    image_url: string;
    category_id: string;
    sort_order: number | '';
    is_available: boolean;
  }>({ name: '', description: '', price: '', image_filename: '', image_url: '', category_id: '', sort_order: '', is_available: true });
  const [adding, setAdding] = useState(false);
  const [addUploadFile, setAddUploadFile] = useState<File | null>(null);
  const [addUploading, setAddUploading] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  // ── Image History ─────────────────────────────────────────────────────────
  const [imageHistory, setImageHistory] = useState<ImageHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        fetch('/api/items', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);
      const rawItems = await itemsRes.json();
      const rawCats = await catsRes.json();

      if (itemsRes.ok && Array.isArray(rawItems) && catsRes.ok && Array.isArray(rawCats)) {
        // Convert GitHub format (camelCase) to admin format (snake_case)
        const mappedItems: MenuItem[] = rawItems.map((i: any) => ({
          id: i.id,
          category_id: i.categoryId,
          name: i.name,
          description: i.description || null,
          price: i.price,
          image_url: i.image ? `/${i.image}?v=${i.updatedAt || Date.now()}` : null,
          image_filename: i.image ? i.image.split('/').pop() || null : null,
          sort_order: i.sortOrder || 0,
          is_available: i.isAvailable !== false,
          created_at: i.createdAt || new Date().toISOString(),
          updated_at: i.updatedAt || new Date().toISOString(),
        }));
        const mappedCats: MenuCategory[] = rawCats.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          sort_order: c.sortOrder || 0,
          image_url: c.image || null,
          is_active: c.isActive !== false,
          created_at: c.createdAt || new Date().toISOString(),
          updated_at: c.updatedAt || new Date().toISOString(),
        }));
        setItems(mappedItems);
        setCategories(mappedCats);
      } else {
        const seed = buildSeedStore();
        setItems(seed.items);
        setCategories(seed.categories);
      }
    } catch {
      const seed = buildSeedStore();
      setItems(seed.items);
      setCategories(seed.categories);
    } finally {
      setLoading(false);
    }
  }

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const catSlugMap = new Map(categories.map((c) => [c.id, c.slug]));

  function openEdit(item: MenuItem) {
    setEditingItem(item);
    setEditData({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      image_filename: item.image_filename || '',
      image_url: item.image_url || '',
      category_id: item.category_id,
      sort_order: item.sort_order || 1,
      is_available: item.is_available !== false,
    });
    setUploadingFile(null);
    // Load image history for this item
    setImageHistory([]);
    setShowHistory(false);
    setLoadingHistory(true);
    fetch(`/api/image-history?item_id=${item.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setImageHistory(data);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }

  async function saveEdit() {
    if (!editingItem) return;

    const price = Number(editData.price);
    if (!editData.name.trim()) {
      alert('Dish name is required.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      alert('Enter a valid price.');
      return;
    }

    // If image changed, record the old image in history first
    const imageChanged =
      editData.image_url !== (editingItem.image_url || '') &&
      editingItem.image_url;

    if (imageChanged && editingItem.image_url) {
      fetch('/api/image-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: editingItem.id,
          previous_url: editingItem.image_url,
          previous_filename: editingItem.image_filename || null,
          notes: `Replaced via Edit modal`,
        }),
      }).catch(console.error);
    }

    try {
      const res = await fetch('/api/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          name: editData.name.trim(),
          description: editData.description.trim() || null,
          price,
          image_filename: editData.image_filename || null,
          image_url: editData.image_url ? editData.image_url.split('?')[0] : null,
          category_id: editData.category_id,
          sort_order: Number(editData.sort_order) || 1,
          is_available: editData.is_available,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Error: ' + (data.error || 'Failed to save changes'));
        showToast('Error: ' + (data.error || 'Failed to save changes'), 'error');
        return;
      }
      setEditingItem(null);
      setMessage(`Saved changes for ${editData.name.trim()}`);
      showToast(`Saved changes for ${editData.name.trim()}`);
      await loadData();
    } catch (err) {
      alert('Save error: ' + (err as Error).message);
    }
  }

  async function addItem() {
    if (!addData.name.trim()) {
      alert('Dish name is required.');
      return;
    }
    if (!addData.category_id) {
      alert('Please select a category.');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addData.name.trim(),
          description: addData.description.trim() || null,
          price: Number(addData.price) || 0,
          category_id: addData.category_id,
          image_filename: addData.image_filename || null,
          image_url: addData.image_url || null,
          sort_order: addData.sort_order !== '' ? Number(addData.sort_order) : undefined,
          is_available: addData.is_available,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Error: ' + (data.error || 'Failed to add item'));
        showToast('Error: ' + (data.error || 'Failed to add item'), 'error');
        return;
      }
      setShowAddForm(false);
      setAddData({ name: '', description: '', price: '', image_filename: '', image_url: '', category_id: categories[0]?.id || '', sort_order: '', is_available: true });
      setAddUploadFile(null);
      setMessage(`Added new dish: ${addData.name.trim()}`);
      showToast(`Added new dish: ${addData.name.trim()}`);
      await loadData();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this menu item?')) return;
    try {
      const res = await fetch('/api/items?id=' + encodeURIComponent(id), {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Error: ' + (data.error || 'Failed to delete'));
        showToast('Error: ' + (data.error || 'Failed to delete'), 'error');
        return;
      }
      setMessage('Item deleted and category items renumbered sequentially.');
      showToast('Item deleted and category items renumbered sequentially.');
      await loadData();
    } catch (err) {
      alert('Delete error: ' + (err as Error).message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRAG & DROP LOGIC (Category-wise independent sorting)
  // ─────────────────────────────────────────────────────────────────────────

  function handleDragStart(id: string) {
    if (search.trim()) return;
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || search.trim()) return;

    const draggedItem = items.find((i) => i.id === draggedId);
    const targetItem = items.find((i) => i.id === targetId);
    if (!draggedItem || !targetItem) return;

    // Maintain category isolation: drag and drop reorders within the same category
    if (draggedItem.category_id !== targetItem.category_id) return;

    const catId = draggedItem.category_id;
    const catItems = items
      .filter((i) => i.category_id === catId)
      .sort((a, b) => a.sort_order - b.sort_order);

    const fromIdx = catItems.findIndex((i) => i.id === draggedId);
    const toIdx = catItems.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const updatedCatItems = [...catItems];
    const [moved] = updatedCatItems.splice(fromIdx, 1);
    updatedCatItems.splice(toIdx, 0, moved);

    // Renumber sequentially 1..M
    updatedCatItems.forEach((it, idx) => {
      it.sort_order = idx + 1;
    });

    const otherItems = items.filter((i) => i.category_id !== catId);
    setItems([...otherItems, ...updatedCatItems]);
  }

  function handleDragEnd() {
    setDraggedId(null);
  }

  async function saveOrder() {
    setSavingOrder(true);
    setMessage('');
    try {
      let itemsToReorder: MenuItem[];

      if (filterCat !== 'all') {
        itemsToReorder = items
          .filter((i) => i.category_id === filterCat)
          .sort((a, b) => a.sort_order - b.sort_order);
      } else {
        itemsToReorder = items;
      }

      const res = await fetch('/api/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: filterCat !== 'all' ? filterCat : undefined,
          reorder: itemsToReorder.map((it, idx) => ({
            id: it.id,
            sort_order: filterCat !== 'all' ? idx + 1 : it.sort_order,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save menu items order');

      setMessage('Menu item order saved successfully!');
      showToast('Menu item order saved successfully!');
      await loadData();
    } catch (err) {
      setMessage('Error saving order: ' + (err as Error).message);
    } finally {
      setSavingOrder(false);
    }
  }

  // Filtered and sorted items for display
  const filteredItems = items
    .filter((item) => {
      const matchCat = filterCat === 'all' || item.category_id === filterCat;
      const matchSearch = search ? item.name.toLowerCase().includes(search.toLowerCase()) : true;
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (filterCat !== 'all') {
        return a.sort_order - b.sort_order;
      }
      // If showing all, sort by Category Sort Order, then Item Sort Order
      const catA = categories.find((c) => c.id === a.category_id);
      const catB = categories.find((c) => c.id === b.category_id);
      const catOrderA = catA?.sort_order || 999;
      const catOrderB = catB?.sort_order || 999;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      return a.sort_order - b.sort_order;
    });

  if (loading) return <div className="p-8 text-secondary">Loading dishes...</div>;

  return (
    <div className="space-y-8">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Menu Items ({items.length})</h1>
          <p className="text-secondary">Drag to reorder within categories, or edit dishes, prices, and food image assignments</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={saveOrder}
            disabled={savingOrder}
            className={`px-6 py-3 font-bold rounded-lg uppercase text-sm tracking-wide transition-all ${
              savingOrder
                ? 'bg-white/20 text-white/50 cursor-not-allowed'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {savingOrder ? 'Saving...' : '💾 Save Order'}
          </button>
          <button
            onClick={() => {
              setAddData({
                name: '',
                description: '',
                price: '',
                image_filename: '',
                image_url: '',
                category_id: filterCat !== 'all' ? filterCat : categories[0]?.id || '',
                sort_order: '',
                is_available: true,
              });
              setShowAddForm(true);
            }}
            className="px-6 py-3 bg-[#d4af37] text-[#0a0a0a] font-bold rounded-lg hover:bg-[#e6c850] transition-colors uppercase text-sm tracking-wide shrink-0"
          >
            + Add New Item
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes('Error') ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>
          {message}
        </div>
      )}

      {/* ── Filter & Search Controls ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search dish name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 text-white text-sm focus:ring-2 focus:ring-[#d4af37] focus:outline-none w-full sm:w-72"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 text-white text-sm focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
        >
          <option value="all">All Categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {search.trim() && (
          <span className="text-xs text-yellow-400/90 self-center">
            Note: Clear search filter to reorder items via drag & drop
          </span>
        )}
      </div>

      {/* ── Table Layout with DRAG column ─────────────────────────── */}
      <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-[#1a1a1a]">
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary w-12 text-center">Drag</th>
              <th className="px-4 py-4 text-xs font-semibold uppercase text-secondary w-12 text-center">#</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Dish Name</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Category</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary text-right">Price</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Image File</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredItems.map((item) => {
              const isDragging = draggedId === item.id;
              const canDrag = !search.trim();

              return (
                <tr
                  key={item.id}
                  draggable={canDrag}
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`hover:bg-white/5 transition-colors ${
                    canDrag ? 'cursor-move' : ''
                  } ${isDragging ? 'opacity-50 bg-white/5' : ''}`}
                >
                  <td className="px-6 py-4 text-secondary text-center cursor-grab select-none">
                    ☰
                  </td>
                  <td className="px-4 py-4 text-xs text-secondary font-mono text-center">
                    {item.sort_order}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-white">{item.name}</span>
                  </td>
                  <td className="px-6 py-4 text-secondary text-sm">
                    {catMap.get(item.category_id) || 'General'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[#d4af37] font-bold">₹{item.price.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-6 py-4">
                    {item.image_filename ? (
                      <span className="text-xs text-[#d4af37] font-mono">{item.image_filename}</span>
                    ) : (
                      <span className="text-xs text-secondary">Placeholder</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="px-3 py-1.5 text-[#d4af37] text-xs hover:bg-white/5 transition-colors rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="px-3 py-1.5 text-red-400 text-xs hover:bg-red-400/10 transition-colors rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Edit Item Modal ────────────────────────────────────────── */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingItem(null);
          }}
        >
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-white mb-4">Edit Menu Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Dish Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Description (optional)</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none text-sm"
                  placeholder="e.g. 2 PCS TANGDI, 2 PCS RESHMI KEBAB, ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Description (optional)</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none text-sm"
                  placeholder="e.g. 2 PCS TANGDI, 2 PCS RESHMI KEBAB, ..."
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0a] border border-white/10">
                <input
                  type="checkbox"
                  id="edit-available"
                  checked={editData.is_available}
                  onChange={(e) => setEditData({ ...editData, is_available: e.target.checked })}
                  className="w-5 h-5 accent-[#d4af37]"
                />
                <label htmlFor="edit-available" className="text-sm font-medium text-white cursor-pointer">
                  Available on menu
                  <span className="text-secondary text-xs ml-2">(uncheck to mark as unavailable / sold out)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Category</label>
                <select
                  value={editData.category_id}
                  onChange={(e) => setEditData({ ...editData, category_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-secondary mt-1">
                  Changing category will automatically position the dish in the destination category and renumber both categories.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Sort Position in Category</label>
                <input
                  type="number"
                  value={editData.sort_order}
                  onChange={(e) => setEditData({ ...editData, sort_order: Number(e.target.value) || 1 })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Price (₹)</label>
                <input
                  type="number"
                  value={editData.price}
                  onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Image Filename</label>
                <input
                  type="text"
                  value={editData.image_filename}
                  onChange={(e) => {
                    const filename = e.target.value;
                    const catSlug = catSlugMap.get(editData.category_id) || 'general';
                    setEditData({
                      ...editData,
                      image_filename: filename,
                      image_url: filename
                        ? filename.includes('/')
                          ? `/media/dishes/${filename.replace(/^\/+/, '')}`
                          : `/media/dishes/${catSlug}/${filename}`
                        : '',
                    });
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none font-mono text-sm"
                  placeholder="e.g. chi-hot-and-sour-soup.webp"
                />
                <p className="text-xs text-secondary mt-1">Filename in public/media/dishes/ folder</p>
              </div>

              {editData.image_filename && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0a] border border-white/10">
                  <img
                    src={editData.image_url || (editData.image_filename ? (editData.image_filename.includes('/') ? `/media/dishes/${editData.image_filename.replace(/^\/+/, '')}` : `/media/dishes/${catSlugMap.get(editData.category_id) || 'general'}/${editData.image_filename}`) : '/logo.png')}
                    alt="Current"
                    className="h-16 w-16 object-cover rounded border border-white/10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/api/placeholder/' + encodeURIComponent(editData.name || editingItem?.name || 'dish');
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-secondary">Current Image</p>
                    <p className="text-sm text-[#d4af37] font-mono truncate">{editData.image_filename}</p>
                  </div>
                  <button
                    onClick={() => setEditData({ ...editData, image_filename: '', image_url: '' })}
                    className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10 rounded"
                    title="Remove this image from the menu item"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-2">Replace or Upload Image</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadingFile(file);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/10 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#0a0a0a] file:font-bold file:cursor-pointer"
                  />
                  <button
                    onClick={async () => {
                      if (!uploadingFile || !editingItem) return;
                      setUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', uploadingFile);
                        formData.append('dish', editData.name || editingItem.name);
                        formData.append('category', catMap.get(editData.category_id) || 'general');
                        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          // Archive old image in history before replacing
                          if (editData.image_url && editingItem) {
                            fetch('/api/image-history', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                menu_item_id: editingItem.id,
                                previous_url: editData.image_url,
                                previous_filename: editData.image_filename || null,
                                notes: `Replaced by upload: ${data.filename}`,
                              }),
                            }).then(() => {
                              // Reload history
                              fetch(`/api/image-history?item_id=${editingItem.id}`, { cache: 'no-store' })
                                .then((r) => r.json())
                                .then((hist) => { if (Array.isArray(hist)) setImageHistory(hist); })
                                .catch(() => {});
                            }).catch(console.error);
                          }
                          setEditData({ ...editData, image_filename: data.filename, image_url: `/${data.filePath}?v=${Date.now()}` });
                          setUploadingFile(null);
                          alert('Image uploaded: ' + data.filename);
                        } else {
                          alert('Upload failed: ' + (data.error || 'Unknown error'));
                        }
                      } catch (err) {
                        alert('Upload error: ' + (err as Error).message);
                      } finally {
                        setUploading(false);
                      }
                    }}
                    disabled={!uploadingFile || uploading}
                    className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                      !uploadingFile || uploading
                        ? 'bg-white/20 text-white/50 cursor-not-allowed'
                        : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850]'
                    }`}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 py-2 rounded bg-[#d4af37] text-[#0a0a0a] font-bold hover:bg-[#e6c850]"
                >
                  Save Changes
                </button>
              </div>

              {/* ── Image History Section ──────────────────────────── */}
              <div className="border-t border-white/10 pt-4 mt-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-sm font-medium text-[#d4af37] hover:text-[#e6c850] transition-colors"
                >
                  <span>{showHistory ? '▼' : '▶'}</span>
                  🕐 Image History ({loadingHistory ? '…' : imageHistory.length})
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {loadingHistory ? (
                      <p className="text-xs text-white/40">Loading history…</p>
                    ) : imageHistory.length === 0 ? (
                      <p className="text-xs text-white/40">No previous images recorded yet.</p>
                    ) : (
                      imageHistory.map((h) => (
                        <div key={h.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#0a0a0a] border border-white/10">
                          <img
                            src={h.previous_url}
                            alt="Previous"
                            className="h-12 w-12 object-cover rounded border border-white/10 flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/api/placeholder/' + encodeURIComponent(editData.name || editingItem?.name || 'dish'); }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/50">
                              {new Date(h.replaced_at).toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs text-[#d4af37] font-mono truncate">
                              {h.previous_filename || h.previous_url.split('/').pop()}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!editingItem) return;
                              if (!confirm('Restore this image? Current image will be saved to history.')) return;
                              // Archive current image in history before restoring
                              if (editData.image_url) {
                                await fetch('/api/image-history', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    menu_item_id: editingItem.id,
                                    previous_url: editData.image_url,
                                    previous_filename: editData.image_filename || null,
                                    notes: `Archived before restoring older image`,
                                  }),
                                }).catch(console.error);
                              }
                              // Set the restored image in edit form
                              setEditData({
                                ...editData,
                                image_url: h.previous_url,
                                image_filename: h.previous_filename || '',
                              });
                              // Remove from history (it's now current)
                              await fetch(`/api/image-history?id=${h.id}`, { method: 'DELETE' }).catch(console.error);
                              setImageHistory((prev) => prev.filter((x) => x.id !== h.id));
                            }}
                            className="px-2 py-1 text-xs text-green-400 hover:bg-green-400/10 rounded whitespace-nowrap"
                          >
                            Restore
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this history entry?')) return;
                              await fetch(`/api/image-history?id=${h.id}`, { method: 'DELETE' }).catch(console.error);
                              setImageHistory((prev) => prev.filter((x) => x.id !== h.id));
                            }}
                            className="px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Modal ─────────────────────────────────────────── */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddForm(false);
              setAddUploadFile(null);
            }
          }}
        >
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-white mb-4">Add New Menu Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Dish Name *</label>
                <input
                  type="text"
                  value={addData.name}
                  onChange={(e) => setAddData({ ...addData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  placeholder="e.g. Chicken Tikka Masala"
                  autoFocus
                />
              </div>

              <div>
            <label className="block text-sm font-medium text-white mb-2">Description (optional)</label>
            <textarea
              value={addData.description}
              onChange={(e) => setAddData({ ...addData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none text-sm"
              placeholder="e.g. 2 PCS TANGDI, 2 PCS RESHMI KEBAB, ..."
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0a] border border-white/10">
            <input
              type="checkbox"
              checked={addData.is_available}
              onChange={(e) => setAddData({ ...addData, is_available: e.target.checked })}
              className="w-5 h-5 accent-[#d4af37]"
            />
            <label className="text-sm font-medium text-white cursor-pointer">
              Available on menu
              <span className="text-secondary text-xs ml-2">(uncheck to mark as unavailable)</span>
            </label>
          </div>

          <div>
                <label className="block text-sm font-medium text-white mb-2">Category *</label>
                <select
                  value={addData.category_id}
                  onChange={(e) => setAddData({ ...addData, category_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Sort Position in Category <span className="text-secondary font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  value={addData.sort_order}
                  onChange={(e) => setAddData({ ...addData, sort_order: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  placeholder="Default: Appends at the end"
                  min="1"
                />
                <p className="text-xs text-secondary mt-1">
                  Existing dishes at this position and below will automatically shift down by 1.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Price (₹)</label>
                <input
                  type="number"
                  value={addData.price}
                  onChange={(e) => setAddData({ ...addData, price: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Image Upload Section */}
              <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-[#0a0a0a]">
                <p className="text-sm font-medium text-white">Dish Image</p>

                {addData.image_url && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#141414] border border-white/10">
                    <img
                      src={addData.image_url}
                      alt="Preview"
                      className="h-16 w-16 object-cover rounded border border-white/10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/api/placeholder/' + encodeURIComponent(editData.name || editingItem?.name || 'dish');
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-secondary">Uploaded Image</p>
                      <p className="text-sm text-[#d4af37] font-mono truncate">{addData.image_filename}</p>
                    </div>
                    <button
                      onClick={() => {
                        setAddData({ ...addData, image_filename: '', image_url: '' });
                        setAddUploadFile(null);
                      }}
                      className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10 rounded"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div>
                  <p className="text-xs text-secondary mb-2">Upload from computer</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setAddUploadFile(f);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#0a0a0a] file:font-bold file:cursor-pointer"
                    />
                    <button
                      onClick={async () => {
                        if (!addUploadFile) return;
                        if (!addData.name.trim()) {
                          alert('Enter the dish name first so the image can be named correctly.');
                          return;
                        }
                        if (!addData.category_id) {
                          alert('Select a category first.');
                          return;
                        }
                        setAddUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', addUploadFile);
                          formData.append('dish', addData.name.trim());
                          formData.append('category', catMap.get(addData.category_id) || 'general');
                          const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setAddData({ ...addData, image_filename: data.filename, image_url: `/${data.filePath}?v=${Date.now()}` });
                            setAddUploadFile(null);
                          } else {
                            alert('Upload failed: ' + (data.error || 'Unknown error'));
                          }
                        } catch (err) {
                          alert('Upload error: ' + (err as Error).message);
                        } finally {
                          setAddUploading(false);
                        }
                      }}
                      disabled={!addUploadFile || addUploading}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all shrink-0 ${
                        !addUploadFile || addUploading
                          ? 'bg-white/10 text-white/40 cursor-not-allowed'
                          : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850]'
                      }`}
                    >
                      {addUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-secondary mb-1">Or enter filename manually</p>
                  <input
                    type="text"
                    value={addData.image_filename}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddData({
                        ...addData,
                        image_filename: val,
                        image_url: val ? `/media/dishes/${val}` : '',
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none font-mono text-sm"
                    placeholder="e.g. chicken-soups/chi-hot-and-sour-soup.webp"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setAddUploadFile(null);
                  }}
                  className="flex-1 py-2.5 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={addItem}
                  disabled={adding}
                  className={`flex-1 py-2.5 rounded font-bold transition-all ${
                    adding ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850]'
                  }`}
                >
                  {adding ? 'Adding…' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast(null)}
      />
    )}
    </div>
  );
}
