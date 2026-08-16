import { Router } from 'express';
import { getDb, save, now } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { recommendTags } from '../services/aiService.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const db = getDb();
  const tags = db.tags
    .filter((t) => t.userId === req.user.id)
    .map((t) => {
      const count = db.clips.filter(
        (c) => c.userId === req.user.id && c.tags && c.tags.includes(t.name)
      ).length;
      return { id: t.id, name: t.name, count };
    })
    .sort((a, b) => b.count - a.count);
  res.json({ items: tags });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ message: '标签名不能为空' });
  const db = getDb();
  if (db.tags.some((t) => t.userId === req.user.id && t.name === trimmed)) {
    return res.status(409).json({ message: '标签已存在' });
  }
  const tag = { id: `tag_${db.counters.tag = (db.counters.tag || 0) + 1}`, userId: req.user.id, name: trimmed, createdAt: now() };
  db.tags.push(tag);
  save();
  res.status(201).json({ tag });
});

router.delete('/:name', (req, res) => {
  const db = getDb();
  const name = decodeURIComponent(req.params.name);
  db.tags = db.tags.filter((t) => !(t.userId === req.user.id && t.name === name));
  db.clips.forEach((c) => {
    if (c.userId === req.user.id && c.tags) {
      c.tags = c.tags.filter((t) => t !== name);
    }
  });
  save();
  res.json({ ok: true });
});

router.post('/recommend', async (req, res) => {
  const { text, title } = req.body || {};
  try {
    const tags = await recommendTags({ text: text || title || '', title: title || '' });
    res.json({ tags });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
