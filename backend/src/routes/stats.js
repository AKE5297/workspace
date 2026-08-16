import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { buildStats } from '../services/statsService.js';
import { listReadLogsSince } from '../services/clipService.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(buildStats(req.user.id));
});

router.get('/reads', (req, res) => {
  const days = parseInt(req.query.days || '30', 10);
  const logs = listReadLogsSince(days).filter((r) => r.userId === req.user.id);
  res.json({ items: logs });
});

export default router;
