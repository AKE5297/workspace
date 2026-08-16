import { getDb, save, now, readClipFile, writeClipFile, deleteClipFile } from '../db.js';
import config from '../config.js';
import * as search from './searchService.js';

export function moveToRecycle(userId, ids) {
  const db = getDb();
  const moved = [];
  ids.forEach((id) => {
    const idx = db.clips.findIndex((c) => c.id === id && c.userId === userId);
    if (idx < 0) return;
    const clip = db.clips[idx];
    const full = readClipFile(id) || clip;
    const entry = {
      id: full.id,
      userId,
      clip: full,
      deletedAt: now(),
      expiresAt: new Date(Date.now() + config.recycleDays * 86400000).toISOString()
    };
    db.recycle.push(entry);
    db.clips.splice(idx, 1);
    search.removeFromIndex(id);
    moved.push(id);
  });
  return moved;
}

export function listRecycle(userId) {
  const db = getDb();
  return db.recycle
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
    .map((r) => {
      const remainDays = Math.max(
        0,
        Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 86400000)
      );
      return {
        ...r,
        remainDays,
        clip: (() => {
          const { text, content, ...rest } = r.clip || {};
          return rest;
        })()
      };
    });
}

export function restoreFromRecycle(userId, ids) {
  const db = getDb();
  const restored = [];
  ids.forEach((id) => {
    const idx = db.recycle.findIndex((r) => r.id === id && r.userId === userId);
    if (idx < 0) return;
    const entry = db.recycle[idx];
    if (entry.clip) {
      db.clips.push(entry.clip);
      writeClipFile(entry.clip.id, entry.clip);
      search.addToIndex(entry.clip);
    }
    db.recycle.splice(idx, 1);
    restored.push(id);
  });
  save();
  return restored;
}

export function purgeFromRecycle(userId, ids) {
  const db = getDb();
  const purged = [];
  ids.forEach((id) => {
    const idx = db.recycle.findIndex((r) => r.id === id && r.userId === userId);
    if (idx < 0) return;
    const entry = db.recycle[idx];
    if (entry.clip) {
      deleteClipFile(entry.clip.id);
      search.removeFromIndex(entry.clip.id);
    }
    db.recycle.splice(idx, 1);
    purged.push(id);
  });
  return purged;
}

export function purgeExpired() {
  const db = getDb();
  const nowTs = Date.now();
  const expired = db.recycle.filter((r) => new Date(r.expiresAt).getTime() <= nowTs);
  expired.forEach((r) => {
    if (r.clip) {
      deleteClipFile(r.clip.id);
      search.removeFromIndex(r.clip.id);
    }
  });
  if (expired.length) {
    db.recycle = db.recycle.filter((r) => new Date(r.expiresAt).getTime() > nowTs);
    save();
  }
  return expired.length;
}
