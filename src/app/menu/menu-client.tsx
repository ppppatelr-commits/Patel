'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MenuItem, MenuCategory, RestaurantSettings } from '@/types';
import { DeveloperCredit } from '@/components/footer';
import CartDrawer from '@/components/cart-drawer';
import CheckoutModal from '@/components/checkout-modal';
import OrderReview from '@/components/order-review';
import StickyCartBar from '@/components/sticky-cart-bar';
import InfoPopup from '@/components/info-popup';
import {
  CartItem,
  CustomerInfo,
  CART_STORAGE_KEY,
  emptyCustomer,
  formatINR,
  cartSubtotal,
  cartTotalQty,
  syncCartWithMenu,
  generateOrderMessage,
  generateModifyCancelMessage,
  buildWhatsAppUrl,
} from '@/lib/cart';
import {
  isRotiOrChapatiName,
  inferZoneFromArea,
  getZoneById,
  isServiceableZone,
  rotiOnlyRestrictionMessage,
} from '@/lib/delivery';

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
  const [previewQty, setPreviewQty] = useState(1);
  const [previewAdded, setPreviewAdded] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(emptyCustomer());
  const [syncNotice, setSyncNotice] = useState<string[]>([]);
  const [orderSent, setOrderSent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
      const sent = window.localStorage.getItem('patel_order_sent_v1');
      if (sent === '1') setOrderSent(true);
    } catch {}
    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, cartLoaded]);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      window.localStorage.setItem('patel_order_sent_v1', orderSent ? '1' : '0');
    } catch {}
  }, [orderSent, cartLoaded]);

  const syncCart = () => {
    const { cart: next, changes } = syncCartWithMenu(cart, items);
    setCart(next);
    setSyncNotice(changes);
    return changes;
  };

  const addToCart = (item: MenuItem, qty: number) => {
    const image = dishImageUrl(item, categories);
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + qty, price: item.price, name: item.name, image } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, image, qty }];
    });
    setToast(`${item.name} added to your cart`);
    window.setTimeout(() => setToast(null), 2000);
  };

  const increaseQty = (id: string) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c)));
  };

  const decreaseQty = (id: string) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const clearCart = () => {
    if (window.confirm('Clear all items from your cart?')) {
      setCart([]);
      setOrderSent(false);
    }
  };

  const openCart = () => {
    syncCart();
    setCartOpen(true);
  };

  const openCheckout = () => {
    const { cart: next, changes } = syncCartWithMenu(cart, items);
    setCart(next);
    setSyncNotice(changes);
    if (next.length === 0) return;
    if (next.length > 0 && next.every((c) => isRotiOrChapatiName(c.name))) {
      setPopup({ title: 'Minimum Order Requirement', message: rotiOnlyRestrictionMessage() });
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const handleCheckoutSubmit = (info: CustomerInfo) => {
    const { cart: next } = syncCartWithMenu(cart, items);
    setCart(next);
    if (next.length === 0) return;
    if (next.every((c) => isRotiOrChapatiName(c.name))) {
      setPopup({ title: 'Minimum Order Requirement', message: rotiOnlyRestrictionMessage() });
      return;
    }
    if (info.orderType === 'delivery') {
      const zone = getZoneById(info.deliveryZone);
      if (!zone || !isServiceableZone(info.deliveryZone)) {
        setPopup({ title: 'Delivery Unavailable', message: 'Sorry! We currently do not provide delivery to this location. Please contact Patel Restaurant for assistance.' });
        return;
      }
      const subtotalNow = cartSubtotal(next);
      if (subtotalNow < zone.minOrder) {
        setPopup({
          title: 'Minimum Order Requirement',
          message: `Your minimum order amount is ₹${zone.minOrder}. Add ₹${zone.minOrder - subtotalNow} more to place your order.`,
        });
        return;
      }
      info.minOrder = zone.minOrder;
      info.deliveryZoneName = zone.name;
    } else {
      info.minOrder = 0;
      info.deliveryZone = '';
      info.deliveryZoneName = '';
    }
    setCustomerInfo(info);
    setCheckoutOpen(false);
    setReviewOpen(true);
  };

  const openWhatsApp = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePlaceOrder = () => {
    const { cart: next } = syncCartWithMenu(cart, items);
    setCart(next);
    if (next.length === 0) {
      setPopup({ title: 'Empty Cart', message: 'Your cart is empty. Please add items before placing an order.' });
      return;
    }
    if (next.every((c) => isRotiOrChapatiName(c.name))) {
      setPopup({ title: 'Minimum Order Requirement', message: rotiOnlyRestrictionMessage() });
      return;
    }
    if (customerInfo.orderType === 'delivery') {
      const zone = getZoneById(customerInfo.deliveryZone);
      if (!zone || !isServiceableZone(customerInfo.deliveryZone)) {
        setPopup({ title: 'Delivery Unavailable', message: 'Sorry! We currently do not provide delivery to this location. Please contact Patel Restaurant for assistance.' });
        return;
      }
      if (customerInfo.roadDistanceKm == null) {
        setPopup({ title: 'Delivery Unavailable', message: 'Unable to verify delivery distance. Please retry or contact the restaurant.' });
        return;
      }
      const subtotalNow = cartSubtotal(next);
      if (subtotalNow < zone.minOrder) {
        setPopup({ title: 'Minimum Order Requirement', message: `Your minimum order amount is ₹${zone.minOrder}. Add ₹${zone.minOrder - subtotalNow} more to place your order.` });
        return;
      }
    }
    const msg = generateOrderMessage(next, customerInfo, orderSent);
    const url = buildWhatsAppUrl(msg);
    setOrderSent(true);
    openWhatsApp(url);
  };

  const handleModifyCancel = () => {
    const info = customerInfo.name || customerInfo.mobile ? customerInfo : emptyCustomer();
    const url = buildWhatsAppUrl(generateModifyCancelMessage(info));
    openWhatsApp(url);
  };

  const cartCount = cartTotalQty(cart);
  const isRotiOnlyCart = cart.length > 0 && cart.every((c) => isRotiOrChapatiName(c.name));

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
            onClick={openCart}
            className="relative w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-[#d4af37] hover:bg-[#222] transition-colors"
            title="Cart"
            aria-label="Open cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d4af37] text-[#0a0a0a] text-[10px] font-bold grid place-items-center">
                {cartCount}
              </span>
            )}
          </button>
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

      <main className={`max-w-7xl mx-auto px-4 py-6 ${cartCount > 0 ? 'pb-24 sm:pb-6' : ''}`}>
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
                    onClick={() => { setPreviewItem(item); setPreviewQty(1); setPreviewAdded(false); }}
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
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#d4af37]/15 text-[#d4af37]">Available</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setPreviewQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#0a0a0a] text-white hover:text-[#d4af37]"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{previewQty}</span>
                  <button
                    onClick={() => setPreviewQty((q) => q + 1)}
                    className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#0a0a0a] text-white hover:text-[#d4af37]"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  if (previewAdded) return;
                  addToCart(previewItem, previewQty);
                  setPreviewAdded(true);
                  window.setTimeout(() => {
                    setPreviewItem(null);
                    setPreviewQty(1);
                    setPreviewAdded(false);
                  }, 900);
                }}
                disabled={previewAdded}
                className="mt-4 w-full py-3 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm hover:bg-[#e6c850] disabled:opacity-70"
              >
                {previewAdded ? 'Added ✓' : `Add to Cart - ${formatINR(previewItem.price * previewQty)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        notice={syncNotice}
        onIncrease={increaseQty}
        onDecrease={decreaseQty}
        onRemove={removeItem}
        onClear={clearCart}
        onCheckout={openCheckout}
        onContinue={() => { setCartOpen(false); }}
        onModifyCancel={handleModifyCancel}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initial={customerInfo}
        subtotal={cartSubtotal(cart)}
        onSubmit={handleCheckoutSubmit}
        onBackToCart={() => { setCheckoutOpen(false); setCartOpen(true); }}
      />

      <OrderReview
        open={reviewOpen}
        cart={cart}
        customer={customerInfo}
        onEditCart={() => { setReviewOpen(false); setCartOpen(true); }}
        onEditDetails={() => { setReviewOpen(false); setCheckoutOpen(true); }}
        onContinueShopping={() => { setReviewOpen(false); }}
        onPlaceOrder={handlePlaceOrder}
        onClose={() => setReviewOpen(false)}
      />

      <StickyCartBar count={cartCount} subtotal={cartSubtotal(cart)} visible={cartCount > 0 && !previewItem && !cartOpen && !checkoutOpen && !reviewOpen} onViewCart={openCart} />

      <InfoPopup
        open={!!popup}
        title={popup?.title || ''}
        message={popup?.message || ''}
        onClose={() => setPopup(null)}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] bg-[#1a1a1a] border border-[#d4af37]/40 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
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