import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config.js';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif', '.ico']);

export function isRemoteImage(url) {
  return /^https?:\/\//i.test(url || '');
}

function extFor(contentType, url) {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/avif': '.avif',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico'
  };
  if (contentType && mimeMap[contentType.split(';')[0].trim().toLowerCase()]) {
    return mimeMap[contentType.split(';')[0].trim().toLowerCase()];
  }
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) return ext;
  } catch (e) {}
  return '.jpg';
}

async function downloadOne(src, dir) {
  try {
    const resp = await axios.get(src, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 8 * 1024 * 1024,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Referer: 'https://monkeycode-ai.online/'
      },
      validateStatus: (s) => s === 200
    });
    const buf = Buffer.from(resp.data);
    if (buf.length < 100) return null;
    const ext = extFor(resp.headers['content-type'], src);
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  } catch (e) {
    return null;
  }
}

export async function localizeImages(images = [], clipId) {
  if (!Array.isArray(images) || !images.length || !clipId) return { images: images || [], replace: {} };
  const dir = path.join(config.uploadsDir, 'clips', clipId);
  fs.mkdirSync(dir, { recursive: true });
  const localImages = [];
  const replace = {};
  for (const src of images) {
    if (!isRemoteImage(src)) {
      localImages.push(src);
      continue;
    }
    const name = await downloadOne(src, dir);
    if (name) {
      const local = `/uploads/clips/${clipId}/${name}`;
      replace[src] = local;
      localImages.push(local);
    } else {
      localImages.push(src);
    }
  }
  return { images: localImages, replace };
}

export function rewriteContentImages(content, replace) {
  if (!content || !replace || !Object.keys(replace).length) return content;
  let out = content;
  for (const [from, to] of Object.entries(replace)) {
    out = out.split(from).join(to);
  }
  return out;
}

export async function cleanClipImagesDir(clipId) {
  try {
    fs.rmSync(path.join(config.uploadsDir, 'clips', clipId), { recursive: true, force: true });
  } catch (e) {}
}
