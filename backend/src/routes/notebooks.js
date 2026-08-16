import { Router } from 'express';
import { getDb, save, now } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { moveToRecycle } from '../services/recycleService.js';
import { collectNotebookStats } from '../services/statsService.js';

const router = Router();
router.use(authRequired);

function tree(notebooks) {
  const byParent = new Map();
  notebooks.forEach((n) => {
    const key = n.parentId || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  });
  const build = (parentId) =>
    (byParent.get(parentId) || [])
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
      .map((n) => ({ ...n, children: build(n.id) }));
  return build('');
}

router.get('/', (req, res) => {
  const db = getDb();
  const mine = db.notebooks.filter((n) => n.userId === req.user.id);
  const counts = collectNotebookStats(req.user.id);
  const withCount = mine.map((n) => ({
    ...n,
    count: counts.get(n.id) || 0,
    children: []
  }));
  res.json({ items: withCount, tree: tree(withCount) });
});

router.post('/', (req, res) => {
  const { name, parentId } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ message: '笔记本名称不能为空' });
  const db = getDb();
  if (parentId) {
    const parent = db.notebooks.find((n) => n.id === parentId && n.userId === req.user.id);
    if (!parent) return res.status(400).json({ message: '父级笔记本不存在' });
    if (parent.parentId) return res.status(400).json({ message: '仅支持两级笔记本，不能再创建三级' });
  }
  const notebook = {
    id: `nb_${db.counters.notebook = (db.counters.notebook || 0) + 1}`,
    userId: req.user.id,
    name: trimmed,
    parentId: parentId || null,
    createdAt: now()
  };
  db.notebooks.push(notebook);
  save();
  res.status(201).json({ notebook });
});

router.put('/:id', (req, res) => {
  const { name, parentId } = req.body || {};
  const db = getDb();
  const nb = db.notebooks.find((n) => n.id === req.params.id && n.userId === req.user.id);
  if (!nb) return res.status(404).json({ message: '笔记本不存在' });
  if (name !== undefined) nb.name = String(name).trim() || nb.name;
  if (parentId !== undefined) {
    if (parentId === nb.id) return res.status(400).json({ message: '不能将笔记本设为自身的父级' });
    if (parentId) {
      const parent = db.notebooks.find((n) => n.id === parentId && n.userId === req.user.id);
      if (!parent) return res.status(400).json({ message: '父级笔记本不存在' });
      if (parent.parentId) return res.status(400).json({ message: '仅支持两级笔记本' });
    }
    nb.parentId = parentId || null;
  }
  save();
  res.json({ notebook: nb });
});

router.delete('/:id', (req, res) => {
  const { cascade, transfer } = req.query;
  const db = getDb();
  const nb = db.notebooks.find((n) => n.id === req.params.id && n.userId === req.user.id);
  if (!nb) return res.status(404).json({ message: '笔记本不存在' });

  const childrenIds = db.notebooks
    .filter((n) => n.parentId === nb.id && n.userId === req.user.id)
    .map((n) => n.id);

  if (cascade === 'true') {
    childrenIds.forEach((cid) => {
      const clipIds = db.clips.filter((c) => c.userId === req.user.id && c.notebookId === cid).map((c) => c.id);
      moveToRecycle(req.user.id, clipIds);
    });
    db.notebooks = db.notebooks.filter((n) => !(n.parentId === nb.id && n.userId === req.user.id));
  } else {
    const target = transfer || null;
    if (target) {
      const t = db.notebooks.find((n) => n.id === target && n.userId === req.user.id);
      if (!t) return res.status(400).json({ message: '目标笔记本不存在' });
      childrenIds.forEach((cid) => {
        db.clips.forEach((c) => {
          if (c.userId === req.user.id && c.notebookId === cid) c.notebookId = target;
        });
      });
    }
    childrenIds.forEach((cid) => {
      db.notebooks = db.notebooks.filter((n) => !(n.id === cid && n.userId === req.user.id));
    });
  }

  const clipIds = db.clips.filter((c) => c.userId === req.user.id && c.notebookId === nb.id).map((c) => c.id);
  moveToRecycle(req.user.id, clipIds);
  db.notebooks = db.notebooks.filter((n) => !(n.id === nb.id && n.userId === req.user.id));
  save();
  res.json({ ok: true });
});

export default router;
