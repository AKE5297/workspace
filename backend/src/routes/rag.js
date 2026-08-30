import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { ask, hasLLM } from '../services/ragService.js';

const router = Router();
router.use(authRequired);

router.get('/status', (req, res) => {
  res.json({ configured: hasLLM() });
});

router.post('/ask', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ message: '请输入问题' });
  if (question.length > 2000) return res.status(400).json({ message: '问题过长' });
  try {
    const result = await ask(question, req.user.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: `问答失败：${e.message}` });
  }
});

export default router;
