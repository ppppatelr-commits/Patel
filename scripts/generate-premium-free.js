const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MEDIA_DIR = path.join(ROOT, 'public', 'media', 'dishes');
const MISSING_FILE = path.join(ROOT, 'scripts', 'missing-images.txt');

// Highly detailed culinary knowledge for authentic dishes
const CULINARY_PROFILES = {
  // Mutton
  'mtn-white.webp': 'royal Mughlai white mutton curry, large succulent bone-in tender mutton pieces prominently visible and centered, coated in an elegant silky ivory cashew-nut and poppy seed gravy scented with green cardamom, garnished with slivered almonds and fresh coriander',
  'mtn-do-pyaza.webp': 'authentic Mutton Do Pyaza, tender bone-in mutton cuts prominently visible, surrounded by abundant golden caramelized pearl onions, sautéed onion petals and rich roasted brown masala gravy',
  'mtn-special-gravy.webp': 'Hindustan Special Mutton Gravy, chef signature slow-cooked bone-in mutton pieces prominently arranged in the bowl, glistening in dark aromatic roasted onion-garlic gravy with ginger juliennes and fresh coriander',
  'mtn-paya.webp': 'traditional authentic Mutton Paya broth, tender slow-simmered bone-in mutton trotters with visible bone marrow cuts clearly resting in a rich golden spiced bone broth garnished with chopped green chillies and fresh cilantro',
  'mtn-bhuna.webp': 'Mutton Bhuna Gosht, succulent mutton pieces slow-cooked until a dark brown clinging bhuna masala thickly coats every piece, with caramelized onions, cracked black pepper and green coriander',
  'mtn-dal-gosht.webp': 'traditional Mughlai Dal Gosht, tender cooked mutton pieces resting in golden-yellow chana dal lentil curry with tender bottle gourd (doodhi) chunks and aromatic desi ghee tempering',
  'mtn-kadai.webp': 'Mutton Kadai, tender mutton chunks wok-tossed with chunky green bell peppers, onion petals, ginger juliennes and coarsely crushed roasted coriander seeds in thick tomato gravy',
  'mtn-rogan-gosht.webp': 'authentic Kashmiri Mutton Rogan Josh, tender mutton pieces swimming in vibrant crimson-red aromatic gravy flavored with Kashmiri chillies, fennel seeds and dry ginger, garnished with coriander',
  'mtn-lajawab.webp': 'Mutton Lajawab, succulent mutton chunks in a rich spicy onion-tomato gravy with fried onion curls and a swirl of fresh cream',
  'mtn-angara.webp': 'Mutton Angara, smoky fiery crimson mutton curry with prominent tender mutton pieces infused with live charcoal aroma and roasted red chillies',
  'mtn-hyderabadi.webp': 'Hyderabadi Mutton Curry, rich dark spiced mutton pieces in a flavorful gravy of mint, coriander, fried onions and aromatic Southern spices',
  'mtn-lazeez.webp': 'Mutton Lazeez, tender mutton cuts in a decadent mild cashew-cream and saffron gravy with fresh coriander',
  'mtn-dabba-gosht.webp': 'traditional Bohri Mutton Dabba Gosht, tender boneless mutton baked in rich white cashew-cream sauce topped with a golden baked egg layer and tomato slices',
  'mtn-palak.webp': 'Mutton Palak, succulent bone-in mutton pieces simmered in silky vibrant deep-green spinach puree tempered with roasted garlic and cumin seeds',
  'mutton-butter-fry.webp': 'Mutton Butter Fry, tender pan-fried mutton pieces tossed in rich golden melting butter glaze with coarse black pepper and garlic',
  'mutton-kabuli.webp': 'Mutton Kabuli, Afghan-style mutton curry with tender mutton pieces and plump chickpeas in a flavorful tomato-onion spiced gravy',
  'mutton-rashida.webp': 'Mutton Rashida, royal Mughlai rich amber mutton curry with large bone-in mutton pieces in almond-cashew paste and saffron gravy',
  'mutton-plain-fry.webp': 'Mutton Plain Fry, pan-seared tender mutton pieces seasoned lightly with turmeric, cracked black pepper, curry leaves and sea salt'
};

