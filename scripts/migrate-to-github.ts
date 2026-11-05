/**
 * Migration script: Export existing Patel Restaurant menu data to GitHub
 * content repository JSON format.
 *
 * Run with: npx tsx scripts/migrate-to-github.ts
 *
 * This reads from src/lib/menu-data.ts (the existing Patel menu seed)
 * and outputs JSON files ready for the GitHub content repository.
 */

import fs from 'fs';
import path from 'path';

// Read MENU_DATA directly from the source file using relative path
const menuDataPath = path.join(process.cwd(), 'src', 'lib', 'menu-data.ts');
const menuDataSource = fs.readFileSync(menuDataPath, 'utf-8');

// Extract the MENU_DATA object using a simple eval approach
// The file exports MENU_DATA as const - we need to extract the data
// Since we can't import .ts directly, let's parse it

const CONTENT_REPO_DIR = path.join(process.cwd(), 'content-repo-template');

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Written: ${filePath}`);
}

// Parse MENU_DATA from the TypeScript source
// The file has: export const MENU_DATA = { ... } as const;
// We need to extract the object literal
function extractMenuData(source: string): any {
  // Find the MENU_DATA = { ... } part
  const startMatch = source.match(/export\s+const\s+MENU_DATA\s*=\s*\{/);
  if (!startMatch) throw new Error('Could not find MENU_DATA in source');

  // Find the matching closing brace by counting
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let startIndex = startMatch.index! + startMatch[0].length - 1; // position of opening {

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === stringChar && source[i - 1] !== '\\') inString = false;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
      } else if (ch === '{') braceCount++;
      else if (ch === '}') {
        braceCount--;
        if (braceCount === 0) {
          // Found the closing brace of MENU_DATA
          const objStr = source.substring(startIndex, i + 1);
          // Use Function to safely evaluate the object
          try {
            const fn = new Function('return ' + objStr);
            return fn();
          } catch (err) {
            throw new Error(`Failed to parse MENU_DATA: ${err}`);
          }
        }
      }
    }
  }

  throw new Error('Could not find closing brace of MENU_DATA');
}

async function main(): Promise<void> {
  console.log('=== Patel Restaurant GitHub Migration ===\n');

  const MENU_DATA = extractMenuData(menuDataSource);

  // ── 1. Categories ──
  const categories = MENU_DATA.categories.map((cat: any, index: number) => ({
    id: `cat-${slugify(cat.name)}`,
    name: cat.name,
    slug: slugify(cat.name),
    description: null,
    image: null,
    sortOrder: cat.sort_order ?? index + 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  writeJson(
    path.join(CONTENT_REPO_DIR, 'data/categories.json'),
    { categories }
  );
  console.log(`Categories: ${categories.length}\n`);

  // ── 2. Menu Items ──
  const categoryMap = new Map(categories.map((c: { name: string; id: string }) => [c.name, c.id]));
  const items: Array<any> = [];

  const itemsRecord = MENU_DATA.items;

  for (const [catName, catItems] of Object.entries(itemsRecord)) {
    const categoryId = categoryMap.get(catName);
    if (!categoryId) {
      console.warn(`Skipping category: ${catName} (no category ID)`);
      continue;
    }

    let sortIndex = 0;
    for (const item of catItems as Array<any>) {
      const itemSlug = slugify(item.name);
      items.push({
        id: `item-${slugify(catName)}--${itemSlug}${sortIndex > 0 ? `--${sortIndex + 1}` : ''}`,
        categoryId,
        name: item.name,
        description: item.description || null,
        price: item.price,
        image: `media/dishes/${slugify(catName)}/${itemSlug}.webp`,
        isAvailable: true,
        sortOrder: sortIndex++,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  writeJson(
    path.join(CONTENT_REPO_DIR, 'data/menu.json'),
    { items }
  );
  console.log(`Menu items: ${items.length}\n`);

  // ── 3. Restaurant Settings ──
  const restaurantData = {
    restaurant: {
      name: MENU_DATA.restaurant.name || 'Patel Restaurant',
      logo: '/logo.png',
      address: MENU_DATA.restaurant.address || '',
      phone: MENU_DATA.restaurant.phone1 || '',
      whatsapp: MENU_DATA.restaurant.phone2 || '',
      openingHours: null,
      contactEmail: null,
      socialLinks: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  writeJson(
    path.join(CONTENT_REPO_DIR, 'data/restaurant.json'),
    restaurantData
  );
  console.log(`Restaurant settings written\n`);

  // ── 4. App Settings ──
  const settingsData = {
    settings: {
      currency: 'INR',
      theme: 'dark',
      menuLayout: 'grid',
      orderingSettings: {},
      whatsappOrdering: true,
      imageSettings: {
        maxWidth: 1024,
        maxHeight: 1024,
        webpQuality: 80,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  writeJson(
    path.join(CONTENT_REPO_DIR, 'data/settings.json'),
    settingsData
  );
  console.log(`App settings written\n`);

  // ── 5. Image inventory ──
  const dishesDir = path.join(process.cwd(), 'public', 'media', 'dishes');
  const imageInventory: Array<any> = [];

  for (const item of items) {
    if (!item.image) continue;
    const imagePath = path.join(dishesDir, item.image);
    const exists = fs.existsSync(imagePath);
    imageInventory.push({
      category: item.image.split('/')[0] || 'general',
      filename: item.image.split('/').pop() || '',
      exists,
    });
  }

  const missingImages = imageInventory.filter((i) => !i.exists);
  console.log(`Image inventory: ${imageInventory.length} total`);
  console.log(`Missing images: ${missingImages.length}`);
  if (missingImages.length > 0) {
    console.log('Missing (first 20):');
    for (const m of missingImages.slice(0, 20)) {
      console.log(`  ${m.category}/${m.filename}`);
    }
    if (missingImages.length > 20) {
      console.log(`  ... and ${missingImages.length - 20} more`);
    }
  }

  writeJson(
    path.join(CONTENT_REPO_DIR, 'data/image-inventory.json'),
    imageInventory
  );

  console.log('\n=== Migration complete ===');
  console.log(`Content repository template: ${CONTENT_REPO_DIR}`);
  console.log('Next steps:');
  console.log('1. Copy images from public/media/dishes/ to content-repo-template/media/dishes/');
  console.log('2. Create GitHub private content repository');
  console.log('3. Push content-repo-template to GitHub');
  console.log('4. Configure Vercel environment variables');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});