'use client';

import { useRestaurantSettings } from '@/lib/use-restaurant-settings';

export function PhoneDisplay({ className }: { className?: string }) {
  const settings = useRestaurantSettings();
  const phones = [settings.phone1, settings.phone2].filter((p) => p && p.trim());

  if (phones.length === 0) return null;

  return (
    <div className={className}>
      {phones.map((phone, index) => (
        <a
          key={`${phone}-${index}`}
          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
          className="hover:text-white transition-colors flex items-center gap-1"
        >
          <span className="text-[#d4af37]">📞</span>
          <span className="hidden sm:inline">{phone}</span>
          <span className="sm:hidden">Call</span>
        </a>
      ))}
    </div>
  );
}
