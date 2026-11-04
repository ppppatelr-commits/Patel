const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\hp\\Desktop\\hindustan restaurant\\hindustan-restaurant';
const IMG_DIR = 'C:\\Users\\hp\\Desktop\\h img';
const MEDIA_DIR = path.join(ROOT, 'public', 'media', 'dishes');
const MENU_FILE = path.join(ROOT, 'src', 'lib', 'menu-data.ts');

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Load MENU_DATA
let raw = fs.readFileSync(MENU_FILE, 'utf8');
raw = raw.replace(/export const MENU_DATA/, 'const MENU_DATA');
raw = raw.replace(/ as const/g, '');
const fn = new Function(raw + '\n; return MENU_DATA;');
const MENU = fn();

// Get all dish names with categories
const dishes = [];
for (const [catName, catItems] of Object.entries(MENU.items)) {
  for (const item of catItems) {
    dishes.push({ name: item.name, category: catName, slug: slugify(item.name), filename: slugify(item.name) + '.webp' });
  }
}

// Scan h img folder
const imgFiles = fs.readdirSync(IMG_DIR).filter(function(f) { return f.match(/\.(webp|png|jpe?g)$/i); });
console.log('Total images in h img:', imgFiles.length);
console.log('Total dishes in menu:', dishes.length);
console.log('');

// Match and copy
let matched = 0, alreadyExists = 0, unmatchedImages = [], unmatchedDishes = [];

for (const img of imgFiles) {
  const imgLower = img.toLowerCase();
  const dish = dishes.find(function(d) { return d.filename.toLowerCase() === imgLower; });
  if (dish) {
    const catSlug = slugify(dish.category);
    const destDir = path.join(MEDIA_DIR, catSlug);
    const destPath = path.join(destDir, dish.filename);
    if (fs.existsSync(destPath)) {
      alreadyExists++;
      console.log('SKIP (already exists):', dish.filename, '->', dish.category);
    } else {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(path.join(IMG_DIR, img), destPath);
      matched++;
      console.log('COPIED:', dish.filename, '->', dish.category);
    }
  } else {
    unmatchedImages.push(img);
  }
}

// Find dishes without images
const imgSet = new Set(imgFiles.map(function(f) { return f.toLowerCase(); }));
for (const d of dishes) {
  if (!imgSet.has(d.filename.toLowerCase())) {
    unmatchedDishes.push(d);
  }
}

console.log('');
console.log('=== SUMMARY ===');
console.log('Total images found:', imgFiles.length);
console.log('Successfully matched and copied:', matched);
console.log('Already existed (skipped):', alreadyExists);
console.log('Unmatched images (no matching dish):', unmatchedImages.length);
console.log('Dishes without images:', unmatchedDishes.length);
console.log('');
console.log('=== UNMATCHED IMAGES (no matching dish in menu) ===');
unmatchedImages.forEach(function(f) { console.log('  ' + f); });
console.log('');
console.log('=== DISHES WITHOUT IMAGES ===');
unmatchedDishes.forEach(function(d) { console.log('  ' + d.filename + '  |  ' + d.name + '  |  ' + d.category); });