import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const INDEX_FILE = join('_data', 'wallpapers.json');
const THUMB_WIDTH = 400;
const VIDEO_EXTS = new Set(['mp4', 'webm']);

async function fileExists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function cleanStaleThumbs(items) {
  const validThumbs = new Set(items.map(i => i.thumb));
  const thumbDir = 'src/thumbs';
  if (!await fileExists(thumbDir)) return;

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!validThumbs.has(full)) {
        console.log(`Removing stale thumbnail: ${full}`);
        await rm(full);
      }
    }
  }
  await walk(thumbDir);
}

async function generateThumb(item) {
  const thumbPath = item.thumb;
  const srcPath = item.src;

  if (VIDEO_EXTS.has(item.ext)) {
    console.log(`Skipping video thumbnail (ffmpeg extraction not implemented): ${srcPath}`);
    return;
  }

  try {
    const srcStat = await stat(srcPath);
    if (await fileExists(thumbPath)) {
      const thumbStat = await stat(thumbPath);
      if (thumbStat.mtimeMs >= srcStat.mtimeMs) return;
    }
  } catch { /* generate anyway */ }

  await mkdir(dirname(thumbPath), { recursive: true });

  try {
    await sharp(srcPath)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    console.log(`Generated: ${thumbPath}`);
  } catch (err) {
    console.warn(`Warning: failed to generate thumbnail for ${srcPath}: ${err.message}`);
  }
}

const raw = await readFile(INDEX_FILE, 'utf8');
const index = JSON.parse(raw);

await cleanStaleThumbs(index.items);

let count = 0;
for (const item of index.items) {
  await generateThumb(item);
  count++;
}

console.log(`Processed ${count} items`);
