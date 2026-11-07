'use client';

import { useState, useEffect } from 'react';
import { MENU_DATA } from '@/lib/menu-data';
import Toast from '@/components/toast';

export default function SettingsPage() {
  const [name, setName] = useState<string>(MENU_DATA.restaurant.name);
  const [tagline, setTagline] = useState<string>(MENU_DATA.restaurant.tagline);
  const [phone1, setPhone1] = useState<string>(MENU_DATA.restaurant.phone1);
  const [phone2, setPhone2] = useState<string>(MENU_DATA.restaurant.phone2);
  const [logoUrl, setLogoUrl] = useState('/patel-logo-gold.png');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => {
        if (!s || cancelled) return;
        // Use explicit null checks so clearing a field (empty string) is respected.
        if (typeof s.name === 'string') setName(s.name);
        if (typeof s.tagline === 'string') setTagline(s.tagline);
        if (typeof s.phone1 === 'string') setPhone1(s.phone1);
        if (typeof s.phone2 === 'string') setPhone2(s.phone2);
        if (typeof s.logoUrl === 'string' && s.logoUrl) setLogoUrl(s.logoUrl);
      })
      .catch(() => {
        // Keep the defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tagline, phone1, phone2, logoUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setMessage('Settings saved successfully! They are now live on the public site.');
      showToast('Settings saved successfully! They are now live on the public site.');
    } catch (err) {
      setMessage('Error saving settings: ' + (err as Error).message);
      showToast('Error saving settings: ' + (err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Restaurant Settings</h1>
        <p className="text-secondary">Configure branding, contact details, and developer credit</p>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-white/10 p-8 space-y-6">
        <h3 className="font-bold text-lg mb-2 uppercase tracking-wide">Restaurant Details</h3>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Restaurant Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Tagline / Subtitle</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Premium Authentic Indian Cuisine"
            className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          />
          <p className="text-xs text-secondary mt-1">
            Shown under the restaurant name on the home page. Leave blank to hide it.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Phone 1</label>
          <input
            type="text"
            value={phone1}
            onChange={(e) => setPhone1(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          />
          <p className="text-xs text-secondary mt-1">Leave blank to hide this number.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Phone 2</label>
          <input
            type="text"
            value={phone2}
            onChange={(e) => setPhone2(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
          />
          <p className="text-xs text-secondary mt-1">Leave blank to hide this number.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Logo</label>
          <div className="flex items-center gap-4 mb-3">
            <img
              src={logoUrl || '/patel-logo-gold.png'}
              alt="Logo preview"
              className="h-16 w-auto object-contain rounded border border-white/10 bg-[#0a0a0a]"
            />
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    setMessage('Error: logo must be under 5 MB.');
                    showToast('Error: logo must be under 5 MB.', 'error');
                    return;
                  }
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('dish', 'logo');
                    formData.append('category', 'branding');
                    const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.success) {
                      setMessage('Error uploading logo: ' + (data.error || 'Unknown error'));
                      showToast('Error uploading logo: ' + (data.error || 'Unknown error'), 'error');
                      return;
                    }
                    setLogoUrl(data.fileUrl);
                    setMessage('Logo uploaded. Click Save Settings to publish it.');
                    showToast('Logo uploaded. Click Save Settings to publish it.');
                  } catch (err) {
                    setMessage('Error uploading logo: ' + (err as Error).message);
                    showToast('Error uploading logo: ' + (err as Error).message, 'error');
                  }
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/10 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#0a0a0a] file:font-bold file:cursor-pointer"
              />
              <p className="text-xs text-secondary mt-1">Upload a new logo, or type a path below.</p>
            </div>
          </div>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
            placeholder="/patel-logo-gold.png"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-3 font-bold rounded-lg uppercase tracking-wide text-sm transition-all ${
              saving ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850]'
            }`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {message && (
            <span className={`text-sm ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </span>
          )}
        </div>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-white/10 p-8">
        <h3 className="font-bold text-lg mb-6 uppercase tracking-wide">Developer Credit (Locked)</h3>
        <div className="bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl p-6 mb-6">
          <p className="text-secondary text-sm mb-2">The developer credit is hardcoded and cannot be edited or removed from the admin dashboard.</p>
          <div className="flex items-center gap-4">
            <span className="font-semibold text-[#d4af37]">👨‍💻 Developed by Salman Furniturewala</span>
            <a href="tel:+917303321019" className="text-[#d4af37] underline decoration-[#d4af37]/40 hover:text-[#e6c850] text-sm">+91 7303321019</a>
          </div>
        </div>
      </div>
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
