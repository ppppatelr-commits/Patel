/**
 * Settings API — GitHub-backed.
 * Reads/writes data/restaurant.json and data/settings.json.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readRestaurant,
  writeRestaurant,
  readSettings,
  writeSettings,
  RestaurantData,
  SettingsData,
} from '@/lib/data-store';
import { ensureSeeded } from '@/lib/seed-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSeeded();
    const [restaurant, settings] = await Promise.all([
      readRestaurant(),
      readSettings(),
    ]);

    const r = restaurant?.restaurant;
    const s = settings?.settings;

    return NextResponse.json({
      name: r?.name || 'Patel Restaurant',
      phone1: r?.phone || '',
      phone2: r?.whatsapp || '',
      tagline: '',
      logoUrl: r?.logo || '/logo.png',
      address: r?.address || '',
      whatsapp: r?.whatsapp || '',
      openingHours: r?.openingHours || '',
      contactEmail: r?.contactEmail || '',
      socialLinks: r?.socialLinks || null,
      currency: s?.currency || 'INR',
      theme: s?.theme || 'dark',
      menuLayout: s?.menuLayout || 'grid',
      orderingSettings: s?.orderingSettings || {},
      whatsappOrdering: s?.whatsappOrdering !== false,
      imageSettings: s?.imageSettings || {},
    });
  } catch (err) {
    console.error('Settings GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      tagline,
      phone1,
      phone2,
      logoUrl,
      address,
      whatsapp,
      openingHours,
      contactEmail,
      socialLinks,
      currency,
      theme,
      menuLayout,
      orderingSettings,
      whatsappOrdering,
      imageSettings,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'Restaurant name is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Write restaurant info
    const restData: RestaurantData = (await readRestaurant()) || {
      restaurant: {
        name: 'Patel Restaurant',
        logo: '/logo.png',
        address: '',
        phone: '',
        whatsapp: '',
        createdAt: now,
        updatedAt: now,
      },
    };
    restData.restaurant = {
      ...restData.restaurant,
      name: String(name).trim(),
      logo: logoUrl || '/logo.png',
      address: address || null,
      phone: phone1 || null,
      whatsapp: whatsapp || null,
      openingHours: openingHours || null,
      contactEmail: contactEmail || null,
      socialLinks: socialLinks || null,
      updatedAt: now,
    };
    await writeRestaurant(restData);

    // Write app settings
    const settingsData: SettingsData = (await readSettings()) || {
      settings: {
        currency: 'INR',
        theme: 'dark',
        menuLayout: 'grid',
        orderingSettings: {},
        whatsappOrdering: true,
        imageSettings: {},
        createdAt: now,
        updatedAt: now,
      },
    };
    settingsData.settings = {
      ...settingsData.settings,
      currency: currency || 'INR',
      theme: theme || 'dark',
      menuLayout: menuLayout || 'grid',
      orderingSettings: orderingSettings || {},
      whatsappOrdering: whatsappOrdering !== false,
      imageSettings: imageSettings || {},
      updatedAt: now,
    };
    await writeSettings(settingsData);

    return NextResponse.json({
      success: true,
      name,
      phone1,
      phone2,
      logoUrl,
      address,
      whatsapp,
    });
  } catch (err) {
    console.error('Settings PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}