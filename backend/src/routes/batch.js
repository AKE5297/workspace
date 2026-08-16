import { Router } from 'express';
import { getDb, save, readClipFile, writeClipFile } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import * as search from '../services/searchService.js';
import { moveToRecycle, restoreFromRecycle } from '../services/recycleService.js';

const router = Router();
router.use(authRequired);

function applyBatch(clip, data) {
  if (data.title !== undefined && data.title !== '') clip.title = data.title;
  if (data.author !== undefined && data.author !== '') clip.author = data.author;
  if (data.notebookId !== undefined) clip.notebookId = data.notebookId;
  if (data.tags !== undefined) {
    if (data.tagMode === 'append') {
      clip.tags = [...new Set([...(clip.tags || []), ...data.tags.map((t) => String(t).trim()).filter(Boolean)])];
    } else {
      clip.tags = [...new Set(data.tags.map((t) => String(t).trim()).filter(Boolean))];
    }
  }
  clip.updatedAt = new Date().toISOString();
}

router.post('/edit', (req, res) => {
  const { ids, data } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要编辑的条目' });
  const db = getDb();
  let success = 0;
  const failed = [];
  ids.forEach((id) => {
    const idx = db.clips.findIndex((c) => c.id === id && c.userId === req.user.id);
    if (idx < 0) return failed.push(id);
    const clip = db.clips[idx];
    const full = readClipFile(id) || clip;
    applyBatch(full, data || {});
    db.clips[idx] = full;
    writeClipFile(id, full);
    search.updateInIndex(full);
    success++;
  });
  save();
  res.json({ ok: true, success, failed });
});

router.post('/delete', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要删除的条目' });
  const moved = moveToRecycle(req.user.id, ids);
  save();
  res.json({ ok: true, deleted: moved });
});

router.post('/restore', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要恢复的条目' });
  const restored = restoreFromRecycle(req.user.id, ids);
  save();
  res.json({ ok: true, restored });
});

router.post('/favorite', (req, res) => {
  const { ids, isFavorite } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择条目' });
  const db = getDb();
  let n = 0;
  ids.forEach((id) => {
    const idx = db.clips.findIndex((c) => c.id === id && c.userId === req.user.id);
    if (idx >= 0) {
      db.clips[idx].isFavorite = Boolean(isFavorite);
      db.clips[idx].favorite = Boolean(isFavorite);
      db.clips[idx].updatedAt = new Date().toISOString();
      n++;
    }
  });
  save();
  res.json({ ok: true, updated: n });
});

export default router;
