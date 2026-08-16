import { Router } from 'express';
import { getDb, readClipFile } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { stripHtml, truncate } from '../utils/helpers.js';

const router = Router();

function feedItem(clip, base) {
  const full = readClipFile(clip.id) || clip;
  return {
    title: clip.title || '未命名',
    link: clip.url || `${base}/clip/${clip.id}`,
    description: stripHtml(full.summary || full.text || '').slice(0, 500),
    author: clip.author || '',
    pubDate: clip.createdAt || new Date().toISOString(),
    tags: clip.tags || []
  };
}

function buildXml(feedTitle, items, base) {
  const rssItems = items
    .map((it) => {
      const tags = (it.tags || []).map((t) => `<category><![CDATA[${t}]]></category>`).join('');
      return `<item>
  <title><![CDATA[${it.title}]]></title>
  <link><![CDATA[${it.link}]]></link>
  <description><![CDATA[${it.description}]]></description>
  ${it.author ? `<author><![CDATA[${it.author}]]></author>` : ''}
  <pubDate>${new Date(it.pubDate).toUTCString()}</pubDate>
  <guid isPermaLink="false">${it.guid || ''}</guid>
  ${tags}
</item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title><![CDATA[${feedTitle}]]></title>
  <link><![CDATA[${base}]]></link>
  <description><![CDATA[${feedTitle} 的 RSS 订阅]]></description>
  <atom:link href="${base}" rel="self" type="application/rss+xml"/>
  ${rssItems}
</channel>
</rss>`;
}

function buildAtom(feedTitle, items, base) {
  const entries = items
    .map((it) => `<entry>
  <title><![CDATA[${it.title}]]></title>
  <link href="${it.link}"/>
  <id>${it.guid || ''}</id>
  <updated>${new Date(it.pubDate).toISOString()}</updated>
  <summary type="html"><![CDATA[${it.description}]]></summary>
  ${it.author ? `<author><name>${it.author}</name></author>` : ''}
</entry>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[${feedTitle}]]></title>
  <link href="${base}"/>
  <id>${base}</id>
  <updated>${new Date().toISOString()}</updated>
  ${entries}
</feed>`;
}

router.get('/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const format = req.query.format === 'atom' ? 'atom' : 'rss';
  const db = getDb();
  const base = `${req.protocol}://${req.get('host')}`;

  let clips = [];
  let feedTitle = '';
  if (type === 'notebook') {
    const nb = db.notebooks.find((n) => n.id === id);
    if (!nb) return res.status(404).json({ message: '笔记本不存在' });
    feedTitle = `笔记本：${nb.name}`;
    clips = db.clips
      .filter((c) => c.notebookId === id || db.notebooks.some((n) => n.id === c.notebookId && n.parentId === id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (type === 'tag') {
    const tag = decodeURIComponent(id);
    feedTitle = `标签：${tag}`;
    clips = db.clips
      .filter((c) => c.tags && c.tags.includes(tag))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    return res.status(400).json({ message: '不支持的订阅类型' });
  }

  const items = clips.slice(0, 50).map((c) => {
    const it = feedItem(c, base);
    it.guid = `clip-${c.id}`;
    return it;
  });
  const xml = format === 'atom'
    ? buildAtom(feedTitle, items, `${base}/rss/${type}/${encodeURIComponent(id)}`)
    : buildXml(feedTitle, items, `${base}/rss/${type}/${encodeURIComponent(id)}`);

  res.set('Content-Type', format === 'atom' ? 'application/atom+xml; charset=utf-8' : 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

export default router;
