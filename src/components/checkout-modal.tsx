'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CustomerInfo } from '@/lib/cart';
import { validateMobile } from '@/lib/cart';
import { DELIVERY_ZONES, getZoneById, isServiceableZone, zoneForRadius, RESTAURANT_ORIGIN, haversineKm } from '@/lib/delivery';
import dynamic from 'next/dynamic';

const DeliveryMap = dynamic(() => import('@/components/delivery-map'), { ssr: false });

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  initial: CustomerInfo;
  subtotal: number;
  onSubmit: (info: CustomerInfo) => void;
  onBackToCart: () => void;
}

export default function CheckoutModal({ open, onClose, initial, subtotal, onSubmit, onBackToCart }: CheckoutModalProps) {
  const [form, setForm] = useState<CustomerInfo>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [zoneTouched, setZoneTouched] = useState(false);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const updateZoneFromCoords = async (lat: number, lng: number) => {
    setDistanceLoading(true);
    setDistanceError(false);
    const straight = haversineKm(RESTAURANT_ORIGIN.lat, RESTAURANT_ORIGIN.lng, lat, lng);
    let road: number | null = null;
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originLat: RESTAURANT_ORIGIN.lat,
          originLng: RESTAURANT_ORIGIN.lng,
          destLat: lat,
          destLng: lng,
        }),
      });
      const data = await res.json();
      if (typeof data.roadDistanceKm === 'number') road = data.roadDistanceKm;
      else if (data.source === 'none') setDistanceError(true);
    } catch {
      setDistanceError(true);
    }
    const zone = zoneForRadius(straight);
    setForm((f) => ({
      ...f,
      customerLat: lat,
      customerLng: lng,
      straightLineKm: straight,
      roadDistanceKm: road,
      deliveryZone: zone ? zone.id : 'outside',
      deliveryZoneName: zone ? zone.name : 'Outside delivery radius',
      minOrder: zone ? zone.minOrder : 0,
      deliveryPin: f.deliveryPin || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    }));
    setDistanceLoading(false);
  };

  const requestCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser. Please search for your address and select the map pin manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setForm((f) => ({ ...f, customerLat: lat, customerLng: lng }));
        // Reverse geocode
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const addr = data?.address || {};
          const area = addr.suburb || addr.neighbourhood || addr.road || addr.city_district || '';
          const city = addr.city || addr.town || addr.state_district || 'Mumbai';
          setForm((f) => ({ ...f, area: area || f.area, city: city || f.city }));
        } catch {
          // keep manual entry
        }
        await updateZoneFromCoords(lat, lng);
        setLocationPromptOpen(false);
      },
      () => {
        setLocationError('Location permission denied or unavailable. Please search for your address and select the map pin manually.');
      }
    );
  };

  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
      setZoneTouched(false);
      setLocationPromptOpen(false);
      setLocationError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k: keyof CustomerInfo, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!validateMobile(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile number';
    if (form.orderType === 'delivery') {
      if (!form.flat.trim()) e.flat = 'Required';
      if (!form.building.trim()) e.building = 'Required';
      if (!form.area.trim()) e.area = 'Required';
      if (!form.city.trim()) e.city = 'Required';
      if (!form.customerLat || !form.customerLng) {
        e.deliveryZone = 'Please confirm your delivery location on the map';
      } else if (form.deliveryZone === 'outside' || !isServiceableZone(form.deliveryZone)) {
        e.deliveryZone = 'Delivery is unavailable for this location';
      } else if (distanceError || form.roadDistanceKm == null) {
        e.deliveryZone = 'Unable to verify delivery distance. Please retry or contact the restaurant.';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (form.orderType === 'delivery' && (!form.customerLat || !form.customerLng)) {
      setLocationPromptOpen(true);
      return;
    }
    if (validate()) onSubmit(form);
  };

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 rounded-xl bg-[#1a1a1a] border ${err ? 'border-red-500' : 'border-white/10'} text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none text-sm`;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#141414] rounded-t-2xl sm:rounded-2xl border border-white/10">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-[#d4af37] uppercase tracking-wide">Checkout Details</h2>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-[#1a1a1a] text-white hover:text-[#d4af37]">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs text-secondary mb-1">Customer Name *</label>
            <input className={inputCls(errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name" />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">Mobile Number *</label>
            <input className={inputCls(errors.mobile)} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit mobile" inputMode="numeric" />
            {errors.mobile && <p className="text-xs text-red-400 mt-1">{errors.mobile}</p>}
          </div>

          <div>
            <label className="block text-xs text-secondary mb-2">Order Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => set('orderType', 'delivery')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${form.orderType === 'delivery' ? 'bg-[#d4af37] text-[#0a0a0a] border-[#d4af37]' : 'bg-[#1a1a1a] text-white border-white/10'}`}
              >
                Home Delivery
              </button>
              <button
                type="button"
                onClick={() => set('orderType', 'pickup')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${form.orderType === 'pickup' ? 'bg-[#d4af37] text-[#0a0a0a] border-[#d4af37]' : 'bg-[#1a1a1a] text-white border-white/10'}`}
              >
                Pickup / Takeaway
              </button>
            </div>
          </div>

          {form.orderType === 'delivery' && (
            <div className="space-y-3 border-t border-white/5 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-secondary mb-1">House / Flat No *</label>
                  <input className={inputCls(errors.flat)} value={form.flat} onChange={(e) => set('flat', e.target.value)} placeholder="Flat no." />
                  {errors.flat && <p className="text-xs text-red-400 mt-1">{errors.flat}</p>}
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1">Building / Street *</label>
                  <input className={inputCls(errors.building)} value={form.building} onChange={(e) => set('building', e.target.value)} placeholder="Building" />
                  {errors.building && <p className="text-xs text-red-400 mt-1">{errors.building}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-secondary mb-1">Area / Locality *</label>
                  <input className={inputCls(errors.area)} value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Area" />
                  {errors.area && <p className="text-xs text-red-400 mt-1">{errors.area}</p>}
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1">City *</label>
                  <input className={inputCls(errors.city)} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
                  {errors.city && <p className="text-xs text-red-400 mt-1">{errors.city}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Landmark (optional)</label>
                <input className={inputCls()} value={form.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Landmark" />
              </div>

              {/* Current location */}
              <button
                type="button"
                onClick={requestCurrentLocation}
                className="w-full py-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-sm font-semibold hover:bg-[#222]"
              >
                Use My Current Location
              </button>

              {/* Map */}
              <div className="space-y-2">
                <DeliveryMap
                  lat={form.customerLat ?? RESTAURANT_ORIGIN.lat}
                  lng={form.customerLng ?? RESTAURANT_ORIGIN.lng}
                  onChange={(lat, lng) => {
                    setForm((f) => ({ ...f, customerLat: lat, customerLng: lng }));
                    updateZoneFromCoords(lat, lng);
                  }}
                />
                  <p className="text-xs text-secondary">
                    Straight-line distance: {form.straightLineKm != null ? form.straightLineKm.toFixed(2) + ' km' : '...'}
                    {form.roadDistanceKm != null ? ` | Road distance: ${form.roadDistanceKm.toFixed(2)} km` : ''}
                  </p>
                  {form.deliveryZoneName && (
                    <p className="text-xs text-secondary">
                      Delivery Zone: {form.deliveryZoneName} | Minimum: ₹{form.minOrder}
                      {subtotal < form.minOrder ? ` | Add ₹${form.minOrder - subtotal} more` : ' | Minimum satisfied'}
                    </p>
                  )}
                  {form.deliveryZone === 'outside' && (
                    <p className="text-xs text-red-400">
                      Sorry! Your location is outside our delivery radius.
                    </p>
                  )}
                </div>

              <div>
                <label className="block text-xs text-secondary mb-1">Delivery Location Pin (optional)</label>
                <input className={inputCls()} value={form.deliveryPin} onChange={(e) => set('deliveryPin', e.target.value)} placeholder="Paste map link or coordinates" />
              </div>
            </div>
          )}

          {locationError && (
            <p className="text-xs text-red-400">{locationError}</p>
          )}

          <div>
            <label className="block text-xs text-secondary mb-1">Special Instructions</label>
            <textarea
              className={inputCls()}
              value={form.instructions}
              onChange={(e) => set('instructions', e.target.value)}
              placeholder="Cooking preferences, packing notes, etc."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onBackToCart}
              className="flex-1 py-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white font-semibold text-sm hover:bg-[#222]"
            >
              Back to Cart
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); submit(e as any); }}
              className="flex-1 py-2.5 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm hover:bg-[#e6c850]"
            >
              Review Order
            </button>
          </div>
        </form>

        {locationPromptOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#141414] border border-[#d4af37]/30 rounded-2xl p-5 text-center">
              <h3 className="text-lg font-bold text-[#d4af37] mb-2">Choose Your Delivery Location</h3>
              <p className="text-sm text-secondary mb-4">
                Your details are filled in, but your delivery location is still missing. Please choose your current location or enter your address manually to check delivery availability and minimum order requirements.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={requestCurrentLocation}
                  className="w-full py-2.5 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm hover:bg-[#e6c850]"
                >
                  Use My Current Location
                </button>
                <button
                  type="button"
                  onClick={() => setLocationPromptOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white font-semibold text-sm hover:bg-[#222]"
                >
                  Enter Address Manually
                </button>
              </div>
              {locationError && <p className="text-xs text-red-400 mt-3">{locationError}</p>}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}