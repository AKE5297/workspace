import flexsearch from 'flexsearch';
import { getDb } from '../db.js';

const { Index } = flexsearch;

let index = null;
let docMap = new Map();

export function buildIndex() {
  const clips = getDb().clips;
  index = new Index({ tokenize: 'forward', cache: true });
  docMap = new Map();
  clips.forEach((clip) => {
    index.add(clip.id, `${clip.title} ${clip.text || ''} ${(clip.tags || []).join(' ')} ${clip.author || ''}`);
    docMap.set(clip.id, clip);
  });
}

export function ensureIndex() {
  if (!index) buildIndex();
}

export function search(query, opts = {}) {
  ensureIndex();
  const q = String(query || '').trim();
  if (!q) return [];
  const results = index.search(q, { limit: opts.limit || 200 });
  return results.map((id) => docMap.get(id)).filter(Boolean);
}

export function addToIndex(clip) {
  ensureIndex();
  index.add(clip.id, `${clip.title} ${clip.text || ''} ${(clip.tags || []).join(' ')} ${clip.author || ''}`);
  docMap.set(clip.id, clip);
}

export function updateInIndex(clip) {
  removeFromIndex(clip.id);
  addToIndex(clip);
}

export function removeFromIndex(id) {
  if (!index) return;
  try {
    index.remove(id);
  } catch (e) {
    /* ignore */
  }
  docMap.delete(id);
}

export function rebuildIfEmpty() {
  ensureIndex();
}
