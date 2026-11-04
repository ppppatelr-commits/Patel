import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { readStore, updateStore } from '@/lib/menu-store';
import { MENU_DATA } from '@/lib/menu-data';
import { ensureSettingsColumns } from '@/lib/db-migrate';

export const dynamic = 'force-dynamic';

const DEFAULT_TAGLINE = 'Premium Authentic Indian Cuisine';
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    if (supabase) {
      await ensureSettingsColumns();

      const { data } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .maybeSingle();

      if (data) {
        return NextResponse.json({
          name: data.name,
          phone1: data.phone_1,
          phone2: data.phone_2,
          tagline: data.tagline,
          logoUrl: data.logo_url || '/logo.png',
        });
      }
    }

    const store = await readStore();
    return NextResponse.json({
      name: store.settings.name,
      phone1: store.settings.phone_1,
      phone2: store.settings.phone_2,
      tagline: store.settings.tagline ?? DEFAULT_TAGLINE,
      logoUrl: store.settings.logo_url || '/logo.png',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const phone1 = String(body.phone1 ?? '').trim();
    const phone2 = String(body.phone2 ?? '').trim();
    const tagline = String(body.tagline ?? '').trim();
    const logoUrl = String(body.logoUrl || '/logo.png').trim();

    if (!name) {
      return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    if (supabase) {
      const colOk = await ensureSettingsColumns();

      const row: Record<string, unknown> = {
        id: '00000000-0000-0000-0000-000000000001',
        name,
        phone_1: phone1,
        phone_2: phone2,
        logo_url: logoUrl,
        developer_name: MENU_DATA.restaurant.developerName,
        developer_phone: MENU_DATA.restaurant.developerPhone,
        developer_credit_locked: true,
      };
      if (colOk) row.tagline = tagline;

      const { error } = await supabase.from('restaurant_settings').upsert([row]);
      if (error) throw error;
    } else {
      await updateStore((store) => {
        store.settings.name = name;
        store.settings.phone_1 = phone1;
        store.settings.phone_2 = phone2;
        store.settings.tagline = tagline;
        store.settings.logo_url = logoUrl;
        store.settings.updated_at = new Date().toISOString();

        // The developer credit is hardcoded and must never be editable.
        store.settings.developer_name = MENU_DATA.restaurant.developerName;
        store.settings.developer_phone = MENU_DATA.restaurant.developerPhone;
        store.settings.developer_credit_locked = true;
      });
    }

    return NextResponse.json({ success: true, name, phone1, phone2, tagline, logoUrl });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
