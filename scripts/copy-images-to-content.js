/**
 * Copy existing dish images from public/media/dishes/ to content-repo-template/media/dishes/
 * Run with: node scripts/copy-images-to-content.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(PROJECT_ROOT, 'public', 'media', 'dishes');
const DEST_DIR = path.join(PROJECT_ROOT, 'content-repo-template', 'media', 'dishes');

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let fileCount = 0;
  let dirCount = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      dirCount++;
      const subResult = copyDirRecursive(srcPath, destPath);
      fileCount += subResult.fileCount;
      dirCount += subResult.dirCount;
    } else {
      // Only copy image files
      if (/\.(webp|png|jpe?g|gif)$/i.test(entry.name)) {
        fs.copyFileSync(srcPath, destPath);
        fileCount++;
      }
    }
  }

  return { fileCount, dirCount };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Source directory not found: ${SOURCE_DIR}`);
  process.exit(1);
}

ensureDir(DEST_DIR);

const result = copyDirRecursive(SOURCE_DIR, DEST_DIR);
console.log(`Images copied: ${result.fileCount} files, ${result.dirCount} directories`);
console.log(`Destination: ${DEST_DIR}`);