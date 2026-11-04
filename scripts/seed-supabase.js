#!/usr/bin/env node
/**
 * seed-supabase.js
 * Seeds Supabase with all 33 categories + 304 items from data/menu-store.json
 *
 * Usage:
 *   node scripts/seed-supabase.js
 *
 * Requires environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service role key — bypasses RLS)
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── load .env.local if not set ───────────────────────────────────────────
function loadDotenv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotenv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY ||
    SUPABASE_URL.includes('YOUR-PROJECT-REF') ||
    SERVICE_KEY.includes('YOUR-SERVICE-ROLE-KEY')) {
  console.error('\n❌  Missing Supabase credentials.\n');
  console.error('Set these in .env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ....\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── load local store ─────────────────────────────────────────────────────
const storePath = path.join(__dirname, '..', 'data', 'menu-store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const { categories, items, settings } = store;

console.log(`\n📦  Loaded ${categories.length} categories + ${items.length} items from local store\n`);

// ─── helpers ──────────────────────────────────────────────────────────────
async function upsertInBatches(table, rows, batchSize = 50) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`  ❌  Error upserting batch ${i}–${i + batchSize} into ${table}:`, error.message);
      throw error;
    }
    inserted += batch.length;
    process.stdout.write(`\r  ✔  ${table}: ${inserted}/${rows.length} rows`);
  }
  console.log(); // newline
}

// ─── seed restaurant_settings ────────────────────────────────────────────
async function seedSettings() {
  console.log('⚙️   Seeding restaurant_settings...');
  const { data: existing } = await supabase.from('restaurant_settings').select('id').limit(1);
  if (existing && existing.length > 0) {
    console.log('  ℹ️   Settings row already exists — skipping.');
    return;
  }
  const s = settings;
  const { error } = await supabase.from('restaurant_settings').insert({
    id: s.id || undefined,
    name: s.name || 'HINDUSTAN RESTAURANT',
    phone_1: s.phone_1 || '+91 8879396241',
    phone_2: s.phone_2 || '',
    address: s.address || '',
    logo_url: s.logo_url || '/logo.png',
    developer_name: s.developer_name || 'Salman Furniturewala',
    developer_phone: s.developer_phone || '+91 7303321019',
    developer_credit_locked: true,
  });
  if (error) console.error('  ❌  Settings error:', error.message);
  else console.log('  ✔  Settings inserted.');
}

// ─── seed categories ──────────────────────────────────────────────────────
async function seedCategories() {
  console.log('📂  Seeding menu_categories...');
  const rows = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sort_order: c.sort_order,
    image_url: c.image_url || null,
    is_active: c.is_active !== false,
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  }));
  await upsertInBatches('menu_categories', rows, 50);
}

// ─── seed items ───────────────────────────────────────────────────────────
async function seedItems() {
  console.log('🍽️   Seeding menu_items...');
  const rows = items.map((it) => ({
    id: it.id,
    category_id: it.category_id,
    name: it.name,
    price: it.price,
    image_url: it.image_url || null,
    image_filename: it.image_filename || null,
    sort_order: it.sort_order || 0,
    is_available: it.is_available !== false,
    created_at: it.created_at || new Date().toISOString(),
    updated_at: it.updated_at || new Date().toISOString(),
  }));
  await upsertInBatches('menu_items', rows, 50);
}

// ─── verify ───────────────────────────────────────────────────────────────
async function verify() {
  const { count: catCount } = await supabase
    .from('menu_categories')
    .select('*', { count: 'exact', head: true });
  const { count: itemCount } = await supabase
    .from('menu_items')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✅  Verification:`);
  console.log(`    Categories in Supabase : ${catCount}`);
  console.log(`    Items in Supabase      : ${itemCount}`);
  if (catCount !== categories.length)
    console.warn(`  ⚠️  Expected ${categories.length} categories`);
  if (itemCount !== items.length)
    console.warn(`  ⚠️  Expected ${items.length} items`);
}

// ─── main ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await seedSettings();
    await seedCategories();
    await seedItems();
    await verify();
    console.log('\n🎉  Seed complete! Add env vars to Vercel and redeploy.\n');
  } catch (err) {
    console.error('\n❌  Seed failed:', err.message);
    process.exit(1);
  }
})();

