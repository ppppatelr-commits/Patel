// Restaurant origin (geocoded via OpenStreetMap Nominatim for Crawford Market, Mumbai)
export const RESTAURANT_ORIGIN = {
  lat: 18.951125,
  lng: 72.834812,
  address:
    'Topiwala Mansion, 95/97, Mohammed Ali Road, Near Crawford Market, Masjid Bandar West, Mumbai, Maharashtra 400003, India',
};

export interface DeliveryZone {
  id: string;
  name: string;
  minOrder: number;
  maxRadiusKm: number;
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'nearby', name: 'Nearby Delivery', minOrder: 500, maxRadiusKm: 0.8 },
  { id: 'extended', name: 'Extended Delivery', minOrder: 1000, maxRadiusKm: 1.5 },
];

export const MAX_DELIVERY_RADIUS_KM = 1.5;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function zoneForRadius(radiusKm: number): DeliveryZone | null {
  if (radiusKm <= 0.8) return DELIVERY_ZONES[0];
  if (radiusKm <= 1.5) return DELIVERY_ZONES[1];
  return null;
}

export function getZoneById(id: string): DeliveryZone | undefined {
  return DELIVERY_ZONES.find((z) => z.id === id);
}

export function isServiceableZone(id: string): boolean {
  return DELIVERY_ZONES.some((z) => z.id === id);
}

// Backwards-compatible helper (kept for any existing callers)
export function inferZoneFromArea(area: string): string | null {
  return null;
}

export function rotiOnlyRestrictionMessage(): string {
  return 'Sorry! We do not accept orders for Roti or Chapati alone.\n\nPlease add at least one main dish or another eligible menu item to continue with your order.\n\nThank you for understanding!';
}

export function isRotiOrChapatiName(name: string): boolean {
  return /\b(roti|chapati)\b/i.test(name || '');
}