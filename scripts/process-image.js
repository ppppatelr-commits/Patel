const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function processImage(srcPath, destCategoryFolder, destFilename) {
  const root = path.resolve(__dirname, '..');
  const destDir = path.join(root, 'public', 'media', 'dishes', destCategoryFolder);
  const destPath = path.join(destDir, destFilename);

  fs.mkdirSync(destDir, { recursive: true });

  const meta = await sharp(srcPath).metadata();
  console.log(`Input: ${srcPath} (${meta.width}x${meta.height}, ${meta.format})`);

  await sharp(srcPath)
    .resize(1024, 1024, { fit: 'cover' })
    .webp({ quality: 90 })
    .toFile(destPath);

  const outMeta = await sharp(destPath).metadata();
  const bytes = fs.statSync(destPath).size;
  console.log(`Saved: ${destPath} (${outMeta.width}x${outMeta.height}, ${bytes} bytes)`);
  return destPath;
}

const [,, src, folder, filename] = process.argv;
if (src && folder && filename) {
  processImage(src, folder, filename).catch(err => {
    console.error('Error processing image:', err);
    process.exit(1);
  });
}

module.exports = { processImage };

