'use client';

import { useEffect, useState } from 'react';
import type { UserRole } from '@/types';

interface Me {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) setMe(data.user);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to change password.');
        return;
      }
      setMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">My Account</h1>
        <p className="text-secondary">Your profile and password.</p>
      </div>

      {me && (
        <div className="bg-[#141414] rounded-2xl border border-white/10 p-6 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-secondary">Name</span>
            <span className="text-white font-semibold">{me.name}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-secondary">Email</span>
            <span className="text-white">{me.email}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-secondary">Role</span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                me.role === 'admin' ? 'bg-[#d4af37]/15 text-[#d4af37]' : 'bg-white/10 text-white/70'
              }`}
            >
              {me.role === 'admin' ? 'Administrator' : 'User'}
            </span>
          </div>
        </div>
      )}

      <div className="bg-[#141414] rounded-2xl border border-white/10 p-6">
        <h2 className="font-bold text-lg text-white mb-4">Change Password</h2>

        {message && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-green-400/10 text-green-400">{message}</div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-red-400/10 text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="At least 6 characters"
              className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-3 font-bold rounded-lg uppercase tracking-wide text-sm transition-all ${
              saving
                ? 'bg-white/20 text-white/50 cursor-not-allowed'
                : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850]'
            }`}
          >
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
