import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import * as clipService from '../services/clipService.js';
import { mdToPdfBuffer } from '../services/pdfService.js';

const router = Router();
router.use(authRequired);

function safeFileName(name) {
  return (name || 'clip').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'clip';
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
      url: clip.url
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

export default router;
