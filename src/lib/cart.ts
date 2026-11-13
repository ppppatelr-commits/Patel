export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
}

export interface CustomerInfo {
  name: string;
  mobile: string;
  orderType: 'delivery' | 'pickup';
  flat: string;
  building: string;
  area: string;
  city: string;
  landmark: string;
  instructions: string;
  deliveryZone: string;
  deliveryZoneName: string;
  minOrder: number;
  deliveryPin: string;
  customerLat: number | null;
  customerLng: number | null;
  straightLineKm: number | null;
  roadDistanceKm: number | null;
}

export const WHATSAPP_NUMBER = '918082064786';
export const CART_STORAGE_KEY = 'patel_cart_v1';

export function formatINR(n: number): string {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

export function itemTotal(item: CartItem): number {
  return item.price * item.qty;
}

export function cartSubtotal(cart: CartItem[]): number {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

export function cartTotalQty(cart: CartItem[]): number {
  return cart.reduce((s, i) => s + i.qty, 0);
}

export function validateMobile(m: string): boolean {
  const digits = (m || '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits);
}

export interface SyncResult {
  cart: CartItem[];
  changes: string[];
}

export function syncCartWithMenu(cart: CartItem[], items: any[]): SyncResult {
  const byId = new Map(items.map((i: any) => [i.id, i]));
  const next: CartItem[] = [];
  const changes: string[] = [];
  for (const c of cart) {
    const m = byId.get(c.id) as any;
    if (!m || m.is_available === false) {
      changes.push(`${c.name} is no longer available and was removed from your cart.`);
      continue;
    }
    let updated = { ...c };
    if (m.price !== c.price) {
      changes.push(`${c.name} price updated from ${formatINR(c.price)} to ${formatINR(m.price)}.`);
      updated.price = m.price;
    }
    if (m.name && m.name !== c.name) {
      updated.name = m.name;
    }
    next.push(updated);
  }
  return { cart: next, changes };
}

function addressBlock(c: CustomerInfo): string {
  if (c.orderType !== 'delivery') return '';
  const lines = [
    `Flat No: ${c.flat}`,
    `Building: ${c.building}`,
    `Area: ${c.area}`,
    `City: ${c.city}`,
  ];
  if (c.landmark && c.landmark.trim()) lines.push(`Landmark: ${c.landmark.trim()}`);
  return lines.join('\n');
}

export function generateOrderMessage(cart: CartItem[], c: CustomerInfo, isUpdate: boolean = false): string {
  const lines: string[] = [];
  lines.push('Hello Patel Restaurant!');
  lines.push('');
  if (isUpdate) {
    lines.push('I would like to update my previously submitted order.');
  } else {
    lines.push('I would like to place an order.');
  }
  lines.push('');
  lines.push('========================');
  lines.push('CUSTOMER INFORMATION');
  lines.push('========================');
  lines.push('');
  lines.push(`Name: ${c.name}`);
  lines.push(`Mobile: ${c.mobile}`);
  lines.push(`Order Type: ${c.orderType === 'delivery' ? 'Home Delivery' : 'Pickup / Takeaway'}`);
  lines.push('');
  if (c.orderType === 'delivery') {
    lines.push('Delivery Address:');
    lines.push(addressBlock(c));
    lines.push('');
    if (c.straightLineKm != null) {
      lines.push(`Straight-line Distance: ${c.straightLineKm.toFixed(2)} km`);
    }
    if (c.roadDistanceKm != null) {
      lines.push(`Road Distance: ${c.roadDistanceKm.toFixed(2)} km`);
    }
    if (c.deliveryZoneName) {
      lines.push(`Delivery Zone: ${c.deliveryZoneName}`);
    }
    if (c.minOrder && c.minOrder > 0) {
      lines.push(`Minimum Required Order: ${formatINR(c.minOrder)}`);
    }
    if (c.deliveryPin && c.deliveryPin.trim()) {
      lines.push(`Delivery Location Pin: ${c.deliveryPin.trim()}`);
    }
    lines.push('');
  }
  lines.push('========================');
  lines.push(isUpdate ? 'UPDATED ORDER DETAILS' : 'ORDER DETAILS');
  lines.push('========================');
  lines.push('');
  cart.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name}`);
    lines.push(`Price: ${formatINR(item.price)}`);
    lines.push(`Quantity: ${item.qty}`);
    lines.push(`Total: ${formatINR(item.price * item.qty)}`);
    lines.push('');
  });
  lines.push('========================');
  lines.push('ORDER SUMMARY');
  lines.push('========================');
  lines.push('');
  lines.push(`Total Items: ${cartTotalQty(cart)}`);
  lines.push(`Subtotal: ${formatINR(cartSubtotal(cart))}`);
  lines.push('');
  if (c.instructions && c.instructions.trim()) {
    lines.push('Special Instructions:');
    lines.push(c.instructions.trim());
    lines.push('');
  }
  lines.push('========================');
  lines.push('');
  lines.push('Thank you!');
  lines.push('Patel Restaurant');
  return lines.join('\n');
}

export function generateModifyCancelMessage(c: CustomerInfo): string {
  const lines: string[] = [];
  lines.push('Hello Patel Restaurant,');
  lines.push('');
  lines.push('I would like to modify/cancel my previously submitted order.');
  lines.push('');
  lines.push(`Customer Name: ${c.name || ''}`);
  lines.push(`Mobile Number: ${c.mobile || ''}`);
  lines.push('Previous Order Details:');
  lines.push('');
  lines.push('Please assist me.');
  return lines.join('\n');
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function emptyCustomer(): CustomerInfo {
  return {
    name: '',
    mobile: '',
    orderType: 'delivery',
    flat: '',
    building: '',
    area: '',
    city: '',
    landmark: '',
    instructions: '',
    deliveryZone: '',
    deliveryZoneName: '',
    minOrder: 0,
    deliveryPin: '',
    customerLat: null,
    customerLng: null,
    straightLineKm: null,
    roadDistanceKm: null,
  };
}