'use client';

import { useEffect, useState } from 'react';
import { MENU_DATA } from '@/lib/menu-data';

export function useRestaurantSettings() {
  const [settings, setSettings] = useState({
    name: MENU_DATA.restaurant.name,
    tagline: MENU_DATA.restaurant.tagline,
    phone1: MENU_DATA.restaurant.phone1,
    phone2: MENU_DATA.restaurant.phone2,
    logoUrl: '/logo.png',
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => {
        if (!s || cancelled) return;
        // Respect saved empty strings (so clearing a phone/tagline actually removes it).
        setSettings({
          name: typeof s.name === 'string' && s.name ? s.name : MENU_DATA.restaurant.name,
          tagline: typeof s.tagline === 'string' ? s.tagline : MENU_DATA.restaurant.tagline,
          phone1: typeof s.phone1 === 'string' ? s.phone1 : MENU_DATA.restaurant.phone1,
          phone2: typeof s.phone2 === 'string' ? s.phone2 : MENU_DATA.restaurant.phone2,
          logoUrl: typeof s.logoUrl === 'string' && s.logoUrl ? s.logoUrl : '/logo.png',
        });
      })
      .catch(() => {
        // Keep the defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
