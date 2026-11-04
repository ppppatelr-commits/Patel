const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const raw = fs.readFileSync('src/lib/menu-data.ts','utf8').replace('export const MENU_DATA','const MENU_DATA').replace(/ as const/g,'');
const MENU = new Function(raw + '\n;return MENU_DATA;')();
function slugify(t){return t.toString().toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'');}
const cats = MENU.categories;
const entries = Object.entries(MENU.items);
let total=0, missing=[], present=0, catMismatch=[];
const catNames = new Set(cats.map(c=>c.name));
for (const [cat, items] of entries){
  if(!catNames.has(cat)) catMismatch.push(cat);
  for(const it of items){
    total++;
    const f = path.join(ROOT,'public','media','dishes',slugify(cat),slugify(it.name)+'.webp');
    if(fs.existsSync(f)) present++; else missing.push(`${slugify(cat)}/${slugify(it.name)}.webp  | ${it.name} | ${cat}`);
  }
}
console.log('Categories:', cats.length);
console.log('Items in items map:', total);
console.log('Item keys not in categories list:', catMismatch.length ? catMismatch.join(', ') : 'none');
console.log('Images present:', present);
console.log('Images missing:', missing.length);
if(missing.length) console.log(missing.slice(0,50).join('\n'));
