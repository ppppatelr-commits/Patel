'use client';

import { formatINR } from '@/lib/cart';

interface StickyCartBarProps {
  count: number;
  subtotal: number;
  visible: boolean;
  onViewCart: () => void;
}

export default function StickyCartBar({ count, subtotal, visible, onViewCart }: StickyCartBarProps) {
  if (!visible || count <= 0) return null;
  return (
    <div
      className="sm:hidden fixed left-0 right-0 z-[40] px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      <div className="max-w-7xl mx-auto bg-[#1a1a1a] border border-[#d4af37]/40 rounded-2xl shadow-2xl flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 grid place-items-center rounded-xl bg-[#d4af37]/15 text-[#d4af37] flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </span>
          <div className="min-w-0">
            <p className="text-xs text-secondary leading-tight">{count} item{count === 1 ? '' : 's'}</p>
            <p className="text-sm font-bold text-[#d4af37] leading-tight">{formatINR(subtotal)}</p>
          </div>
        </div>
        <button
          onClick={onViewCart}
          className="px-4 py-2.5 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm whitespace-nowrap"
        >
          View Cart
        </button>
      </div>
    </div>
  );
}