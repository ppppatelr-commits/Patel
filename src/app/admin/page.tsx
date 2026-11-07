export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getPublicMenu } from '@/lib/public-menu';
import { getUnifiedMediaList } from '@/lib/media-list';

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const isAdmin = session.role === 'admin';

  // Stats (live menu store, not the static PDF data)
  const menu = await getPublicMenu();
  const categories = menu.categories;

  const settings = {
    name: menu.settings.name,
    phone_1: menu.settings.phone_1,
    phone_2: menu.settings.phone_2,
    developer_name: menu.settings.developer_name,
  };

  const supportedExt = new Set(['webp', 'png', 'jpg', 'jpeg', 'gif']);

  // Unique menu items by id (no duplicates)
  const uniqueItems = Array.from(
    new Map(menu.items.map((it) => [it.id, it])).values()
  );

  // Unique categories by id
  const uniqueCategories = Array.from(
    new Map(menu.categories.map((c) => [c.id, c])).values()
  );

  const mediaItems: any[] = [];
  let mediaCount = 0;
  let itemsMissingImagesCount = 0;

  try {
    const unified = await getUnifiedMediaList();
    for (const m of unified) {
      mediaItems.push({
        id: m.id,
        dish_name: m.dish_name,
        filename: m.filename,
        file_url: m.file_url,
        size_bytes: m.size_bytes,
        status: m.status,
        uploaded_at: m.uploaded_at,
      });
    }

    // Count unique supported image files (by path) in the media library
    const uniqueMediaPaths = new Set<string>();
    for (const m of mediaItems) {
      const ext = (m.filename || '').split('.').pop()?.toLowerCase() || '';
      if (supportedExt.has(ext) && m.status === 'active') {
        uniqueMediaPaths.add(m.file_url || m.filename);
      }
    }
    mediaCount = uniqueMediaPaths.size;

    // Build a set of available image paths for existence checks
    const availableImagePaths = new Set<string>();
    for (const m of mediaItems) {
      if (m.file_url) availableImagePaths.add(String(m.file_url).replace(/^\//, ''));
      if (m.filename) availableImagePaths.add(String(m.filename));
    }

    // Missing images: item image empty or not present in media library
    for (const item of uniqueItems) {
      const img = (item as any).image_url || (item as any).image;
      if (!img || String(img).trim() === '') {
        itemsMissingImagesCount += 1;
        continue;
      }
      const normalized = String(img).replace(/^\//, '');
      // Also handle image_filename-based paths
      const exists =
        availableImagePaths.has(normalized) ||
        availableImagePaths.has(normalized.split('/').pop() || '');
      if (!exists) itemsMissingImagesCount += 1;
    }
  } catch (err) {
    // ignore
  }

  const totalCategories = uniqueCategories.length;
  const totalItems = uniqueItems.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Dashboard</h1>
        <p className="text-secondary">Overview of your restaurant menu</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <a href="/admin/categories" className="block">
          <StatCard label="Total Categories" value={totalCategories} icon="📂" />
        </a>
        <a href="/admin/items" className="block">
          <StatCard label="Total Menu Items" value={totalItems} icon="🍽️" />
        </a>
        <a href="/admin/media" className="block">
          <StatCard label="Media Images" value={mediaCount} icon="🖼️" />
        </a>
        <StatCard label="Missing Images" value={itemsMissingImagesCount} icon="⚠️" className="border-[#d4af37]/30" />
        <StatCard label="Restaurant" value={1} icon="🏪" />
      </div>

      <div className="bg-[#141414] rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Restaurant Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-secondary">Name:</span>{' '}
            <span className="text-white font-medium">{settings.name}</span>
          </div>
          <div>
            <span className="text-secondary">Phone 1:</span>{' '}
            <span className="text-[#d4af37] font-medium">{settings.phone_1}</span>
          </div>
          <div>
            <span className="text-secondary">Phone 2:</span>{' '}
            <span className="text-[#d4af37] font-medium">{settings.phone_2}</span>
          </div>
          <div>
            <span className="text-secondary">Developer:</span>{' '}
            <span className="text-[#d4af37] font-medium">{settings.developer_name}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/items" className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-bold rounded-lg text-sm hover:bg-[#e6c850] transition-colors">
            Manage Dishes
          </a>
          <a href="/admin/media" className="px-4 py-2 bg-white/10 text-white font-medium rounded-lg text-sm hover:bg-white/20 transition-colors">
            Media Library
          </a>
          <a href="/admin/categories" className="px-4 py-2 bg-white/10 text-white font-medium rounded-lg text-sm hover:bg-white/20 transition-colors">
            Categories
          </a>
          <a href="/admin/qrcode" className="px-4 py-2 bg-white/10 text-white font-medium rounded-lg text-sm hover:bg-white/20 transition-colors">
            QR Stands
          </a>
          {isAdmin && (
            <a href="/admin/settings" className="px-4 py-2 bg-white/10 text-white font-medium rounded-lg text-sm hover:bg-white/20 transition-colors">
              Settings
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, className = '' }: { label: string; value: number; icon: string; className?: string }) {
  return (
    <div className={`bg-[#141414] rounded-xl border border-white/10 p-5 ${className}`}>
      <div className="flex justify-between items-center text-secondary text-xs uppercase tracking-wider mb-2">
        <span>{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
  );
}