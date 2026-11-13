'use client';

import type { CartItem, CustomerInfo } from '@/lib/cart';
import { formatINR, cartSubtotal, cartTotalQty } from '@/lib/cart';

interface OrderReviewProps {
  open: boolean;
  cart: CartItem[];
  customer: CustomerInfo;
  onEditCart: () => void;
  onEditDetails: () => void;
  onContinueShopping: () => void;
  onPlaceOrder: () => void;
  onClose: () => void;
}

export default function OrderReview({
  open,
  cart,
  customer,
  onEditCart,
  onEditDetails,
  onContinueShopping,
  onPlaceOrder,
  onClose,
}: OrderReviewProps) {
  if (!open) return null;
  const subtotal = cartSubtotal(cart);
  const totalQty = cartTotalQty(cart);

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#141414] rounded-t-2xl sm:rounded-2xl border border-white/10">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-[#d4af37] uppercase tracking-wide">Order Review</h2>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-white hover:text-[#d4af37]">
            &times;
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 text-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 space-y-1">
            <p className="font-semibold text-white">Customer Details</p>
            <p className="text-secondary">Name: {customer.name}</p>
            <p className="text-secondary">Mobile: {customer.mobile}</p>
            <p className="text-secondary">Order Type: {customer.orderType === 'delivery' ? 'Home Delivery' : 'Pickup / Takeaway'}</p>
            {customer.orderType === 'delivery' && (
              <div className="pt-1">
                <p className="text-secondary">Flat No: {customer.flat}</p>
                <p className="text-secondary">Building: {customer.building}</p>
                <p className="text-secondary">Area: {customer.area}</p>
                <p className="text-secondary">City: {customer.city}</p>
                {customer.landmark && <p className="text-secondary">Landmark: {customer.landmark}</p>}
                {customer.straightLineKm != null && <p className="text-secondary">Straight-line Distance: {customer.straightLineKm.toFixed(2)} km</p>}
                {customer.roadDistanceKm != null && <p className="text-secondary">Road Distance: {customer.roadDistanceKm.toFixed(2)} km</p>}
                {customer.deliveryZoneName && <p className="text-secondary">Delivery Zone: {customer.deliveryZoneName}</p>}
                {customer.minOrder > 0 && <p className="text-secondary">Minimum Required Order: {formatINR(customer.minOrder)}</p>}
                {customer.deliveryPin && <p className="text-secondary">Delivery Pin: {customer.deliveryPin}</p>}
              </div>
            )}
          </div>

          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-3">
            <p className="font-semibold text-white mb-2">Order Details</p>
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={item.id} className="border-b border-white/5 pb-2 last:border-0">
                  <p className="text-white font-medium">{idx + 1}. {item.name}</p>
                  <p className="text-secondary text-xs">Price: {formatINR(item.price)} | Qty: {item.qty}</p>
                  <p className="text-[#d4af37] text-xs font-semibold">Total: {formatINR(item.price * item.qty)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-secondary">Total Items</span>
              <span className="text-white font-semibold">{totalQty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Subtotal</span>
              <span className="text-[#d4af37] font-bold">{formatINR(subtotal)}</span>
            </div>
            {customer.instructions && customer.instructions.trim() && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-secondary text-xs">Special Instructions:</p>
                <p className="text-white text-xs">{customer.instructions}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button onClick={onPlaceOrder} className="w-full py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1ebe57]">
              Place Order on WhatsApp
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onEditCart} className="py-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white font-semibold text-xs hover:bg-[#222]">
                Edit Cart
              </button>
              <button onClick={onEditDetails} className="py-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white font-semibold text-xs hover:bg-[#222]">
                Edit Customer Details
              </button>
            </div>
            <button onClick={onContinueShopping} className="w-full py-2.5 rounded-xl border border-white/10 text-secondary text-xs font-semibold hover:text-[#d4af37]">
              Continue adding your dish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}