import { getDb, nextId, now, readClipFile, writeClipFile, deleteClipFile } from '../db.js';
import { normalizeUrl, extractDomain, todayKey } from '../utils/helpers.js';
import * as search from './searchService.js';

function toPublic(clip) {
  if (!clip) return null;
  const { text, content, ...rest } = clip;
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

export function createClip(userId, data) {
  const db = getDb();
  const id = `clip_${nextId('clip')}`;
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
    content: data.content || '',
    images: Array.isArray(data.images) ? data.images : [],
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

export function updateClip(id, data) {
  const db = getDb();
  const idx = db.clips.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const existing = db.clips[idx];
  const full = readClipFile(id) || existing;
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
    content: data.content !== undefined ? data.content : existing.content,
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
  search.removeFromIndex(id);
}

export function recordRead(id) {
  const db = getDb();
  const idx = db.clips.findIndex((c) => c.id === id);
  if (idx < 0) return;
  db.clips[idx].readCount = (db.clips[idx].readCount || 0) + 1;
  db.clips[idx].lastReadAt = now();
  const reads = db.readLogs || (db.readLogs = []);
  reads.push({ clipId: id, userId: db.clips[idx].userId, at: now(), mode: 'detail' });
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
