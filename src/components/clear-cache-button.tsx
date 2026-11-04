'use client';

import { useState } from 'react';

export default function ClearCacheButton() {
  const [busy, setBusy] = useState(false);

  async function clearCache() {
    setBusy(true);
    try {
      // 1. Server-side revalidation
      await fetch('/api/revalidate', { method: 'POST' }).catch(() => {});

      // 2. Clear browser caches
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch { /* ignore */ }
      }
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }

      // 3. Hard reload with cache-busting timestamp
      const url = new URL(window.location.href);
      url.searchParams.set('_cb', Date.now().toString());
      window.location.replace(url.toString());
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={clearCache}
      disabled={busy}
      className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-bold rounded-xl text-sm transition-colors disabled:opacity-50 hover:bg-[#e6c850]"
      title="Clear all caches and refresh"
    >
      {busy ? 'Clearing…' : '🧹 Clear Cache'}
    </button>
  );
}