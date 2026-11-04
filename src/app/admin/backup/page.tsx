'use client';

import { useState, useEffect, useRef } from 'react';
import type { BackupRecord } from '@/types';

export default function BackupPage() {
  const [backups, setBackups]         = useState<BackupRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [restoring, setRestoring]     = useState(false);
  const [message, setMessage]         = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [label, setLabel]             = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadBackups(); }, []);

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 6000);
  }

  async function loadBackups() {
    try {
      const res = await fetch('/api/backup', { cache: 'no-store' });
      if (res.ok) setBackups(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // ── Create backup ────────────────────────────────────────────────────────
  async function createBackup() {
    setCreating(true);
    showMsg('');
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });

      if (!res.ok) {
        const j = await res.json();
        showMsg(j.error || 'Backup failed', 'error');
        return;
      }

      // Trigger download
      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        || `patel-backup-${Date.now()}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setLabel('');
      showMsg(`✅ Backup "${filename}" downloaded successfully!`);
      await loadBackups();
    } catch (err: any) {
      showMsg(err.message || 'Backup failed', 'error');
    } finally {
      setCreating(false);
    }
  }

  // ── Delete backup record ─────────────────────────────────────────────────
  async function deleteBackup(id: string) {
    if (!confirm('Remove this backup record?')) return;
    try {
      await fetch(`/api/backup?id=${id}`, { method: 'DELETE' });
      setBackups((b) => b.filter((x) => x.id !== id));
      showMsg('Backup record removed.');
    } catch { showMsg('Failed to delete record', 'error'); }
  }

  // ── Restore from file ────────────────────────────────────────────────────
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.zip')) {
      showMsg('Please select a .zip backup file', 'error');
      return;
    }
    setPendingFile(f);
    setShowConfirm(true);
  }

  async function doRestore() {
    if (!pendingFile) return;
    setShowConfirm(false);
    setRestoring(true);
    showMsg('');
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      const res = await fetch('/api/restore', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        showMsg(json.error || 'Restore failed', 'error');
      } else {
        showMsg(
          `✅ Restore complete! Categories: ${json.restored?.categories}, Items: ${json.restored?.items}, Images: ${json.restored?.images}`
        );
        await loadBackups();
      }
    } catch (err: any) {
      showMsg(err.message || 'Restore failed', 'error');
    } finally {
      setRestoring(false);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function cancelRestore() {
    setShowConfirm(false);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function formatSize(bytes?: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold uppercase tracking-wide text-white mb-1">
          Backup & Restore
        </h2>
        <p className="text-sm text-white/50">
          Create full backups of all menu data and images. Restore from any previous backup.
        </p>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`rounded-xl px-5 py-4 text-sm font-medium border ${
            messageType === 'error'
              ? 'bg-red-900/30 border-red-500/30 text-red-300'
              : 'bg-green-900/30 border-green-500/30 text-green-300'
          }`}
        >
          {message}
        </div>
      )}

      {/* ── Create Backup ────────────────────────────────────────────────── */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#d4af37] uppercase tracking-wide">
          📦 Create Full Backup
        </h3>
        <p className="text-xs text-white/50">
          Generates a ZIP containing all categories, menu items, sort orders, image history, and all dish images.
          No passwords or secret keys are included.
        </p>

        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Backup label (optional)"
            className="flex-1 min-w-[200px] bg-[#1e1e1e] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4af37]/50"
          />
          <button
            onClick={createBackup}
            disabled={creating}
            className="px-6 py-2.5 bg-[#d4af37] hover:bg-[#e6c850] text-black font-bold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              '⬇ Download Backup'
            )}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: 'Categories', icon: '📂' },
            { label: 'Menu Items', icon: '🍽️' },
            { label: 'Dish Images', icon: '🖼️' },
          ].map((item) => (
            <div key={item.label} className="bg-[#1a1a1a] rounded-xl p-3 border border-white/5 flex items-center gap-2">
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="text-xs text-white/40">Included</div>
                <div className="text-sm font-semibold text-white">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Restore from Backup ──────────────────────────────────────────── */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#d4af37] uppercase tracking-wide">
          🔄 Restore from Backup
        </h3>
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-300 text-sm font-medium">⚠️ Warning</p>
          <p className="text-yellow-200/70 text-xs mt-1">
            Restoring will replace ALL current categories, menu items and image history with the backup data.
            A safety snapshot is created automatically before restore begins.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <label
            className={`px-6 py-2.5 border border-[#d4af37]/50 hover:border-[#d4af37] text-[#d4af37] font-bold text-sm rounded-lg cursor-pointer transition-all ${restoring ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {restoring ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                Restoring…
              </span>
            ) : (
              '📂 Select Backup File (.zip)'
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={onFileChange}
              disabled={restoring}
            />
          </label>
          <span className="text-xs text-white/40">
            Only .zip files exported from this system are accepted
          </span>
        </div>
      </div>

      {/* ── Restore Confirmation Modal ───────────────────────────────────── */}
      {showConfirm && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 max-w-md w-full space-y-5 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Confirm Restore</h3>
            <p className="text-white/70 text-sm">
              You are about to restore from:
            </p>
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
              <div className="text-[#d4af37] font-semibold text-sm">{pendingFile.name}</div>
              <div className="text-white/50 text-xs mt-1">{formatSize(pendingFile.size)}</div>
            </div>
            <p className="text-red-300/80 text-xs">
              This will overwrite all current menu data. A safety backup will be created first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelRestore}
                className="flex-1 px-4 py-2.5 border border-white/20 rounded-lg text-white/70 hover:text-white hover:border-white/40 text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={doRestore}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-lg transition-all"
              >
                ✅ Restore Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Backup History ───────────────────────────────────────────────── */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">
            📋 Backup History
          </h3>
          <button
            onClick={loadBackups}
            className="text-xs text-white/40 hover:text-[#d4af37] transition-colors"
          >
            Refresh ↻
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No backups yet. Create your first backup above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-wide border-b border-white/5">
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Label</th>
                  <th className="px-6 py-3 text-center">Categories</th>
                  <th className="px-6 py-3 text-center">Items</th>
                  <th className="px-6 py-3 text-center">Images</th>
                  <th className="px-6 py-3 text-center">Size</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-4 text-white/70 whitespace-nowrap">{formatDate(b.created_at)}</td>
                    <td className="px-6 py-4 text-white font-medium">{b.label || b.filename}</td>
                    <td className="px-6 py-4 text-center text-white/60">{b.category_count ?? '—'}</td>
                    <td className="px-6 py-4 text-center text-white/60">{b.item_count ?? '—'}</td>
                    <td className="px-6 py-4 text-center text-white/60">{b.image_count ?? '—'}</td>
                    <td className="px-6 py-4 text-center text-white/60">{formatSize(b.size_bytes)}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === 'complete'
                            ? 'bg-green-900/30 text-green-400'
                            : b.status === 'partial'
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteBackup(b.id)}
                        className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

