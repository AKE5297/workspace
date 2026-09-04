import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { authRequired } from '../middleware/auth.js';
import * as clipService from '../services/clipService.js';
import { mdToPdfBuffer } from '../services/pdfService.js';
import config from '../config.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const router = Router();
router.use(authRequired);

function safeFileName(name) {
  return (name || 'clip').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'clip';
}

function clipHeader(clip) {
  return (
    `# ${clip.title}\n\n` +
    `- 来源：${clip.url || '未知'}\n` +
    `- 作者：${clip.author || '未知'}\n` +
    `- 保存于：${clip.createdAt || ''}\n` +
    `- 标签：${(clip.tags || []).join(', ') || '无'}\n\n` +
    `---\n\n`
  );
}

router.get('/:id/markdown', (req, res) => {
  const clip = clipService.getOwnedClip(req.params.id, req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  const md = `# ${clip.title}\n\n> 来源：${clip.url || ''}\n> 作者：${clip.author || '未知'}  ·  保存于 ${clip.createdAt}\n\n---\n\n${clip.markdown || ''}\n`;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName(clip.title))}.md"`);
  res.send(md);
});

router.get('/:id/pdf', async (req, res) => {
  const clip = clipService.getOwnedClip(req.params.id, req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  try {
    const buf = await mdToPdfBuffer(clip.markdown || '', {
      title: clip.title,
      author: clip.author,
      url: clip.url,
      footer: `Web Clipper 导出 · ${clip.title}`
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName(clip.title))}.pdf"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ message: `PDF 生成失败：${e.message}` });
  }
});

router.get('/:id/view-markdown', (req, res) => {
  const clip = clipService.getOwnedClip(req.params.id, req.user.id);
  if (!clip) return res.status(404).json({ message: '剪藏不存在' });
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.send(clip.markdown || clip.text || '');
});

router.post('/batch-markdown', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ message: '未提供剪藏 ID' });
  const parts = [];
  for (const id of ids) {
    const clip = clipService.getOwnedClip(id, req.user.id);
    if (!clip) continue;
    parts.push(
      `# ${clip.title}\n\n` +
      `- 来源：${clip.url || '未知'}\n` +
      `- 作者：${clip.author || '未知'}\n` +
      `- 保存于：${clip.createdAt || ''}\n` +
      `- 标签：${(clip.tags || []).join(', ') || '无'}\n\n` +
      `---\n\n` +
      `${clip.markdown || ''}\n\n`
    );
  }
  if (!parts.length) return res.status(404).json({ message: '没有可导出的剪藏' });
  const content = `# 剪藏导出\n\n> 共 ${parts.length} 篇 · 生成于 ${new Date().toISOString()}\n\n---\n\n` + parts.join('\n\n');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clips-export-${Date.now()}.md"`);
  res.send(content);
});

function rewriteMdImages(md, clipId, usedAssets) {
  const regex = /!\[([^\]]*)\]\(\/uploads\/clips\/([^)\s]+?)\)/g;
  let out = md;
  const matches = md.matchAll(regex);
  for (const m of matches) {
    const [whole, alt, urlPath] = m;
    const rel = path.posix.basename(urlPath);
    const assetKey = `assets/${clipId}_${rel}`;
    usedAssets[assetKey] = path.posix.join(config.uploadsDir, 'clips', clipId, rel);
    out = out.split(whole).join(`![${alt}](${assetKey})`);
  }
  return out;
}

router.post('/batch-zip', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ message: '未提供剪藏 ID' });

  const archive = archiver('zip', { zlib: { level: 6 } });
  const usedAssets = {};
  let count = 0;
  let missing = 0;

  for (const id of ids) {
    const clip = clipService.getOwnedClip(id, req.user.id);
    if (!clip) continue;
    const md = rewriteMdImages(clip.markdown || '', clip.id, usedAssets);
    const mdName = `${String(count + 1).padStart(3, '0')}_${safeFileName(clip.title)}.md`;
    archive.append(clipHeader(clip) + md + '\n', { name: mdName });
    count++;
  }
  if (!count) return res.status(404).json({ message: '没有可导出的剪藏' });

  for (const [key, filePath] of Object.entries(usedAssets)) {
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: key });
    } else {
      missing++;
    }
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="clips-export-${Date.now()}.zip"`);
  archive.on('warning', (e) => console.warn('[zip]', e.message));
  archive.pipe(res);
  archive.finalize().catch((e) => console.error('[zip] finalize:', e.message));
  archive.on('error', (e) => {
    if (!res.headersSent) res.status(500).json({ message: `ZIP 导出失败：${e.message}` });
  });
  res.on('close', () => {
    if (missing) console.warn(`[zip] ${missing} 张图片未找到，已跳过`);
  });
});

export default router;
