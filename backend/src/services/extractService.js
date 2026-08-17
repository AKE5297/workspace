import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability, isProbablyReaderable } from '@mozilla/readability';
import iconv from 'iconv-lite';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function detectCharset(contentType, htmlBuffer) {
  const m = /charset=([\w-]+)/i.exec(contentType || '');
  if (m) return m[1].toLowerCase();
  const head = htmlBuffer.toString('latin1').slice(0, 4096);
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  if (meta) return meta[1].toLowerCase();
  return 'utf-8';
}

function decodeBuffer(buffer, charset) {
  const c = (charset || 'utf-8').toLowerCase();
  if (c === 'utf-8' || c === 'utf8') return buffer.toString('utf-8');
  if (iconv.encodingExists(c)) {
    const decoded = iconv.decode(buffer, c);
    if (!decoded.includes('\uFFFD')) return decoded;
  }
  return buffer.toString('utf-8');
}

function absolutizeImages(html, baseUrl) {
  return String(html).replace(/<(img|source)[^>]+src=["']([^"']+)["']/gi, (m, tag, src) => {
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return m;
    try {
      const abs = new URL(src, baseUrl).href;
      return m.replace(src, abs);
    } catch (e) {
      return m;
    }
  });
}

function isWeixin(url) {
  return /mp\.weixin\.qq\.com/i.test(url);
}

// 微信公众号文章正文在 #js_content 中，Readability 提取效果不稳定，做专项处理
function extractWeixin(document) {
  const titleEl = document.querySelector('#activity-name')
    || document.querySelector('.rich_media_title')
    || document.querySelector('h1');
  const title = titleEl?.textContent?.trim() || '';

  const authorEl = document.querySelector('#js_name')
    || document.querySelector('.rich_media_meta_nickname')
    || document.querySelector('meta[name="author"]');
  const author = authorEl?.getAttribute('content') || authorEl?.textContent?.trim() || '';

  const contentEl = document.querySelector('#js_content')
    || document.querySelector('.rich_media_content');
  let content = '';
  let text = '';
  if (contentEl) {
    content = contentEl.innerHTML || '';
    text = contentEl.textContent || '';
  }
  return { title, author, text, content };
}

export async function extractFromUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('仅支持 http/https 链接');
  }

  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },
    validateStatus: (s) => s < 400
  });

  const contentType = resp.headers['content-type'] || '';
  const charset = detectCharset(contentType, Buffer.from(resp.data));
  const html = decodeBuffer(Buffer.from(resp.data), charset);
  const finalUrl = resp.request?.res?.responseUrl || url;

  const dom = new JSDOM(html, { url: finalUrl });
  const document = dom.window.document;

  let title = document.title || '';
  const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
    || document.querySelector('h1')?.textContent?.trim();
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

  const images = [];
  const imgSelectors = ['meta[property="og:image"]', 'meta[name="twitter:image"]'];
  for (const sel of imgSelectors) {
    const el = document.querySelector(sel);
    const src = el?.getAttribute('content');
    if (src) {
      images.push(src);
      if (images.length >= 3) break;
    }
  }

  let text = '';
  let content = '';
  if (isWeixin(finalUrl)) {
    const wx = extractWeixin(document);
    if (wx.title) title = wx.title;
    if (wx.author) author = wx.author;
    text = wx.text;
    content = wx.content;
  }
  if (!text) {
    try {
      if (isProbablyReaderable(document)) {
        const article = new Readability(document).parse();
        if (article && article.textContent) {
          title = article.title || title;
          text = article.textContent || '';
          content = article.content || '';
        }
      }
    } catch (e) {
      /* Readability 失败时回退 */
    }
  }
  if (!text) {
    text = document.body?.textContent || '';
    content = html;
  }

  content = absolutizeImages(content, finalUrl);

  if (images.length < 3) {
    const imgs = [...document.querySelectorAll('img[src]')]
      .map((img) => img.getAttribute('src'))
      .filter((s) => /^https?:\/\//i.test(s) && !/logo|icon|avatar/i.test(s))
      .slice(0, 3 - images.length);
    images.push(...imgs);
  }

  const readingTime = Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 300));

  return {
    url: finalUrl,
    title: title.trim(),
    author: author.trim(),
    text: text.trim(),
    content,
    images: [...new Set(images)],
    readingTime
  };
}
