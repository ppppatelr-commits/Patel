'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MenuItem, MenuCategory, RestaurantSettings } from '@/types';
import { DeveloperCredit } from '@/components/footer';

interface MenuClientProps {
  initialSettings: RestaurantSettings;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
}

function placeholderUrl(name: string) {
  return `/api/placeholder/${encodeURIComponent(name)}`;
}

// Contents / description shown under certain dishes (from the printed menu).
const DISH_DESCRIPTIONS: Record<string, string> = {
  'HINDUSTAN PLATER': '2 PCS TANGDI, 2 PCS RESHMI KEBAB, 2 PCS KALIMIRI, 2 PCS PUDINA KEBAB, 2 PCS MALAI KEBAB, 2 PCS CHICKEN BANJARA KEBAB',
  'HINDUSTAN SPECIAL PLATER': 'Half Tandoori + 3 pcs Malai Tikka, 3 pcs Chicken Tikka, 3 pcs Pudina Kabab, Half Plate Seekh Kabab + 3 pcs Kali Miri Tikka + spl. Tikka',
  'JUMBO FAMILY PLATER': 'Half Kepsa Rice + 1 Gravy + 6 Roti, Half Tandoori + 3 pcs Malai Tikka, 3 pcs Chicken Tikka, 3 pcs Pudina Kabab, Half Plate Seekh Kabab + 3 pcs Kali Miri Tikka + spl. Tikka',
  'HINDUSTAN SPL GRAVY DISH': '2 pcs Chicken Tikka, 2 pcs Mutton Kebab, 12 Chicken Pieces, 12 Eggs',
};

function dishImageUrl(item: MenuItem, categories: MenuCategory[] = []): string {
  if (item.image_url) return item.image_url;
  if (item.image_filename) {
    if (item.image_filename.includes('/')) return `/media/dishes/${item.image_filename.replace(/^\/+/, '')}`;
    const cat = categories.find((c) => c.id === item.category_id);
    const slug = cat?.slug || 'general';
    return `/media/dishes/${slug}/${item.image_filename}`;
  }
  return placeholderUrl(item.name);
}

