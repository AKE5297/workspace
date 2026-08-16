import { Router } from 'express';
import { getDb, save, now } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import * as clipService from '../services/clipService.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const db = getDb();
  const drafts = (db.drafts || [])
    .filter((d) => d.userId === req.user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ items: drafts });
});

router.post('/', (req, res) => {
  const db = getDb();
  if (!db.drafts) db.drafts = [];
  const data = req.body || {};
  if (data.id) {
    const idx = db.drafts.findIndex((d) => d.id === data.id && d.userId === req.user.id);
    if (idx >= 0) {
      db.drafts[idx] = { ...db.drafts[idx], ...data, userId: req.user.id, updatedAt: now() };
      save();
      return res.json({ draft: db.drafts[idx] });
    }
  }
  const draft = {
    id: `draft_${db.counters.draft = (db.counters.draft || 0) + 1}`,
    userId: req.user.id,
    title: data.title || '',
    url: data.url || '',
    text: data.text || '',
    content: data.content || '',
    tags: data.tags || [],
    notebookId: data.notebookId || null,
    createdAt: now(),
    updatedAt: now()
  };
  db.drafts.push(draft);
  save();
  res.status(201).json({ draft });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.drafts = (db.drafts || []).filter((d) => !(d.id === req.params.id && d.userId === req.user.id));
  save();
  res.json({ ok: true });
});

export default router;
