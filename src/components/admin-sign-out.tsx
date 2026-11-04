'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminSignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Sign out error:', err);
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={busy}
      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:text-white transition-colors rounded-lg hover:bg-white/5 disabled:opacity-50"
    >
      <span aria-hidden="true">&#x2715;</span>
      <span>{busy ? 'Signing out...' : 'Sign Out'}</span>
    </button>
  );
}
