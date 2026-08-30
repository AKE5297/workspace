import { getDb, nextId, now, readClipFile, writeClipFile, deleteClipFile } from '../db.js';
import { normalizeUrl, extractDomain, todayKey } from '../utils/helpers.js';
import * as search from './searchService.js';
import { localizeImages, rewriteContentImages, cleanClipImagesDir } from './imageService.js';
import { htmlToMarkdown } from './markdownService.js';

function toPublic(clip) {
  if (!clip) return null;
  const { text, content, markdown, ...rest } = clip;
  return { ...rest };
}

export function findDuplicate(userId, url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const existing = getDb().clips.find(
    (c) => c.userId === userId && c.url && normalizeUrl(c.url) === normalized
  );
  if (!existing) return null;
  const full = readClipFile(existing.id) || existing;
  return { clip: toPublic(full), title: full.title, createdAt: full.createdAt };
}

export async function createClip(userId, data) {
  const db = getDb();
  const id = `clip_${nextId('clip')}`;
  const explicitImages = Array.isArray(data.images) ? data.images.filter((u) => /^https?:\/\//i.test(u)) : [];
  const contentImages = extractImagesFromContent(data.content);
  const imageSource = [...new Set([...explicitImages, ...contentImages])];
  const { replace } = await localizeImages(imageSource, id);
  const newContent = rewriteContentImages(data.content, replace);
  const markdown = data.markdown || htmlToMarkdown(newContent) || (data.text || '');
  const clip = {
    id,
    userId,
    title: data.title || '未命名剪藏',
    url: data.url || '',
    domain: data.url ? extractDomain(data.url) : '',
    author: data.author || '',
    tags: Array.isArray(data.tags) ? [...new Set(data.tags.map((t) => String(t).trim()).filter(Boolean))] : [],
    notebookId: data.notebookId || null,
    isFavorite: Boolean(data.isFavorite),
    summary: data.summary || '',
    text: data.text || '',
    content: newContent,
    markdown,
    images: extractImagesFromContent(newContent),
    screenshot: data.screenshot || '',
    readingTime: data.readingTime || 0,
    favorite: Boolean(data.favorite),
    readCount: 0,
    note: data.note || '',
    createdAt: now(),
    updatedAt: now()
  };
  db.clips.push(clip);
  writeClipFile(id, clip);
  search.addToIndex(clip);
  return clip;
}

export function getClipFull(id) {
  return readClipFile(id) || getDb().clips.find((c) => c.id === id) || null;
}

export function getOwnedClip(id, userId) {
  const db = getDb();
  const clip = db.clips.find((c) => c.id === id && c.userId === userId);
  if (!clip) return null;
  return readClipFile(id) || clip;
}

export function extractImagesFromContent(content) {
  if (!content) return [];
  const srcs = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(content))) {
    if (m[1] && !srcs.includes(m[1])) srcs.push(m[1]);
  }
  return srcs;
}

export async function updateClip(id, data) {
  const db = getDb();
  const idx = db.clips.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const existing = db.clips[idx];
  const full = readClipFile(id) || existing;
  const hasImages = data.images !== undefined;
  const contentImages = data.content !== undefined ? extractImagesFromContent(data.content) : [];
  const explicitImages = hasImages ? data.images.filter((u) => /^https?:\/\//i.test(u)) : [];
  const imageSource = data.content !== undefined || hasImages
    ? [...new Set([...explicitImages, ...contentImages])]
    : undefined;
  const { replace } = await localizeImages(imageSource, id);
  const newContent = data.content !== undefined ? rewriteContentImages(data.content, replace) : existing.content;
  const newMarkdown = data.markdown !== undefined
    ? data.markdown
    : data.content !== undefined
      ? htmlToMarkdown(newContent) || (data.text !== undefined ? data.text : existing.text)
      : undefined;
  const finalImages = data.content !== undefined || hasImages
    ? extractImagesFromContent(newContent)
    : existing.images;
  const merged = {
    ...full,
    title: data.title !== undefined ? data.title : existing.title,
    url: data.url !== undefined ? data.url : existing.url,
    domain: data.url ? extractDomain(data.url) : existing.domain,
    author: data.author !== undefined ? data.author : existing.author,
    tags: data.tags !== undefined
      ? [...new Set(data.tags.map((t) => String(t).trim()).filter(Boolean))]
      : existing.tags,
    notebookId: data.notebookId !== undefined ? data.notebookId : existing.notebookId,
    isFavorite: data.isFavorite !== undefined ? data.isFavorite : existing.isFavorite,
    favorite: data.favorite !== undefined ? data.favorite : existing.favorite,
    summary: data.summary !== undefined ? data.summary : existing.summary,
    text: data.text !== undefined ? data.text : existing.text,
    content: newContent,
    markdown: newMarkdown !== undefined ? newMarkdown : existing.markdown,
    images: finalImages,
    note: data.note !== undefined ? data.note : existing.note,
    updatedAt: now()
  };
  db.clips[idx] = merged;
  writeClipFile(id, merged);
  search.updateInIndex(merged);
  return merged;
}

export function hardDelete(id) {
  const db = getDb();
  const idx = db.clips.findIndex((c) => c.id === id);
  if (idx >= 0) db.clips.splice(idx, 1);
  deleteClipFile(id);
  cleanClipImagesDir(id);
  search.removeFromIndex(id);
}

export function recordRead(id) {
  const db = getDb();
  const idx = db.clips.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const clip = db.clips[idx];
  clip.readCount = (clip.readCount || 0) + 1;
  clip.lastReadAt = now();
  const full = readClipFile(id);
  if (full) {
    full.readCount = clip.readCount;
    full.lastReadAt = clip.lastReadAt;
    writeClipFile(id, full);
  }
  const reads = db.readLogs || (db.readLogs = []);
  reads.push({ clipId: id, userId: clip.userId, at: now(), mode: 'detail' });
  if (reads.length > 20000) reads.splice(0, reads.length - 20000);
}

export function publicClip(clip) {
  return toPublic(clip);
}

export function listReadLogsSince(days) {
  const db = getDb();
  const cutoff = Date.now() - days * 86400000;
  return (db.readLogs || []).filter((r) => new Date(r.at).getTime() >= cutoff);
}
