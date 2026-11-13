'use client';

import type { CartItem } from '@/lib/cart';
import { formatINR, cartSubtotal, cartTotalQty } from '@/lib/cart';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  notice?: string[];
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  onContinue: () => void;
  onModifyCancel: () => void;
}

export default function CartDrawer({
  open,
  onClose,
  cart,
  notice,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
  onCheckout,
  onContinue,
  onModifyCancel,
}: CartDrawerProps) {
  if (!open) return null;
  const subtotal = cartSubtotal(cart);
  const totalQty = cartTotalQty(cart);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-[#0a0a0a] border-l border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-[#d4af37] uppercase tracking-wide">
            Your Cart ({totalQty})
          </h2>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-white hover:text-[#d4af37]">
            &times;
          </button>
        </div>

        {notice && notice.length > 0 && (
          <div className="px-4 py-3 bg-[#d4af37]/10 border-b border-[#d4af37]/30 text-xs text-[#d4af37] space-y-1">
            {notice.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-secondary py-12">
              <p>Your cart is empty.</p>
              <button onClick={onContinue} className="mt-4 text-[#d4af37] underline text-sm">
                Continue adding your dish
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 flex gap-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/patel-logo-gold.png'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white leading-tight truncate">{item.name}</p>
                  <p className="text-xs text-secondary mt-0.5">{formatINR(item.price)} each</p>
                  <p className="text-sm font-bold text-[#d4af37] mt-1">{formatINR(item.price * item.qty)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onDecrease(item.id)}
                      className="w-8 h-8 grid place-items-center rounded-lg border border-white/10 bg-[#0a0a0a] text-white hover:text-[#d4af37]"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                    <button
                      onClick={() => onIncrease(item.id)}
                      className="w-8 h-8 grid place-items-center rounded-lg border border-white/10 bg-[#0a0a0a] text-white hover:text-[#d4af37]"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="ml-auto text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-white/5 px-4 py-4 space-y-3 bg-[#0a0a0a]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">Subtotal</span>
              <span className="font-bold text-[#d4af37]">{formatINR(subtotal)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onContinue}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white font-semibold text-sm hover:bg-[#222]"
              >
                Continue adding your dish
              </button>
              <button
                onClick={onCheckout}
                className="flex-1 py-2.5 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm hover:bg-[#e6c850]"
              >
                Checkout
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClear}
                className="flex-1 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10"
              >
                Clear Cart
              </button>
              <button
                onClick={onModifyCancel}
                className="flex-1 py-2 rounded-xl border border-white/10 text-secondary text-xs font-semibold hover:text-[#d4af37]"
              >
                Modify / Cancel Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}