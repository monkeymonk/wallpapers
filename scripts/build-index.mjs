import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const WALL_DIR = 'wallpapers';
const OUT_FILE = join('_data', 'wallpapers.json');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm']);
const ALL_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

function normalizeToken(value) {
  return value.trim().toLowerCase().replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function humanize(value) {
  return value.split(/[-_ ]+/).filter(Boolean).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function classifySize(width, height) {
  if (!width || !height) return 'desktop';
  if (height > width) return 'mobile';
  if (width > 2560) return 'wide';
  return 'desktop';
}

function parseScalar(value) {
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseInlineArray(value) {
  const t = value.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return [];
  return t.slice(1, -1).split(',').map(e => parseScalar(e)).map(e => e.trim()).filter(Boolean);
}

function parseMetaYaml(text) {
  const result = {};
  let currentKey = null;
  let currentField = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '    ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const topMatch = line.match(/^([^\s:#][^:]*)\s*:\s*$/);
    if (topMatch) { currentKey = topMatch[1].trim(); currentField = null; result[currentKey] = {}; continue; }
    if (!currentKey) continue;
    const fieldMatch = line.match(/^\s{2}([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (fieldMatch) {
      const [, field, rawValue] = fieldMatch;
      currentField = field;
      if (field === 'tags') {
        result[currentKey].tags = rawValue.trim() ? parseInlineArray(rawValue) : [];
      } else {
        result[currentKey][field] = parseScalar(rawValue);
      }
      continue;
    }
    const listMatch = line.match(/^\s{4}-\s*(.+)$/);
    if (listMatch && currentField === 'tags') {
      result[currentKey].tags ??= [];
      result[currentKey].tags.push(parseScalar(listMatch[1]));
    }
  }
  return result;
}

async function loadMeta(dir) {
  try {
    const content = await readFile(join(dir, '_meta.yaml'), 'utf8');
    return parseMetaYaml(content);
  } catch {
    return {};
  }
}

async function getImageDimensions(filePath) {
  try {
    const meta = await sharp(filePath).metadata();
    return { width: meta.width, height: meta.height };
  } catch (err) {
    console.warn(`Warning: could not read dimensions for ${filePath}: ${err.message}`);
    return { width: null, height: null };
  }
}

async function getVideoDimensions(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json', filePath,
    ]);
    const data = JSON.parse(stdout);
    const stream = data.streams?.[0];
    return { width: stream?.width || null, height: stream?.height || null };
  } catch {
    return { width: null, height: null };
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function scanDir(dir, items, themes) {
  const entries = await readdir(dir, { withFileTypes: true });
  const meta = await loadMeta(dir);
  const defaultsMeta = meta.defaults || {};
  const filesMeta = meta.files || {};

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '_meta.yaml') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) { await scanDir(fullPath, items, themes); continue; }

    const ext = extname(entry.name).toLowerCase();
    if (!entry.isFile() || !ALL_EXTS.has(ext)) continue;

    const relPath = relative(WALL_DIR, fullPath);
    const relParts = relPath.split(sep);
    const fileName = relParts.pop();
    if (!fileName) continue;

    const baseName = basename(fileName, ext);
    const theme = relParts[0] || 'misc';
    const fileMeta = filesMeta[fileName] || {};
    const fileStats = await stat(fullPath);

    const isVideo = VIDEO_EXTS.has(ext);
    const dims = isVideo ? await getVideoDimensions(fullPath) : await getImageDimensions(fullPath);

    const autoTags = [...relParts.map(normalizeToken), ...baseName.split(/[-_ ]+/).map(normalizeToken)];
    let tags;
    if (fileMeta.tags) {
      tags = unique([theme, ...fileMeta.tags.map(normalizeToken)]);
    } else {
      tags = unique([...autoTags, ...(defaultsMeta.tags || []).map(normalizeToken)]);
    }

    themes.add(theme);
    const thumbExt = 'webp';
    const thumbPath = `src/thumbs/${theme}/${baseName}.${thumbExt}`;

    items.push({
      id: [...relParts, baseName].map(normalizeToken).filter(Boolean).join('-'),
      src: join(WALL_DIR, ...relParts, fileName).split(sep).join('/'),
      thumb: thumbPath,
      title: fileMeta.title?.trim() || humanize(baseName),
      theme,
      tags,
      size: classifySize(dims.width, dims.height),
      width: dims.width,
      height: dims.height,
      bytes: fileStats.size,
      ext: ext.slice(1),
    });
  }
}

const items = [];
const themes = new Set();

try { await stat(WALL_DIR); } catch {
  console.log(`No ${WALL_DIR}/ directory found — writing empty index`);
}
try { await scanDir(WALL_DIR, items, themes); } catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

await mkdir('_data', { recursive: true });
await writeFile(OUT_FILE, JSON.stringify({
  updatedAt: new Date().toISOString(),
  themes: Array.from(themes).sort(),
  sizes: ['mobile', 'desktop', 'wide'],
  items,
}, null, 2));

console.log(`Wrote ${items.length} items (${themes.size} themes) to ${OUT_FILE}`);