function getDishDescription(filename, dishName, category) {
  if (CULINARY_PROFILES[filename]) {
    return CULINARY_PROFILES[filename];
  }
  
  const lowerDish = dishName.toLowerCase();
  const lowerCat = category.toLowerCase();
  
  if (lowerDish.includes('biryani') || lowerCat.includes('biryani')) {
    return `authentic royal dum biryani with long-grain saffron basmati rice, clearly visible tender spiced meat pieces, caramelized fried onions (birista) and fresh mint leaves`;
  }
  if (lowerDish.includes('pulao') || lowerDish.includes('pulav')) {
    return `fragrant Indian basmati rice pilaf cooked with whole garam masala, sweet green peas, diced carrots and fresh herbs`;
  }
  if (lowerDish.includes('fried rice') || lowerCat.includes('rice')) {
    return `wok-tossed Indo-Chinese fried rice with distinct fluffy rice grains, finely chopped carrots, French beans, and scallions`;
  }
  if (lowerDish.includes('noodles') || lowerCat.includes('noodles')) {
    return `wok-tossed Indo-Chinese hakka noodles with shredded cabbage, bell pepper juliennes, spring onions and savory dark glaze`;
  }
  if (lowerDish.includes('paneer')) {
    return `fresh soft cottage cheese paneer cubes with golden seared edges cooked in authentic aromatic Indian gravy with fresh coriander`;
  }
  if (lowerDish.includes('mutton') || lowerDish.includes('mtn')) {
    return `tender bone-in mutton pieces prominently visible and centered, simmered in rich authentic Indian spiced gravy with fresh herbs`;
  }
  if (lowerDish.includes('chicken') || lowerDish.includes('chi')) {
    return `tender bone-in chicken cuts prominently visible in the bowl, richly coated in flavorful Indian spiced gravy with fresh coriander`;
  }
  if (lowerDish.includes('fish')) {
    return `fresh flaky fish fillets simmered in authentic spiced coastal curry with curry leaves and mustard seeds`;
  }
  if (lowerDish.includes('prawns')) {
    return `plump juicy coastal prawns cooked in rich aromatic spiced masala gravy with fresh coriander`;
  }
  if (lowerDish.includes('roti') || lowerDish.includes('naan')) {
    return `clay-oven tandoori baked Indian flatbread with authentic golden charred blistered spots and light butter glaze`;
  }
  
  return `authentic Indian restaurant ${dishName} with fresh ingredients, balanced spices and professional presentation`;
}

function buildPrompt(filename, dishName, category) {
  const desc = getDishDescription(filename, dishName, category);
  const lowerCat = category.toLowerCase();
  const lowerDish = dishName.toLowerCase();
  
  const isLiquid = lowerCat.includes('soup') || lowerCat.includes('curry') || lowerCat.includes('currys') || lowerCat.includes('gravy') || lowerCat.includes('mutton') || lowerCat.includes('chicken') || lowerDish.includes('curry') || lowerDish.includes('gravy') || lowerDish.includes('soup');
  const vessel = isLiquid 
    ? 'deep matte black ceramic round bowl with smooth satin rim'
    : 'heavy round matte black ceramic artisan plate';

  return `Michelin-star professional food photography of ${desc}. The main ingredients and meat cuts are prominently visible and arranged appetizingly in the center of a ${vessel}. Placed on a dark charcoal black slate stone tabletop with fine mineral texture. 45-degree angle view, soft warm directional studio lighting from front-right creating realistic highlights and soft shadows, delicate gentle steam rising, scattered black peppercorns and fresh cilantro on the slate, centered symmetrical composition, square 1:1, photorealistic 8k, appetizing natural colors, no text, no watermarks, no logos, no cutlery, no spoons`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchImageBuffer(promptText) {
  const encoded = encodeURIComponent(promptText);
  let attempts = 0;
  
  while (attempts < 5) {
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

      // If server error 503 or other
      console.log(`   HTTP ${res.status}, waiting 15s...`);
      await sleep(15000);
    } catch (e) {
      console.log(`   Network error (${e.message}), waiting 10s...`);
      await sleep(10000);
    }
  }
  throw new Error('All attempts failed to return a valid buffer');
}

async function processBatch(count = 5) {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('HINDUSTAN RESTAURANT — ULTRA-REALISTIC PREMIUM DISH-SPECIFIC GENERATOR');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(MISSING_FILE)) {
    console.error('missing-images.txt not found');
    return;
  }

  const lines = fs.readFileSync(MISSING_FILE, 'utf8').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    console.log('All dishes have already been generated!');
    return;
  }

  const batch = lines.slice(0, count);
  console.log(`Dishes remaining in total: ${lines.length}`);
  console.log(`Processing next batch of ${batch.length} dishes...\n`);

  const completed = [];

  for (let i = 0; i < batch.length; i++) {
    const parts = batch[i].split('|').map(s => s.trim());
    if (parts.length < 4) continue;
    const [filename, dishName, category, folder] = parts;
    const destDir = path.join(MEDIA_DIR, folder);
    const destPath = path.join(destDir, filename);

    console.log(`[${i + 1}/${batch.length}] ${dishName} (${category}) -> ${folder}/${filename}`);

    if (fs.existsSync(destPath)) {
      console.log('   -> Already exists on disk, skipping.');
      completed.push(filename);
      continue;
    }

    const promptText = buildPrompt(filename, dishName, category);
    console.log(`   Prompt: ${promptText.slice(0, 95)}...`);

    const t0 = Date.now();
    try {
      const rawBuf = await fetchImageBuffer(promptText);
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
      console.log(`   Saved 1024x1024 WebP (${finalSize} bytes) -> ${destPath}`);
      completed.push(filename);
    } catch (err) {
      console.error(`   Failed: ${err.message}`);
    }

    console.log('');
    await sleep(48000); // 48s pause respects the 45s free window perfectly
  }

  // Update missing-images.txt
  if (completed.length > 0) {
    const remaining = lines.filter(l => !completed.some(f => l.startsWith(f)));
    fs.writeFileSync(MISSING_FILE, remaining.join('\n'), 'utf8');
    console.log('══════════════════════════════════════════════════════════════════════');
    console.log(`Batch complete! Successfully saved ${completed.length} dishes.`);
    console.log(`Remaining dishes in queue: ${remaining.length}`);
    console.log('══════════════════════════════════════════════════════════════════════');
  }
}

const n = parseInt(process.argv[2], 10) || 5;
processBatch(n).catch(console.error);

