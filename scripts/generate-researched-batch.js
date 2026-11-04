const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MEDIA_DIR = path.join(ROOT, 'public', 'media', 'dishes');
const MISSING_FILE = path.join(ROOT, 'scripts', 'missing-images.txt');

// Researched exact visual descriptions for the 5 dishes
const RESEARCHED_PROMPTS = [
  {
    filename: 'mtn-rogan-gosht.webp',
    dish: 'MTN ROGAN GOSHT',
    category: 'MUTTON',
    folder: 'mutton',
    prompt: 'Professional Michelin-star food photography of authentic Kashmiri Mutton Rogan Josh. Large succulent fork-tender bone-in mutton cuts (shank and ribs) clearly visible and arranged in the center of a deep matte black ceramic bowl. The gravy is an intense vibrant ruby-red glossy color with a shimmering layer of fragrant red-orange rogan oil pooled on the surface, flavored with Kashmiri chilies, fennel and dry ginger. Delicate fresh ginger juliennes and a touch of fresh coriander on top. Set on a dark charcoal slate stone tabletop, 45-degree camera angle, warm studio directional lighting catching the rich red rogan sheen, square 1:1, photorealistic 8k, no text, no cutlery'
  },
  {
    filename: 'mtn-lajawab.webp',
    dish: 'MTN LAJAWAB',
    category: 'MUTTON',
    folder: 'mutton',
    prompt: 'Professional restaurant food photography of authentic Mutton Lajawab curry. Plump, tender bone-in mutton pieces prominently visible in the center, coated in a thick, velvety smooth dark mahogany reddish-brown gravy enriched with cashew paste and caramelized onions. Finished with an elegant artistic swirl of fresh white heavy cream in the center, delicate ginger juliennes, and fresh green coriander. Served in a deep round matte black ceramic bowl on a dark charcoal slate tabletop, 45-degree angle, soft warm directional lighting, square 1:1, photorealistic 8k, no text, no cutlery'
  },
  {
    filename: 'mtn-angara.webp',
    dish: 'MTN ANGARA',
    category: 'MUTTON',
    folder: 'mutton',
    prompt: 'Professional gourmet food photography of authentic Mutton Angara. Tender chunks of bone-in mutton with visible smoky charcoal-charred marks, thickly coated in a fiery, deep lustrous dark crimson-red bhuna masala gravy with a glossy red oil sheen. A subtle delicate wisp of aromatic wood smoke rises from the center representing the authentic dhungar live coal method. Garnished with fresh ginger matchsticks, slit green chilies, and fresh cilantro. Served in a heavy rustic matte black ceramic bowl on dark charcoal slate stone, 45-degree angle view, moody warm lighting, square 1:1, photorealistic 8k, no text, no cutlery'
  },
  {
    filename: 'mtn-hyderabadi.webp',
    dish: 'MTN HYDERABADI',
    category: 'MUTTON',
    folder: 'mutton',
    prompt: 'Professional restaurant food photography of authentic royal Hyderabadi Mutton Curry (Mutton Ka Salan). Large tender bone-in mutton pieces prominently visible in a rich, thick, velvety reddish-brown gravy made from roasted coconut, poppy seeds and caramelized onions. Garnished distinctively with crispy golden-brown fried onions (birista), fresh bright green mint leaves (pudina), and slit fresh green chillies on top. Served centered in a deep matte black artisan bowl on a dark charcoal slate tabletop, 45-degree angle, warm directional lighting, square 1:1, photorealistic 8k, no text, no cutlery'
  },
  {
    filename: 'mtn-lazeez.webp',
    dish: 'MTN LAZEEZ',
    category: 'MUTTON',
    folder: 'mutton',
    prompt: 'Professional fine-dining food photography of royal Mughlai Mutton Lazeez. Melt-in-the-mouth tender bone-in mutton chops and pieces prominently arranged in a smooth, thick, glossy reddish-brown gravy with natural golden ghee sheen. Enriched with cashew paste and yogurt, delicately garnished with a fine drizzle of heavy cream, fresh ginger juliennes, and a sprig of fresh coriander. Served in a deep round matte black ceramic bowl on a dark charcoal slate tabletop, 45-degree high-angle view, soft warm directional studio lighting, square 1:1, photorealistic 8k, no text, no cutlery'
  }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchImageBuffer(promptText) {
  const encoded = encodeURIComponent(promptText);
  let attempts = 0;
  
  while (attempts < 6) {
    attempts++;
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const url = `https://image.pollinations.ai/prompt/${encoded}?nologo=true&seed=${seed}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://pollinations.ai/'
        },
        signal: AbortSignal.timeout(60000)
      });

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 5000) return buf;
      }

      if (res.status === 402) {
        const text = await res.text();
        let waitSec = 48;
        const match = text.match(/Retry after (\d+)s/);
        if (match) {
          waitSec = parseInt(match[1], 10) + 3;
        }
        console.log(`   [Rate limit: free tier 45s window] Waiting ${waitSec}s before retry...`);
        await sleep(waitSec * 1000);
        continue;
      }

      console.log(`   HTTP ${res.status}, waiting 15s...`);
      await sleep(15000);
    } catch (e) {
      console.log(`   Network error (${e.message}), waiting 10s...`);
      await sleep(10000);
    }
  }
  throw new Error('All attempts failed to return a valid buffer');
}

async function runResearchedBatch() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('HINDUSTAN RESTAURANT — RESEARCH-FIRST 5-DISH VERIFICATION BATCH');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  const completed = [];

  for (let i = 0; i < RESEARCHED_PROMPTS.length; i++) {
    const item = RESEARCHED_PROMPTS[i];
    const destDir = path.join(MEDIA_DIR, item.folder);
    const destPath = path.join(destDir, item.filename);

    console.log(`[${i + 1}/${RESEARCHED_PROMPTS.length}] RESEARCHED DISH: ${item.dish} -> ${item.folder}/${item.filename}`);
    console.log(`   Prompt: ${item.prompt.slice(0, 110)}...`);

    const t0 = Date.now();
    try {
      const rawBuf = await fetchImageBuffer(item.prompt);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`   Generated in ${elapsed}s (${rawBuf.length} bytes)`);

      fs.mkdirSync(destDir, { recursive: true });

      const meta = await sharp(rawBuf).metadata();
      const cropH = Math.max(100, (meta.height || 768) - 45);

      await sharp(rawBuf)
        .extract({ left: 0, top: 0, width: meta.width || 768, height: cropH })
        .resize(1024, 1024, { fit: 'cover' })
        .webp({ quality: 92 })
        .toFile(destPath);

      const finalSize = fs.statSync(destPath).size;
      console.log(`   ✓ Saved 1024x1024 WebP (${finalSize} bytes) -> ${destPath}`);
      completed.push(item.filename);
    } catch (err) {
      console.error(`   ✗ Generation error: ${err.message}`);
    }

    console.log('');
    if (i < RESEARCHED_PROMPTS.length - 1) {
      console.log('   Waiting 48s for free rate limit window...');
      await sleep(48000);
    }
  }

  // Update missing-images.txt
  if (completed.length > 0 && fs.existsSync(MISSING_FILE)) {
    const lines = fs.readFileSync(MISSING_FILE, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const remaining = lines.filter(l => !completed.some(f => l.startsWith(f)));
    fs.writeFileSync(MISSING_FILE, remaining.join('\n'), 'utf8');
    console.log('══════════════════════════════════════════════════════════════════════');
    console.log(`Researched batch complete! Saved ${completed.length} dishes.`);
    console.log(`Remaining dishes in queue: ${remaining.length}`);
    console.log('══════════════════════════════════════════════════════════════════════');
  }
}

runResearchedBatch().catch(console.error);

