import { Router } from 'express';
import { getDb, save, now, readClipFile } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import * as clipService from '../services/clipService.js';
import * as search from '../services/searchService.js';
import { generateSummary, recommendTags } from '../services/aiService.js';
import { sendTelegram, sendEmail } from '../services/notifyService.js';
import * as recycleService from '../services/recycleService.js';

const router = Router();
router.use(authRequired);

function publicList(clips, includeText = false) {
  return clips.map((c) => {
    const full = includeText ? c : { ...c };
    if (!includeText) {
      const { text, content, ...rest } = full;
      return { ...rest, excerpt: (c.text || '').slice(0, 160) };
    }
    return full;
  });
}

router.get('/', (req, res) => {
  const { q, tag, notebookId, favorite, sort = 'newest', page = '1', pageSize = '20', includeText } = req.query;
  let clips = getDb().clips.filter((c) => c.userId === req.user.id);

  if (q) {
    const hits = search.search(q);
    const hitIds = new Set(hits.map((h) => h.id));
    clips = clips.filter((c) => hitIds.has(c.id));
  }
  if (tag) clips = clips.filter((c) => c.tags && c.tags.includes(tag));
  if (notebookId) clips = clips.filter((c) => c.notebookId === notebookId);
  if (favorite === 'true') clips = clips.filter((c) => c.isFavorite || c.favorite);

  clips.sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === 'read') return (b.readCount || 0) - (a.readCount || 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const total = clips.length;
  const start = (p - 1) * ps;
  const items = publicList(clips.slice(start, start + ps), includeText === 'true');
  res.json({ items, total, page: p, pageSize: ps });
});

router.get('/duplicate', (req, res) => {
  const { url } = req.query;
  const dup = clipService.findDuplicate(req.user.id, url);
  if (dup) {
    return res.json({ duplicated: true, clip: dup.clip, title: dup.title, createdAt: dup.createdAt });
  }
  res.json({ duplicated: false });
});

router.get('/:id', (req, res) => {
  const clip = getDb().clips.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  const full = clipService.getClipFull(req.params.id) || clip;
  res.json(full);
});

router.post('/', async (req, res) => {
  const data = req.body || {};
  const dup = clipService.findDuplicate(req.user.id, data.url);
  const clip = clipService.createClip(req.user.id, data);
  save();

  let summary = clip.summary || '';
  if (!summary && data.autoSummary) {
    try {
      summary = await generateSummary(clip);
      if (summary) clipService.updateClip(clip.id, { summary });
    } catch (e) {
      console.error('summary failed:', e.message);
    }
  }
  if (data.notify) {
    try { await sendTelegram(clip); } catch (e) { console.error('telegram failed:', e.message); }
    try { await sendEmail(clip); } catch (e) { console.error('email failed:', e.message); }
  }
  res.status(201).json({ clip: clipService.publicClip(clip), duplicated: dup ? dup.clip.id : null });
});

router.post('/:id/read', (req, res) => {
  clipService.recordRead(req.params.id);
  save();
  res.json({ ok: true });
});

router.post('/:id/summary', async (req, res) => {
  const clip = getDb().clips.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  const full = clipService.getClipFull(req.params.id) || clip;
  try {
    const summary = await generateSummary(full);
    if (summary) {
      clipService.updateClip(full.id, { summary });
      save();
    }
    res.json({ summary });
  } catch (e) {
    res.status(500).json({ message: `摘要生成失败：${e.message}` });
  }
});

router.post('/:id/toggle-favorite', (req, res) => {
  const clip = getDb().clips.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  const next = !(clip.isFavorite || clip.favorite);
  const updated = clipService.updateClip(req.params.id, { isFavorite: next, favorite: next });
  save();
  res.json({ isFavorite: next, clip: clipService.publicClip(updated) });
});

router.put('/:id', (req, res) => {
  const clip = getDb().clips.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  const updated = clipService.updateClip(req.params.id, req.body || {});
  save();
  res.json({ clip: clipService.publicClip(updated) });
});

router.delete('/:id', (req, res) => {
  const { recycle = 'true' } = req.query;
  if (recycle === 'true') {
    recycleService.moveToRecycle(req.user.id, [req.params.id]);
    save();
    res.json({ ok: true, movedToRecycle: true });
  } else {
    clipService.hardDelete(req.params.id);
    save();
    res.json({ ok: true });
  }
});

export default router;
