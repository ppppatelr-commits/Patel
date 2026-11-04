'use client';

import { useEffect, useState } from 'react';
import type { AppUser, UserRole } from '@/types';

interface Me {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [backend, setBackend] = useState<'local' | 'supabase'>('local');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Add user
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');

  // Edit user
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');

  // Change password
  const [passwordFor, setPasswordFor] = useState<AppUser | null>(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/auth/me'),
      ]);
      const meData = await meRes.json().catch(() => ({}));
      if (meData?.user) setMe(meData.user);
      if (meData?.backend) setBackend(meData.backend);

      if (!usersRes.ok) {
        const data = await usersRes.json().catch(() => ({}));
        setError(data?.error || 'Could not load users.');
        setUsers([]);
      } else {
        setUsers(await usersRes.json());
      }
    } catch {
      setError('Could not load users.');
    } finally {
      setLoading(false);
    }
  }

  function flash(text: string) {
    setMessage(text);
    setError('');
    window.setTimeout(() => setMessage(''), 4000);
  }

  function fail(text: string) {
    setError(text);
    setMessage('');
  }

  async function createUser() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(data?.error || 'Failed to create user.');
        return;
      }
      setShowAdd(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      flash('User created successfully.');
      await load();
    } catch {
      fail('Failed to create user.');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(user: AppUser) {
    setEditing(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  }

  async function saveEdit() {
    if (!editing || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(editing.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(data?.error || 'Failed to update user.');
        return;
      }
      setEditing(null);
      flash('User updated successfully.');
      await load();
    } catch {
      fail('Failed to update user.');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!passwordFor || busy) return;
    if (newPass.length < 6) {
      fail('Password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      fail('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(passwordFor.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(data?.error || 'Failed to change password.');
        return;
      }
      setPasswordFor(null);
      setNewPass('');
      setConfirmPass('');
      flash('Password changed successfully.');
    } catch {
      fail('Failed to change password.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(data?.error || 'Failed to delete user.');
        return;
      }
      setDeleteTarget(null);
      flash('User deleted.');
      await load();
    } catch {
      fail('Failed to delete user.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-secondary">Loading users...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">User Management</h1>
          <p className="text-secondary">
            Add accounts, assign roles, and reset passwords. Users can sign in at the same login page.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-[#d4af37] text-[#0a0a0a] font-bold px-6 py-3 rounded-lg hover:bg-[#e6c850] transition-colors uppercase text-sm tracking-wide"
        >
          + Add User
        </button>
      </div>

      {backend === 'local' && (
        <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-xl p-4">
          <p className="text-xs text-secondary">
            Accounts are stored on this server (local mode). To manage accounts in the cloud, set{' '}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{' '}
            <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code>.
          </p>
        </div>
      )}

      {message && (
        <div className="p-3 rounded-lg text-sm bg-green-400/10 text-green-400">{message}</div>
      )}
      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-400/10 text-red-400">{error}</div>
      )}

      <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-white/5 bg-[#1a1a1a]">
                <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Name</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Email</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Role</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Created</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => {
                const isMe = me?.id === user.id;
                return (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-white">{user.name}</span>
                      {isMe && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-secondary text-sm">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-[#d4af37]/15 text-[#d4af37]'
                            : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {user.role === 'admin' ? 'Administrator' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-secondary text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="px-3 py-1.5 text-[#d4af37] text-xs hover:bg-white/5 transition-colors rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setPasswordFor(user);
                            setNewPass('');
                            setConfirmPass('');
                            setError('');
                          }}
                          className="px-3 py-1.5 text-white/80 text-xs hover:bg-white/5 transition-colors rounded"
                        >
                          Change Password
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          disabled={isMe}
                          className={`px-3 py-1.5 text-xs rounded transition-colors ${
                            isMe
                              ? 'text-white/30 cursor-not-allowed'
                              : 'text-red-400 hover:bg-red-400/10'
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-secondary text-sm">
                    No users yet. Click "Add User" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <h3 className="font-bold text-lg text-white mb-4">Add New User</h3>
          <div className="space-y-4">
            <Field label="Full Name">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Rahul Sharma"
                autoFocus
              />
            </Field>
            <Field label="Email Address">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
                placeholder="user@patelrestaurant.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </Field>
            <Field label="Role">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className={inputClass}
              >
                <option value="user">User - menu content access</option>
                <option value="admin">Administrator - full access</option>
              </select>
            </Field>
            <ModalActions
              onCancel={() => setShowAdd(false)}
              onConfirm={createUser}
              confirmLabel={busy ? 'Creating...' : 'Create User'}
              disabled={busy}
            />
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 className="font-bold text-lg text-white mb-4">Edit User</h3>
          <div className="space-y-4">
            <Field label="Full Name">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="Email Address">
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Role">
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className={inputClass}
              >
                <option value="user">User - menu content access</option>
                <option value="admin">Administrator - full access</option>
              </select>
            </Field>
            <ModalActions
              onCancel={() => setEditing(null)}
              onConfirm={saveEdit}
              confirmLabel={busy ? 'Saving...' : 'Save Changes'}
              disabled={busy}
            />
          </div>
        </Modal>
      )}

      {/* Change Password Modal */}
      {passwordFor && (
        <Modal onClose={() => setPasswordFor(null)}>
          <h3 className="font-bold text-lg text-white mb-1">Change Password</h3>
          <p className="text-secondary text-sm mb-4">{passwordFor.email}</p>
          <div className="space-y-4">
            <Field label="New Password">
              <input
                type="text"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
                autoFocus
              />
            </Field>
            <Field label="Confirm New Password">
              <input
                type="text"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className={inputClass}
              />
            </Field>
            <ModalActions
              onCancel={() => setPasswordFor(null)}
              onConfirm={savePassword}
              confirmLabel={busy ? 'Saving...' : 'Update Password'}
              disabled={busy}
            />
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="font-bold text-lg text-white mb-2">Delete User</h3>
          <p className="text-secondary text-sm mb-6">
            Delete <span className="text-white font-semibold">{deleteTarget.email}</span>? This cannot be undone.
          </p>
          <ModalActions
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            confirmLabel={busy ? 'Deleting...' : 'Delete User'}
            disabled={busy}
            danger
          />
        </Modal>
      )}
    </div>
  );
}

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-2">{label}</label>
      {children}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#141414] rounded-xl border border-white/10 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled,
  danger,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        onClick={onCancel}
        className="flex-1 py-2 rounded bg-[#0a0a0a] border border-white/10 text-white hover:bg-white/5"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className={`flex-1 py-2 rounded font-bold transition-colors ${
          disabled
            ? 'bg-white/20 text-white/50 cursor-not-allowed'
            : danger
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850]'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
