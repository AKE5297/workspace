import { Router } from 'express';
import { getDb, readClipFile } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function domainOf(url) {
  if (!url) return '无来源';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return '无来源';
  }
}

function monthOf(iso) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch (e) {
    return '未知';
  }
}

router.get('/stats', (req, res) => {
  const clips = getDb().clips.filter((c) => c.userId === req.user.id);

  const domainCount = {};
  const tagCount = {};
  const monthCount = {};
  const notebookCount = {};
  let totalChars = 0;

  for (const c of clips) {
    const d = domainOf(c.url);
    domainCount[d] = (domainCount[d] || 0) + 1;
    const m = monthOf(c.createdAt);
    monthCount[m] = (monthCount[m] || 0) + 1;
    if (c.notebookId) notebookCount[c.notebookId] = (notebookCount[c.notebookId] || 0) + 1;
    for (const t of c.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
    const full = readClipFile(c.id) || c;
    totalChars += (full.markdown || full.text || '').length;
  }

  const top = (obj, n = 10) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, value]) => ({ key, value }));

  const notebookNames = {};
  getDb().notebooks.forEach((nb) => {
    notebookNames[nb.id] = nb.name;
  });

  res.json({
    totals: {
      clips: clips.length,
      tags: Object.keys(tagCount).length,
      domains: Object.keys(domainCount).length,
      months: Object.keys(monthCount).length,
      chars: totalChars
    },
    byDomain: top(domainCount, 12),
    byTag: top(tagCount, 20),
    byMonth: top(monthCount, 24).reverse(),
    byNotebook: top(notebookCount, 20).map((item) => ({
      ...item,
      name: notebookNames[item.key] || '未分类'
    }))
  });
});

export default router;
