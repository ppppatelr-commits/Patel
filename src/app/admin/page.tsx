export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getPublicMenu } from '@/lib/public-menu';
import { getUnifiedMediaList } from '@/lib/media-list';
import { MENU_DATA } from '@/lib/menu-data';

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const isAdmin = session.role === 'admin';

  // Stats (live menu store, not the static PDF data)
  const menu = await getPublicMenu();
  const categories = menu.categories;
  const totalItems = menu.items.length;

  const settings = {
    name: menu.settings.name,
    phone_1: menu.settings.phone_1,
    phone_2: menu.settings.phone_2,
    developer_name: menu.settings.developer_name,
  };

  const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>;
  const allDishEntries: { dish: string; category: string }[] = [];
  for (const [cat, catItems] of Object.entries(itemsRecord)) {
    for (const d of catItems) allDishEntries.push({ dish: d.name, category: cat });
  }

  const mediaItems: any[] = [];
  let itemsMissingImagesCount = allDishEntries.length;

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

    const covered = new Set<string>();
    for (const item of mediaItems) {
      if (item.status === 'active' && item.dish_name) covered.add(item.dish_name.toLowerCase());
    }
    itemsMissingImagesCount = allDishEntries.filter((d) => !covered.has(d.dish.toLowerCase())).length;
  } catch (err) {
    // ignore
  }

  const mediaCount = mediaItems.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Dashboard</h1>
        <p className="text-secondary">Overview of your restaurant menu</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <a href="/admin/categories" className="block">
          <StatCard label="Total Categories" value={categories.length} icon="📂" />
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
            <span className="text-white font-medium">{settings.phone_1}</span>
          </div>
          <div>
            <span className="text-secondary">Phone 2:</span>{' '}
            <span className="text-white font-medium">{settings.phone_2}</span>
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