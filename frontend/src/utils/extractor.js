import { Readability, isProbablyReaderable } from '@mozilla/readability';

function parseDocument(html, url) {
  // 浏览器端使用 DOMParser；Node 端（如扩展脚本）可传入全局 document
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (url) {
      try {
        doc.baseURI = url;
      } catch (e) { /* ignore */ }
    }
    return doc;
  }
  // Node 环境回退：使用注入的 document（供 Chrome 扩展等场景）
  const g = globalThis;
  if (g.document) {
    const temp = g.document.createElement('div');
    temp.innerHTML = html;
    const doc = g.document.implementation.createHTMLDocument('');
    doc.title = temp.querySelector('title')?.textContent || '';
    const head = doc.querySelector('head');
    const body = doc.querySelector('body');
    if (head && temp.querySelector('head')) head.innerHTML = temp.querySelector('head').innerHTML;
    if (body) body.innerHTML = temp.querySelector('body')?.innerHTML || '';
    return doc;
  }
  throw new Error('当前环境不支持 HTML 解析');
}

export function extractFromHtml(html, url) {
  const document = parseDocument(html, url);

  let title = document.title || '';
  const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
  if (metaTitle) title = metaTitle;

  let author = '';
  const authorSelectors = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
    'a[rel="author"]',
    '.byline',
    '.author'
  ];
  for (const sel of authorSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      author = el.getAttribute('content') || el.textContent.trim();
      if (author) break;
    }
  }

  const imgSelectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'img[src]'
  ];
  const images = [];
  for (const sel of imgSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const src = el.getAttribute('content') || el.getAttribute('src');
      if (src && src.startsWith('http')) {
        images.push(src);
        if (images.length >= 3) break;
      }
    }
  }

  let text = '';
  let content = '';
  if (isProbablyReaderable(document)) {
    const article = new Readability(document).parse();
    if (article) {
      title = article.title || title;
      text = article.textContent || '';
      content = article.content || '';
    }
  }
  if (!text) {
    text = document.body?.innerText || '';
    content = html;
  }

  const readingTime = Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 300));

  return { title: title.trim(), author: author.trim(), text, content, images, readingTime };
}
