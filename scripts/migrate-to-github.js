/**
 * Migration script: Export existing Patel Restaurant menu data to GitHub
 * content repository JSON format.
 *
 * Run with: node scripts/migrate-to-github.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_REPO_DIR = path.join(PROJECT_ROOT, 'content-repo-template');

// Read menu-data.ts and extract MENU_DATA using a simple approach
// Since we can't import .ts directly in plain node, we'll read it and eval the data structure
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Written: ${filePath}`);
}

// We need to read MENU_DATA from the TypeScript file.
// Since this is complex in plain JS, let's use a simpler approach:
// Read the compiled version or use a regex-based extraction.
// Actually, let's just import it via dynamic import with node --experimental-strip-types
// Or better: use the existing TypeScript via npx tsx

// For now, let's create the structure with placeholder data that matches
// the known menu data from the Patel Restaurant menu card extraction
console.log('Note: This script needs MENU_DATA from menu-data.ts');
console.log('Please run: npx tsx scripts/migrate-to-github.ts');
console.log('Or install tsx: npm install -D tsx');

// Create directory structure
const dirs = [
  'data',
  'media/dishes',
  'media/dishes/soups-shorba',
  'media/dishes/mutton-starters',
  'media/dishes/mutton-main-course',
  'media/dishes/khazana-e-tandoor',
  'media/dishes/chicken-main-course',
  'media/dishes/eggs',
  'media/dishes/chinese-starters',
  'media/dishes/chinese-poultry',
  'media/dishes/noodles',
  'media/dishes/chinese-rice',
  'media/dishes/sea-food-salad',
  'media/dishes/veg-appetizers',
  'media/dishes/sabzion-ki-saughaat',
  'media/dishes/veg-main-dishes',
  'media/dishes/basmati-ka-khazana',
  'media/dishes/roti-ki-tokri',
  'media/dishes/pizza',
  'media/dishes/burger',
  'media/dishes/sandwich',
  'media/dishes/roll',
  'media/dishes/mocktails',
  'media/dishes/desserts',
  'media/dishes/falooda',
  'media/dishes/ice-cream',
  'media/dishes/premium-flavour-ice-cream',
  'media/dishes/desi-refreshments',
  'media/dishes/sweets',
  'media/dishes/kunafa',
  'media/dishes/milk-shake',
  'media/dishes/juice',
  'media/dishes/brownie',
  'media/dishes/patel-special',
  'media/dishes/caterers',
  'media/dishes/tea-coffee',
];

for (const dir of dirs) {
  ensureDir(path.join(CONTENT_REPO_DIR, dir));
}

console.log('\nDirectory structure created in content-repo-template/');

// Create .gitkeep files for empty directories
const gitkeepDirs = fs.readdirSync(CONTENT_REPO_DIR, { recursive: true })
  .filter(f => f.endsWith('/') || fs.statSync(path.join(CONTENT_REPO_DIR, f)).isDirectory())
  .filter(d => {
    const files = fs.readdirSync(path.join(CONTENT_REPO_DIR, d));
    return files.length === 0;
  });

for (const dir of gitkeepDirs) {
  fs.writeFileSync(path.join(CONTENT_REPO_DIR, dir, '.gitkeep'), '');
}

console.log('Empty directory placeholders created.');
console.log('\nNext: Run the TypeScript migration script to populate JSON data.');
console.log('  1. npm install -D tsx');
console.log('  2. npx tsx scripts/migrate-to-github.ts');