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

function refererOf(pageUrl) {
  try {
    const u = new URL(pageUrl);
    return u.origin;
  } catch (e) {
    return '';
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

// 微信图片 CDN 校验 Referer 白名单，非微信来源会返回 200 防盗链占位图
const WECHAT_IMG_HOST = /(^|\.)(qpic\.cn|qlogo\.cn)$/i;

function pickReferer(src, pageUrl) {
  if (WECHAT_IMG_HOST.test(hostOf(src))) return 'https://mp.weixin.qq.com/';
  return refererOf(pageUrl);
}

async function downloadOne(src, dir, pageUrl) {
  const baseHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
  };
  const referer = pickReferer(src, pageUrl);
  // 带来源页 origin 模拟真实浏览器（微信图需 mp.weixin.qq.com 白名单 Referer，否则返回 200 防盗链占位图）
  const attempt = async (withReferer) => {
    const headers = { ...baseHeaders };
    if (withReferer && referer) headers.Referer = referer;
    const resp = await axios.get(src, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 8 * 1024 * 1024,
      headers,
      validateStatus: (s) => s === 200
    });
    return { buf: Buffer.from(resp.data), contentType: resp.headers['content-type'] || '' };
  };
  try {
    // 防盗链普遍放行空 Referer 而拦截未知 Referer，故先不带 Referer；
    // 少数图床要求白名单 Referer（如微信图需 mp.weixin.qq.com）时再带上重试
    const order = referer ? [false, true] : [false];
    let result = null;
    for (const withReferer of order) {
      try {
        const r = await attempt(withReferer);
        if (r && r.buf && r.buf.length >= 100) {
          result = r;
          break;
        }
      } catch (e) { /* 尝试下一种 */ }
    }
    if (!result) return null;
    const ext = extFor(result.contentType, src);
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(dir, name), result.buf);
    return name;
  } catch (e) {
    return null;
  }
}

export async function localizeImages(images = [], clipId, pageUrl = '') {
  if (!Array.isArray(images) || !images.length || !clipId) return { images: images || [], replace: {} };
  const dir = path.join(config.uploadsDir, 'clips', clipId);
  fs.mkdirSync(dir, { recursive: true });
  const localImages = new Array(images.length);
  const replace = {};
  // 受限并发下载：串行在长文（数十张图）下延迟过高，全量并发又可能压垮图床/内存
  const CONCURRENCY = Math.min(4, images.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < images.length) {
      const i = cursor++;
      const src = images[i];
      if (!isRemoteImage(src)) {
        localImages[i] = src;
        continue;
      }
      const name = await downloadOne(src, dir, pageUrl);
      if (name) {
        const local = `/uploads/clips/${clipId}/${name}`;
        replace[src] = local;
        localImages[i] = local;
      } else {
        localImages[i] = src;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const failed = images.filter((src) => isRemoteImage(src) && !replace[src]);
  if (failed.length) {
    console.warn(`[images] ${clipId} 本地化失败 ${failed.length}/${images.length} 张，保留原外链：`, failed.slice(0, 3));
  }
  return { images: localImages, replace };
}

export function rewriteContentImages(content, replace) {
  if (!content || !replace || !Object.keys(replace).length) return content;
  let out = content;
  // 按 URL 长度降序替换：避免短 URL 是长 URL 前缀时把长 URL 破坏成 “本地路径 + 残余 query”
  const entries = Object.entries(replace).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    out = out.split(from).join(to);
  }
  return out;
}

export async function cleanClipImagesDir(clipId) {
  try {
    fs.rmSync(path.join(config.uploadsDir, 'clips', clipId), { recursive: true, force: true });
  } catch (e) {}
}
