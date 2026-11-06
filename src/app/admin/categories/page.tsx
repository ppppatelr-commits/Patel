'use client';

import { useState, useEffect } from 'react';
import { MenuCategory } from '@/types';
import Toast from '@/components/toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editSort, setEditSort] = useState<number>(0);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSort, setNewSort] = useState<number | ''>('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      const data = await res.json();
      const raw: any[] = Array.isArray(data) ? data : [];
      const list: MenuCategory[] = raw.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sort_order: c.sortOrder ?? c.sort_order ?? 0,
        image_url: c.image ? `/${c.image}` : (c.image_url || null),
        is_active: c.isActive !== false && c.is_active !== false,
        created_at: c.createdAt || c.created_at || new Date().toISOString(),
        updated_at: c.updatedAt || c.updated_at || new Date().toISOString(),
      }));
      list.sort((a, b) => a.sort_order - b.sort_order);
      setCategories(list);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  function slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  async function createCategory() {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          sort_order: newSort ? Number(newSort) : categories.length + 1,
          image_url: newImageUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Error: ' + (data.error || 'Failed to create category'));
        return;
      }
      setNewName('');
      setNewSort('');
      setNewImageUrl('');
      setShowAddModal(false);
      setMessage('Category added successfully!');
      showToast('Category added successfully!');
      await loadCategories();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  }

  function openEdit(cat: MenuCategory) {
    setEditingCat(cat);
    setEditName(cat.name);
    setEditSlug(cat.slug || '');
    setEditSort(cat.sort_order ?? 0);
    setEditImageUrl(cat.image_url || '');
  }

  async function saveEdit() {
    if (!editingCat || !editName.trim()) return;
    const slug = editSlug.trim() || slugify(editName);
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCat.id,
          name: editName.trim(),
          slug,
          sort_order: Number(editSort) || editingCat.sort_order,
          image_url: editImageUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Error: ' + (data.error || 'Failed to save category'));
        return;
      }
      setEditingCat(null);
      setMessage('Category updated successfully!');
      showToast('Category updated successfully!');
      await loadCategories();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? This will also delete all menu items in it.')) return;
    try {
      const res = await fetch('/api/categories?id=' + encodeURIComponent(id), {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Error: ' + (data.error || 'Failed to delete category'));
        return;
      }
      setMessage('Category deleted and remaining categories renumbered sequentially.');
      showToast('Category deleted and remaining categories renumbered sequentially.');
      await loadCategories();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  }

  // Drag and drop handlers
  function handleDragStart(idx: number) {
    setDraggedIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newCats = [...categories];
    const [moved] = newCats.splice(draggedIdx, 1);
    newCats.splice(idx, 0, moved);
    newCats.forEach((c, i) => { c.sort_order = i + 1; });
    setCategories(newCats);
    setDraggedIdx(idx);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
  }

  async function saveOrder() {
    setSavingOrder(true);
    setMessage('');
    try {
      // Sort by whatever sort_orders are currently set, then renumber 1..N
      const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reorder: sorted.map((cat, idx) => ({ id: cat.id, sort_order: idx + 1 })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save order');
      setMessage('Category order saved successfully!');
      showToast('Category order saved successfully!');
      await loadCategories();
    } catch (err) {
      setMessage('Error saving order: ' + (err as Error).message);
      showToast('Error saving order: ' + (err as Error).message, 'error');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleImageUpload(file: File, isEdit: boolean) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dish', isEdit ? editName : newName);
    formData.append('category', 'categories');
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        if (isEdit) setEditImageUrl(data.fileUrl);
        else setNewImageUrl(data.fileUrl);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Upload error: ' + (err as Error).message);
    }
  }

  if (loading) return <div className="p-8 text-secondary">Loading categories...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Menu Categories</h1>
          <p className="text-secondary">Drag to reorder, or edit sort order manually. Changes are saved to the database.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveOrder}
            disabled={savingOrder}
            className={`px-6 py-3 font-bold rounded-lg uppercase text-sm tracking-wide transition-all ${
              savingOrder ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {savingOrder ? 'Saving...' : '💾 Save Order'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#d4af37] text-[#0a0a0a] font-bold px-6 py-3 rounded-lg hover:bg-[#e6c850] transition-colors uppercase text-sm tracking-wide"
          >
            + Add Category
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes('Error') ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>
          {message}
        </div>
      )}

      <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-[#1a1a1a]">
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary w-12">Drag</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">#</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Category Name</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Slug</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Sort Order</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {categories.map((cat, idx) => (
              <tr
                key={cat.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`hover:bg-white/5 transition-colors cursor-move ${draggedIdx === idx ? 'opacity-50 bg-white/5' : ''}`}
              >
                <td className="px-6 py-4 text-secondary cursor-grab select-none">☰</td>
                <td className="px-6 py-4 text-xs text-secondary font-mono">{idx + 1}</td>
                <td className="px-6 py-4">
                  <span className="font-medium text-white">{cat.name}</span>
                </td>
                <td className="px-6 py-4 text-secondary text-sm font-mono">{cat.slug}</td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={cat.sort_order ?? 0}
                    onChange={(e) => {
                      const newOrder = Number(e.target.value) || 0;
                      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, sort_order: newOrder } : c)));
                    }}
                    className="w-20 px-2 py-1 rounded bg-[#0a0a0a] border border-white/10 text-white text-sm text-center"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(cat)} className="px-3 py-1.5 text-[#d4af37] text-xs hover:bg-white/5 transition-colors rounded">Edit</button>
                    <button onClick={() => deleteCategory(cat.id)} className="px-3 py-1.5 text-red-400 text-xs hover:bg-red-400/10 transition-colors rounded">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="font-bold text-lg text-white mb-4">Add New Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  placeholder="e.g. CHICKEN CURRIES"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Sort Order <span className="text-secondary font-normal">(Position 1 to {categories.length + 1})</span>
                </label>
                <input
                  type="number"
                  value={newSort}
                  onChange={(e) => setNewSort(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  placeholder={`Default: ${categories.length + 1}`}
                  min="1"
                  max={categories.length + 1}
                />
                <p className="text-xs text-secondary mt-1">
                  Existing categories at this position and below will automatically shift down by 1.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, false);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/10 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#0a0a0a] file:font-bold file:cursor-pointer"
                />
                {newImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={newImageUrl} alt="Preview" className="h-12 w-12 object-cover rounded border border-white/10" />
                    <span className="text-xs text-secondary truncate">{newImageUrl}</span>
                    <button onClick={() => setNewImageUrl('')} className="text-red-400 text-xs hover:underline">Remove</button>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowAddModal(false); setNewImageUrl(''); }} className="flex-1 py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5">Cancel</button>
                <button onClick={createCategory} className="flex-1 py-2 rounded bg-[#d4af37] text-[#0a0a0a] font-bold hover:bg-[#e6c850]">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingCat(null); }}>
          <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="font-bold text-lg text-white mb-4">Edit Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Slug</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none font-mono text-sm"
                />
                <p className="text-xs text-secondary mt-1">URL-friendly name (auto-generated from category name)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Sort Order</label>
                <input
                  type="number"
                  value={editSort}
                  onChange={(e) => setEditSort(Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                  min="1"
                  max={categories.length}
                />
                <p className="text-xs text-secondary mt-1">
                  Changing position will automatically shift all other categories to keep continuous 1..{categories.length} sequence.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category Image (optional)</label>
                {editImageUrl && (
                  <div className="mb-2 flex items-center gap-2">
                    <img src={editImageUrl} alt="Preview" className="h-12 w-12 object-cover rounded border border-white/10" />
                    <span className="text-xs text-secondary truncate flex-1">{editImageUrl}</span>
                    <button onClick={() => setEditImageUrl('')} className="text-red-400 text-xs hover:underline">Remove</button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, true);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/10 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#0a0a0a] file:font-bold file:cursor-pointer"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingCat(null)} className="flex-1 py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5">Cancel</button>
                <button onClick={saveEdit} className="flex-1 py-2 rounded bg-[#d4af37] text-[#0a0a0a] font-bold hover:bg-[#e6c850]">Save Changes</button>
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
