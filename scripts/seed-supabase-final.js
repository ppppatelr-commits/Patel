// seed-supabase-final.js
// This script seeds the Supabase DB now that the tables exist.
// It generates proper UUIDs for any non‑UUID ids and maps items to the correct category UUID.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- Load .env.local ----------
const envPath = path.join(ROOT, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found – aborting');
  process.exit(1);
}
fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Supabase URL or service role key missing in .env.local');
  process.exit(1);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isUuid(val) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
}

async function seed() {
  const storePath = path.join(ROOT, 'data', 'menu-store.json');
  const { categories, items, settings } = JSON.parse(fs.readFileSync(storePath, 'utf8'));

  // ---- Settings -------------------------------------------------------
  const { data: existingSettings } = await supabase.from('restaurant_settings').select('id').limit(1);
  if (!existingSettings?.length) {
    const { error: sErr } = await supabase.from('restaurant_settings').insert({
      name: settings.name || 'HINDUSTAN RESTAURANT',
      phone_1: settings.phone_1 || '',
      phone_2: settings.phone_2 || '',
      address: settings.address || '',
      logo_url: settings.logo_url || '/logo.png',
      developer_name: settings.developer_name || '',
      developer_phone: settings.developer_phone || '',
      developer_credit_locked: true,
    });
    if (sErr) console.warn('⚠️ Settings insert error:', sErr.message);
    else console.log('✅ Settings inserted');
  } else {
    console.log('ℹ️ Settings already exist');
  }

  // ---- Categories ------------------------------------------------------
  const BATCH = 50;
  const slugToUuid = new Map(); // slug -> generated uuid
  let catInserted = 0;
  for (let i = 0; i < categories.length; i += BATCH) {
    const batch = categories.slice(i, i + BATCH).map(c => {
      const id = isUuid(c.id) ? c.id : randomUUID();
      slugToUuid.set(c.slug, id);
      return {
        id,
        name: c.name,
        slug: c.slug,
        sort_order: c.sort_order,
        is_active: c.is_active !== false,
      };
    });
    const { error } = await supabase.from('menu_categories').upsert(batch, { onConflict: 'id' });
    if (error) console.warn(`❌ Categories batch ${i} error: ${error.message}`);
    else catInserted += batch.length;
    process.stdout.write(`\r✔ Categories: ${catInserted}/${categories.length}`);
  }
  console.log();

  // ---- Items ----------------------------------------------------------
  let itemInserted = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(it => {
      const id = isUuid(it.id) ? it.id : randomUUID();
      // Resolve category_id: original value is a slug (e.g., "cat-chicken-soups")
      const catUuid = slugToUuid.get(it.category_id) || randomUUID();
      return {
        id,
        category_id: catUuid,
        name: it.name,
        price: it.price,
        image_url: it.image_url || null,
        image_filename: it.image_filename || null,
        sort_order: it.sort_order || 0,
        is_available: it.is_available !== false,
      };
    });
    const { error } = await supabase.from('menu_items').upsert(batch, { onConflict: 'id' });
    if (error) console.warn(`❌ Items batch ${i} error: ${error.message}`);
    else itemInserted += batch.length;
    process.stdout.write(`\r✔ Items: ${itemInserted}/${items.length}`);
  }
  console.log();

  // ---- Verification ---------------------------------------------------
  const { count: catCount } = await supabase.from('menu_categories').select('*', { count: 'exact', head: true });
  const { count: itemCount } = await supabase.from('menu_items').select('*', { count: 'exact', head: true });
  console.log('\n✅ Verification:');
  console.log(`   Categories: ${catCount}`);
  console.log(`   Items: ${itemCount}`);

  if (catCount === categories.length && itemCount === items.length) {
    console.log('\n🎉 Seed complete! 🎉');
  } else {
    console.warn('\n⚠️ Some rows may be missing – check warnings');
  }
}

seed().finally(() => process.exit());

