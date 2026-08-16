import { Router } from 'express';
import { getDb, save } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import * as recycleService from '../services/recycleService.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const items = recycleService.listRecycle(req.user.id);
  const db = getDb();
  const notebookNames = new Map(db.notebooks.map((n) => [n.id, n.name]));
  res.json({
    items: items.map((r) => ({
      ...r,
      clip: { ...r.clip, notebookName: r.clip?.notebookId ? notebookNames.get(r.clip.notebookId) || '未知' : '未分类' }
    }))
  });
});

router.post('/restore', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要恢复的条目' });
  const restored = recycleService.restoreFromRecycle(req.user.id, ids);
  save();
  res.json({ ok: true, restored });
});

router.post('/purge', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要删除的条目' });
  const purged = recycleService.purgeFromRecycle(req.user.id, ids);
  save();
  res.json({ ok: true, purged });
});

router.post('/purge-all', (req, res) => {
  const items = recycleService.listRecycle(req.user.id);
  const purged = recycleService.purgeFromRecycle(req.user.id, items.map((i) => i.id));
  save();
  res.json({ ok: true, purged: purged.length });
});

export default router;