export default function MenuClient({
  initialSettings,
  initialCategories,
  initialItems,
}: MenuClientProps) {
  const settings: RestaurantSettings = initialSettings;
  const categories: MenuCategory[] = initialCategories;
  const items: MenuItem[] = initialItems;
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const [showQR, setShowQR] = useState(false);

  const itemCountByCategory = (catId: string) => items.filter((i) => i.category_id === catId && i.is_available).length;

  const firstImageForCategory = (catId: string): string => {
    const category = categories.find((c) => c.id === catId);
    if (category?.image_url) return category.image_url;
    const it = items.find((i) => i.category_id === catId && i.is_available);
    return it ? dishImageUrl(it, categories) : placeholderUrl('Patel');
  };

  const activeCategoryObj = categories.find((c) => c.id === activeCategory);

  const displayedItems = (() => {
    const base = searchQuery
      ? items.filter((i) => i.is_available && i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : activeCategory
        ? items.filter((i) => i.category_id === activeCategory && i.is_available)
        : [];
    return base.slice().sort((a, b) => a.sort_order - b.sort_order);
  })();

  const showCategories = !activeCategory && !searchQuery;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-white hover:bg-[#222] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <strong className="block text-sm font-bold uppercase tracking-wide truncate text-[#d4af37]">{settings?.name || 'Patel Restaurant'}</strong>
            <span className="block text-xs text-[#d4af37]/80 truncate">Discover Our Menu</span>
          </div>
          <button
            onClick={() => setShowQR(true)}
            className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-[#d4af37] hover:bg-[#222] transition-colors"
            title="Table QR Code"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
          </button>
          <button
            onClick={() => setSearchOpen((o) => !o)}
            className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-white hover:bg-[#222] transition-colors"
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </div>
        {searchOpen && (
          <div className="max-w-7xl mx-auto px-4 pb-3">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
            />
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <section className="mb-6">
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-[#d4af37]">Discover Our Menu</h1>
          <p className="text-[#d4af37]/80 text-sm mt-1">Premium Digital QR Menu • Scan & Browse</p>
        </section>

        {searchQuery && (
          <p className="text-xs text-secondary mb-4">{displayedItems.length} result{displayedItems.length === 1 ? '' : 's'} for "{searchQuery}"</p>
        )}

        {showCategories ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="group text-left bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden hover:border-[#d4af37]/40 transition-all hover:-translate-y-0.5"
              >
                <div className="relative aspect-[4/3] bg-[#0a0a0a] overflow-hidden">
                  <img
                    src={firstImageForCategory(cat.id)}
                    alt={cat.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).src = placeholderUrl(cat.name); }}
                  />
                </div>
                <div className="p-3">
                  <span className="block text-sm font-semibold uppercase tracking-wide text-white leading-tight">{cat.name}</span>
                  <span className="block text-xs text-secondary mt-1">{itemCountByCategory(cat.id)} items</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={() => { setActiveCategory(''); setSearchQuery(''); }}
              className="mb-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-[#d4af37] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              {searchQuery ? 'Clear search' : 'Back to categories'}
            </button>
            {!searchQuery && activeCategoryObj && (
              <h2 className="text-lg font-bold uppercase tracking-wide text-[#d4af37] mb-4 border-b border-white/5 pb-2">
                {activeCategoryObj.name}
              </h2>
            )}
            <div className="flex flex-col gap-3">
              {displayedItems.length > 0 ? (
                displayedItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPreviewItem(item)}
                    className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 items-stretch bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 text-left hover:border-[#d4af37]/40 transition-all hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#0a0a0a]">
                      <img
                        src={dishImageUrl(item, categories)}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = placeholderUrl(item.name); }}
                      />
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-white leading-tight flex-1 min-w-0">{item.name}</span>
                        <span className="text-[#d4af37] font-bold text-sm whitespace-nowrap">₹{item.price.toLocaleString('en-IN')}</span>
                      </div>
                      { (item.description || DISH_DESCRIPTIONS[item.name]) && (
                        <p className="text-xs text-secondary mt-1 line-clamp-3">{item.description || DISH_DESCRIPTIONS[item.name]}</p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-secondary">
                  <p>No items available.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Table QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowQR(false); }}>
          <div className="bg-[#141414] border border-[#d4af37]/30 rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl">
            <h3 className="text-lg font-bold text-[#d4af37] uppercase tracking-tight mb-1">{settings?.name || 'Patel Restaurant'}</h3>
            <p className="text-xs text-[#d4af37] font-semibold uppercase tracking-wider mb-4">Table Digital Menu QR</p>
            <div className="bg-white p-3 rounded-xl inline-block mb-3 shadow-inner">
              <img src="/qr-menu.png" alt="QR Code" className="w-48 h-48 object-contain mx-auto" />
            </div>
            <p className="text-xs text-secondary mb-4">Scan with any phone camera to view this live menu</p>
            <button
              onClick={() => setShowQR(false)}
              className="w-full py-2.5 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm hover:bg-[#e6c850] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Dish modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setPreviewItem(null); }}>
          <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl border border-white/10">
            <button onClick={() => setPreviewItem(null)} className="absolute top-3 right-3 z-20 w-9 h-9 grid place-items-center rounded-full bg-[#0a0a0a]/80 text-white hover:text-[#d4af37]">&times;</button>
            <div className="aspect-[16/10] bg-[#0a0a0a] overflow-hidden">
              <img src={dishImageUrl(previewItem, categories)} alt={previewItem.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = placeholderUrl(previewItem.name); }} />
            </div>
            <div className="p-5">
              <h3 className="font-bold text-xl text-white mb-1 leading-tight">{previewItem.name}</h3>
              <p className="text-[#d4af37] font-bold text-lg">₹{previewItem.price.toLocaleString('en-IN')}</p>
              {(previewItem.description || DISH_DESCRIPTIONS[previewItem.name]) && (
                <p className="text-secondary text-sm mt-3">{previewItem.description || DISH_DESCRIPTIONS[previewItem.name]}</p>
              )}
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#d4af37]/15 text-[#d4af37]">Available</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 bg-[#0a0a0a] border-t border-[#d4af37]/30 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/patel-logo-gold.png" alt="Patel Restaurant Logo" className="h-8 sm:h-9 w-auto object-contain flex-shrink-0" />
            <span className="font-bold text-sm sm:text-lg uppercase tracking-tight truncate text-[#d4af37]">{settings?.name || 'Patel Restaurant'}</span>
          </div>
          <DeveloperCredit phone="+917303321019" name="Salman Furniturewala" />
        </div>
      </footer>
    </div>
  );
}