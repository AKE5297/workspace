import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';
import config from './config.js';
import { getDb } from './db.js';
import { rebuildIfEmpty, buildIndex } from './services/searchService.js';
import { purgeExpired } from './services/recycleService.js';

import authRoutes from './routes/auth.js';
import clipRoutes from './routes/clips.js';
import tagRoutes from './routes/tags.js';
import notebookRoutes from './routes/notebooks.js';
import draftRoutes from './routes/drafts.js';
import shareRoutes from './routes/shares.js';
import statRoutes from './routes/stats.js';
import recycleRoutes from './routes/recycle.js';
import batchRoutes from './routes/batch.js';
import rssRoutes from './routes/rss.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/uploads.js';
import extractRoutes from './routes/extract.js';
import exportRoutes from './routes/export.js';
import knowledgeRoutes from './routes/knowledge.js';
import ragRoutes from './routes/rag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

getDb();
buildIndex();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(config.uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/clips', clipRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/stats', statRoutes);
app.use('/api/recycle', recycleRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/extract', extractRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/rag', ragRoutes);
app.use('/rss', rssRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (process.env.SERVE_DIST === 'true' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api|rss|uploads).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || '服务器内部错误' });
});

cron.schedule('0 3 * * *', () => {
  const purged = purgeExpired();
  if (purged) console.log(`[cron] 清理回收站过期条目: ${purged}`);
});

cron.schedule('0 8 * * *', () => {
  console.log('[cron] 每日八点邮件汇总任务（按需扩展）');
});

app.listen(config.port, () => {
  console.log(`[server] Web Clipper backend listening on http://localhost:${config.port}`);
  if (!config.llm.apiKey) {
    console.log('[server] 未配置 USER_LLM_API_KEY，AI 摘要/智能标签功能将返回空结果');
  }
});
