const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = 'C:\\Users\\hp\\Desktop\\hindustan restaurant\\hindustan-restaurant';
const OUT_DIR = path.join(ROOT, 'public', 'media', 'dishes');
const MENU_FILE = path.join(ROOT, 'src', 'lib', 'menu-data.ts');

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DISH_DETAILS = {
  butterchicken: 'tandoori-style chicken pieces in creamy orange-red butter gravy with natural butter highlights and authentic Indian restaurant presentation.',
  chickenbiryani: 'long-grain basmati rice with authentic cooked chicken pieces, fried onions and saffron, realistic biryani texture.',
  crispychicken: 'golden-brown fried chicken with visible crunchy coating and realistic crispy texture.',
  paneertikka: 'grilled paneer cubes with authentic spices and char marks, natural grilled texture.',
  chickenmanchowsoup: 'authentic dark manchow soup with chicken and vegetables and crispy fried noodles.',
  muttonpaya: 'authentic traditional mutton paya broth with visible mutton trotters and realistic soup texture.',
  chickencurry: 'authentic Indian restaurant chicken curry with rich gravy, visible spices and tender chicken pieces.',
  muttcurry: 'authentic Indian restaurant mutton curry with rich gravy, visible spices and tender mutton pieces.',
  vegcurry: 'authentic Indian restaurant vegetable curry with fresh vegetables and rich spiced gravy.',
  paneercurry: 'authentic Indian restaurant paneer curry with rich gravy and fresh paneer.',
  fishcurry: 'authentic Indian restaurant fish curry with rich gravy and fresh fish pieces.',
};

function buildPrompt(dish) {
  const base = `ultra-realistic premium restaurant menu food photo of ${dish}. dark charcoal black matte stone surface. soft warm studio lighting. 45 degree angle. matte black ceramic plate. centered. realistic texture. ultra-sharp. square 1:1. no text/logos/watermarks/hands/cutlery.`;
  const key = dish.toLowerCase().replace(/[^a-z0-9]/g, '');
  const details = DISH_DETAILS[key];
  const desc = details ? `${dish}: ${details}` : `${dish}: authentic Indian restaurant dish, realistic ingredients, professional plating, premium presentation.`;
  return `${base} ${desc}`;
}

let raw = fs.readFileSync(MENU_FILE, 'utf8');
raw = raw.replace(/export const MENU_DATA/, 'const MENU_DATA');
raw = raw.replace(/ as const/g, '');
const fn = new Function(raw + '\n; return MENU_DATA;');
const MENU_DATA = fn();

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithRetry(url, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetchBuffer(url);
      if (r.status === 200 && r.buffer && r.buffer.length >= 1000) return r;
      if (r.status === 402 || r.status === 429) {
        const wait = 60000 * (attempt + 1);
        console.log(`   rate-limited (${r.status}), waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      // other non-200: short retry
      if (attempt < maxRetries) {
        await sleep(10000);
        continue;
      }
      return r;
    } catch (e) {
      if (attempt < maxRetries) {
        console.log(`   fetch error: ${e.message}, retrying in 10s...`);
        await sleep(10000);
        continue;
      }
      throw e;
    }
  }
  return null;
}

(async () => {
  const itemsRecord = MENU_DATA.items;
  const allDishes = [];
  for (const [catName, catItems] of Object.entries(itemsRecord)) {
    for (const item of catItems) {
      allDishes.push({ dish: item.name, category: catName });
    }
  }

  console.log('Total items:', allDishes.length);

  let generated = 0, skipped = 0, failed = 0;
  for (let i = 0; i < allDishes.length; i++) {
    const { dish, category } = allDishes[i];
    const catSlug = slugify(category);
    const dishSlug = slugify(dish);
    const dir = path.join(OUT_DIR, catSlug);
    const filePath = path.join(dir, dishSlug + '.webp');

    if (fs.existsSync(filePath)) {
      skipped++;
      console.log(`[${i + 1}/${allDishes.length}] SKIP (exists): ${dish}`);
      continue;
    }

    const prompt = buildPrompt(dish);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux`;

    const r = await fetchWithRetry(pollinationsUrl);
    if (!r || r.status !== 200 || !r.buffer || r.buffer.length < 1000) {
      failed++;
      console.log(`[${i + 1}/${allDishes.length}] FAIL: ${dish} -> HTTP ${r ? r.status : 'null'} bytes=${r && r.buffer ? r.buffer.length : 0}`);
      continue;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, r.buffer);
    generated++;
    console.log(`[${i + 1}/${allDishes.length}] OK: ${dish} (${r.buffer.length} bytes)`);

    // polite delay between requests
    await sleep(3000);
  }

  console.log('=== DONE ===');
  console.log('Total:', allDishes.length, 'Generated:', generated, 'Skipped:', skipped, 'Failed:', failed);
})();
