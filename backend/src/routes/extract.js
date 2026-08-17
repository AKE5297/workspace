import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { extractFromUrl } from '../services/extractService.js';

const router = Router();

router.post('/', authRequired, async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ message: '请提供要抓取的 URL' });
  try {
    const result = await extractFromUrl(url);
    res.json(result);
  } catch (e) {
    const status = e.response?.status;
    const detail = status ? `（HTTP ${status}）` : `（${e.message}）`;
    res.status(422).json({ message: `无法抓取该链接，请手动填写内容 ${detail}` });
  }
});

export default router;
