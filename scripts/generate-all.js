const http = require('http');

const BASE = 'http://localhost:3000';

function fetchJson(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function headOk(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const req = http.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

(async () => {
  const catsRes = await fetchJson('/api/categories');
  const cats = catsRes.body;
  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const itemsRes = await fetchJson('/api/items');
  const items = itemsRes.body;

  console.log('Total items:', items.length);

  let done = 0, skipped = 0, failed = 0, generated = 0;
  for (const item of items) {
    const catName = catMap.get(item.category_id) || '';
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const imgUrl = `/media/dishes/${catSlug}/${slug}.webp`;

    const exists = await headOk(imgUrl);
    if (exists) {
      skipped++;
      done++;
      console.log(`[${done}/${items.length}] SKIP (exists): ${item.name}`);
      continue;
    }

    try {
      const res = await fetchJson('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish: item.name, category: catName }),
      });
      if (res.status === 200 && res.body && res.body.success) {
        generated++;
        console.log(`[${done + 1}/${items.length}] OK: ${item.name}`);
      } else {
        failed++;
        console.log(`[${done + 1}/${items.length}] FAIL: ${item.name} -> ${JSON.stringify(res.body).slice(0, 200)}`);
      }
    } catch (e) {
      failed++;
      console.log(`[${done + 1}/${items.length}] ERR: ${item.name} -> ${e.message}`);
    }
    done++;
    // small delay to be polite to the free service
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('=== DONE ===');
  console.log('Total:', items.length, 'Generated:', generated, 'Skipped:', skipped, 'Failed:', failed);
})();
