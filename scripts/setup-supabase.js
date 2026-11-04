#!/usr/bin/env node
/**
 * setup-supabase.js
 * Creates all tables + seeds 33 categories + 304 items into the Supabase database.
 * Reads credentials from .env.local automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── load .env.local ─────────────────────────────────────────────────────
function loadDotenv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) { console.error('No .env.local found'); process.exit(1); }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotenv();

const POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ─── Use fetch to run SQL via Supabase's REST API (pg endpoint) ──────────
async function runSQL(sql) {
  // Use the Supabase REST SQL endpoint (requires service_role key)
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({})
  });
  // Supabase doesn't have a generic SQL endpoint via REST.
  // Use the management API or pg directly. Let's use pg approach via supabase-js.
}

// Use @supabase/supabase-js for data operations
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Step 1: Create tables via SQL (using Supabase SQL Editor API) ───────
// We'll use the postgres connection directly
// For now, try using supabase.rpc or direct pg

// First, let's try creating tables via the supabase management API
async function createTablesViaManagementAPI() {
  // Read all 3 migration files
  const migrations = [
    '0001_initial_schema.sql',
    '0002_user_roles.sql',
    '0003_image_history_and_backup.sql',
  ];

  for (const file of migrations) {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', file);
    if (!fs.existsSync(sqlPath)) {
      console.log(`  ⚠️  ${file} not found, skipping`);
      continue;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`  📄 Running ${file}...`);

    // Try using the Supabase SQL endpoint
    const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'x-connection-encrypted': 'true',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (resp.ok) {
      console.log(`  ✅ ${file} executed successfully`);
    } else {
      const text = await resp.text();
      // Try alternative endpoint
      const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sql }),
      });
      if (resp2.ok) {
        console.log(`  ✅ ${file} executed successfully (via rpc)`);
      } else {
        console.log(`  ⚠️  ${file}: HTTP ${resp.status} — May need manual SQL execution`);
        console.log(`     Response: ${text.substring(0, 200)}`);
      }
    }
  }
}

// ─── Step 2: Seed data using supabase-js ─────────────────────────────────
async function seedData() {
  const storePath = path.join(__dirname, '..', 'data', 'menu-store.json');
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const { categories, items, settings } = store;
  
  console.log(`\n📦 Loaded ${categories.length} categories + ${items.length} items\n`);

  // Check if tables exist by trying a simple query
  const { data: testData, error: testErr } = await supabase
    .from('menu_categories')
    .select('id')
    .limit(1);

  if (testErr) {
    console.log(`\n❌ Table 'menu_categories' not accessible: ${testErr.message}`);
    console.log('   Tables may need to be created first. See below.\n');
    return false;
  }

  // Seed settings
  console.log('⚙️  Seeding restaurant_settings...');
  const { data: existSettings } = await supabase.from('restaurant_settings').select('id').limit(1);
  if (!existSettings || existSettings.length === 0) {
    const { error: settErr } = await supabase.from('restaurant_settings').insert({
      name: settings.name || 'HINDUSTAN RESTAURANT',
      phone_1: settings.phone_1 || '+91 8879396241',
      phone_2: settings.phone_2 || '',
      address: settings.address || '',
      logo_url: settings.logo_url || '/logo.png',
      developer_name: settings.developer_name || 'Salman Furniturewala',
      developer_phone: settings.developer_phone || '+91 7303321019',
      developer_credit_locked: true,
    });
    if (settErr) console.log('  ⚠️  Settings:', settErr.message);
    else console.log('  ✅ Settings inserted');
  } else {
    console.log('  ℹ️  Settings already exist');
  }

  // Seed categories
  console.log('📂 Seeding menu_categories...');
  let catInserted = 0;
  const BATCH = 50;
  for (let i = 0; i < categories.length; i += BATCH) {
    const batch = categories.slice(i, i + BATCH).map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sort_order: c.sort_order,
      is_active: c.is_active !== false,
    }));
    const { error } = await supabase.from('menu_categories').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.log(`  ❌ Categories batch ${i}: ${error.message}`);
      // Try inserting one by one to find problematic rows
      for (const cat of batch) {
        const { error: singleErr } = await supabase.from('menu_categories').upsert(cat, { onConflict: 'id' });
        if (singleErr) {
          console.log(`    ❌ ${cat.name}: ${singleErr.message}`);
        } else {
          catInserted++;
        }
      }
    } else {
      catInserted += batch.length;
    }
    process.stdout.write(`\r  ✔ Categories: ${catInserted}/${categories.length}`);
  }
  console.log();

  // Seed items
  console.log('🍽️  Seeding menu_items...');
  let itemInserted = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(it => ({
      id: it.id,
      category_id: it.category_id,
      name: it.name,
      price: it.price,
      image_url: it.image_url || null,
      image_filename: it.image_filename || null,
      sort_order: it.sort_order || 0,
      is_available: it.is_available !== false,
    }));
    const { error } = await supabase.from('menu_items').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.log(`  ❌ Items batch ${i}: ${error.message}`);
    } else {
      itemInserted += batch.length;
    }
    process.stdout.write(`\r  ✔ Items: ${itemInserted}/${items.length}`);
  }
  console.log();

  // Verify
  const { count: catCount } = await supabase.from('menu_categories').select('*', { count: 'exact', head: true });
  const { count: itemCount } = await supabase.from('menu_items').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Verification:`);
  console.log(`   Categories: ${catCount}`);
  console.log(`   Items: ${itemCount}`);
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🚀 Setting up Supabase for Hindustan Restaurant\n');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log('');

  // Step 1: Try creating tables
  console.log('📋 Step 1: Creating database tables...');
  await createTablesViaManagementAPI();

  // Step 2: Seed data
  console.log('\n📋 Step 2: Seeding data...');
  const ok = await seedData();

  if (ok) {
    console.log('\n🎉 Setup complete! Redeploy to Vercel now.\n');
  } else {
    console.log('\n⚠️  Tables need to be created manually. See instructions above.\n');
  }
})();

