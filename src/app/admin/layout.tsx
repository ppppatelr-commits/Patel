import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AdminSignOutButton } from '@/components/admin-sign-out';
import ClearCacheButton from '@/components/clear-cache-button';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const isAdmin = session.role === 'admin';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Sidebar */}
      <nav className="fixed inset-y-0 left-0 z-50 w-64 bg-[#141414] border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
            <div>
              <h2 className="text-lg font-bold uppercase tracking-tight text-[#d4af37]">Patel</h2>
              <p className="text-xs text-secondary">Admin Panel</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem href="/admin" label="Dashboard" icon="D" />
          <NavItem href="/admin/categories" label="Menu Categories" icon="C" />
          <NavItem href="/admin/items" label="Menu Items" icon="M" />
          <NavItem href="/admin/media" label="Media Library" icon="I" />
          <NavItem href="/admin/image-manager" label="Smart Image Manager" icon="G" />
          <NavItem href="/admin/qrcode" label="QR Code & Stands" icon="Q" />
          {isAdmin && <NavItem href="/admin/settings" label="Restaurant Settings" icon="S" />}
          {isAdmin && <NavItem href="/admin/users" label="User Management" icon="U" />}
          {isAdmin && <NavItem href="/admin/backup" label="Backup & Restore" icon="B" />}
          <NavItem href="/admin/account" label="My Account" icon="A" />
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3">
            <ClearCacheButton />
          </div>
          <div className="mb-3">
            <div className="text-sm font-semibold text-white truncate">{session.email.split('@')[0]}</div>
            <div className="text-xs text-secondary truncate">{session.email}</div>
            <span
              className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-[#d4af37]/15 text-[#d4af37]' : 'bg-white/10 text-white/70'
              }`}
            >
              {isAdmin ? 'Administrator' : 'User'}
            </span>
          </div>
          <AdminSignOutButton />
        </div>
      </nav>

      {/* Main content */}
      <div className="ml-64 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wide text-white">Admin Dashboard UNIQUE_LAYOUT_MARKER_999</h1>
          <div className="flex items-center gap-3">
            <ClearCacheButton />
            <a href="/" target="_blank" rel="noreferrer" className="text-sm text-[#d4af37] hover:text-[#e6c850] transition-colors flex items-center gap-1">
              View Live Site &rarr;
            </a>
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-white/5 hover:text-[#d4af37] text-white/70"
    >
      <span className="w-6 h-6 grid place-items-center rounded-md bg-white/5 text-[11px] font-bold text-[#d4af37]">
        {icon}
      </span>
      {label}
    </a>
  );
}
