import crypto from 'crypto';

export function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text, len = 120) {
  const t = String(text || '').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

export function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

export function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return trimmed;
  }
}

export function genShareCode() {
  return crypto.randomBytes(6).toString('hex');
}

export function todayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
