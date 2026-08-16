import { Router } from 'express';
import { getDb, save, now, readClipFile } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { genShareCode } from '../utils/helpers.js';

const router = Router();

router.use('/manage', authRequired);

router.get('/manage', (req, res) => {
  const db = getDb();
  const shares = db.shares
    .filter((s) => s.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((s) => {
      const clip = db.clips.find((c) => c.id === s.clipId);
      return { ...s, clipTitle: clip ? clip.title : '已删除', active: isActive(s) };
    });
  res.json({ items: shares });
});

function isActive(share) {
  if (share.disabled) return false;
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

router.post('/manage', (req, res) => {
  const { clipId, expiresIn } = req.body || {};
  const db = getDb();
  const clip = db.clips.find((c) => c.id === clipId && c.userId === req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  const existing = db.shares.find((s) => s.clipId === clipId && s.userId === req.user.id);
  if (existing) {
    existing.disabled = false;
    existing.expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 86400000).toISOString() : null;
    existing.updatedAt = now();
    save();
    return res.json({ share: existing });
  }
  const share = {
    id: `share_${db.counters.share = (db.counters.share || 0) + 1}`,
    userId: req.user.id,
    clipId,
    code: genShareCode(),
    disabled: false,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 86400000).toISOString() : null,
    createdAt: now(),
    updatedAt: now()
  };
  db.shares.push(share);
  save();
  res.status(201).json({ share });
});

router.delete('/manage/:id', (req, res) => {
  const db = getDb();
  db.shares = db.shares.filter((s) => !(s.id === req.params.id && s.userId === req.user.id));
  save();
  res.json({ ok: true });
});

router.post('/manage/:id/toggle', (req, res) => {
  const db = getDb();
  const share = db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!share) return res.status(404).json({ message: '分享不存在' });
  share.disabled = !share.disabled;
  share.updatedAt = now();
  save();
  res.json({ share: { ...share, active: isActive(share) } });
});

router.get('/public/:code', (req, res) => {
  const db = getDb();
  const share = db.shares.find((s) => s.code === req.params.code);
  if (!share || share.disabled) return res.status(404).json({ message: '分享链接不存在或已失效' });
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({ message: '分享链接已过期' });
  }
  const full = readClipFile(share.clipId);
  if (!full) return res.status(404).json({ message: '剪藏内容不存在' });
  const { text, content, ...rest } = full;
  res.json({ clip: { ...rest, content, text } });
});

export default router;
