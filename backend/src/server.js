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

// CORS：默认 * 放行全部；配置 CORS_ORIGIN 后按白名单放行（逗号分隔多个来源）
const corsOrigin = (config.corsOrigin || '*').trim();
app.use(
  cors({
    origin:
      !corsOrigin || corsOrigin === '*'
        ? true
        : corsOrigin
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(config.uploadsDir));

// API 响应禁止缓存：避免浏览器对无缓存头的 GET 响应做启发式缓存，导致切换模块后读到陈旧数据
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

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
  const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status === 400 ? '请求体格式不正确' : err.message || '服务器内部错误' });
});

cron.schedule('0 3 * * *', () => {
  const purged = purgeExpired();
  if (purged) console.log(`[cron] 清理回收站过期条目: ${purged}`);
});

cron.schedule('0 8 * * *', () => {
  console.log('[cron] 每日八点邮件汇总任务（按需扩展）');
});

const server = app.listen(config.port, () => {
  console.log(`[server] Web Clipper backend listening on http://localhost:${config.port}`);
  if (!config.llm.apiKey) {
    console.log('[server] 未配置 USER_LLM_API_KEY，AI 摘要/智能标签功能将返回空结果');
  }
});

// 优雅停机：容器/进程管理器发送 SIGTERM 时先停止接收新连接，再等待存量请求完成
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] 收到 ${signal}，正在优雅退出...`);
  server.close(() => {
    console.log('[server] 已关闭全部连接，进程退出');
    process.exit(0);
  });
  // 兜底：10 秒内仍未关闭则强制退出，避免容器停不下来
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
