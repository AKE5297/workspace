import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
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
  return String(html).replace(/<(img|source)([^>]*?)>/gi, (m, tag, attrs) => {
    let newAttrs = attrs;

    const dataSrcMatch = /\sdata-src=["']([^"']+)["']/i.exec(attrs);
    const srcMatch = /\ssrc=["']([^"']*)["']/i.exec(attrs);
    const hasRealSrc = srcMatch && srcMatch[1] && !/^data:/i.test(srcMatch[1]);

    const absolutize = (u) => {
      if (/^(https?:)?\/\//i.test(u) || u.startsWith('data:')) return u;
      try {
        return new URL(u, baseUrl).href;
      } catch (e) {
        return u;
      }
    };

    if (dataSrcMatch) {
      const dsrc = absolutize(dataSrcMatch[1]);
      newAttrs = newAttrs.replace(dataSrcMatch[0], ` data-src="${dsrc}"`);
      if (!hasRealSrc) {
        newAttrs += ` src="${dsrc}"`;
      }
    } else if (srcMatch && !hasRealSrc) {
      const src = absolutize(srcMatch[1]);
      newAttrs = newAttrs.replace(srcMatch[0], ` src="${src}"`);
    }

    if (tag === 'img' && !/referrerpolicy=/i.test(newAttrs)) {
      newAttrs += ' referrerpolicy="no-referrer"';
    }

    return `<${tag}${newAttrs}>`;
  });
}

// 站点专项提取：优先于通用选择器，针对已知平台使用其专属 DOM 结构
const SITE_ADAPTERS = [
  {
    name: 'CSDN',
    match: /blog\.csdn\.net\/.+?\/article\/details/i,
    title: ['h1.title-article'],
    author: ['.name[username]', 'a.follow-nickName', '[class*="nick-name"]'],
    content: ['#article_content', '#content_views'],
    textPath: []
  },
  {
    name: '博客园',
    match: /cnblogs\.com\/.+?\/(p|article|archive)\//i,
    title: ['#cb_post_title_url', 'h1.postTitle', 'h1'],
    author: ['#post-date a', '.postDesc a', '.day .postMeta a'],
    content: ['#cnblogs_post_body'],
    textPath: []
  },
  {
    name: '简书',
    match: /jianshu\.com\/p\//i,
    title: ['h1'],
    author: ['a.author', '.author .name'],
    content: ['article', '.article'],
    textPath: []
  },
  {
    name: '掘金',
    match: /juejin\.cn\/(post|article)\//i,
    title: ['h1.article-title', 'h1'],
    author: ['.author-name'],
    content: ['#article-container', '.article-content', '.markdown-body'],
    textPath: []
  },
  {
    name: 'IT之家',
    match: /ithome\.com/i,
    title: ['h1', '#sing_title'],
    author: ['#author_baidu', '.aName', 'meta[name="author"]'],
    content: ['#paragraph', '.post_content', 'article'],
    textPath: []
  },
  {
    name: '少数派',
    match: /sspai\.com\/post\//i,
    title: ['h1.title', 'h1'],
    author: ['.tag-owner-name', '.author'],
    content: ['div.content', '.article-content'],
    textPath: []
  },
  {
    name: '阮一峰',
    match: /ruanyifeng\.com\/blog/i,
    title: ['h1', '.article-title'],
    author: [],
    content: ['#main-content', 'article'],
    textPath: []
  },
  {
    name: '微信公众号',
    match: /mp\.weixin\.qq\.com/i,
    title: ['#activity-name', '.rich_media_title'],
    author: ['#js_name', '.rich_media_meta_nickname'],
    content: ['#js_content', '.rich_media_content'],
    textPath: []
  },
  {
    name: '语雀',
    match: /yuque\.com\/([^/]+\/[^/]+)\/?$/i,
    title: ['.doc-title', 'h1', 'title'],
    author: ['.doc-info .owner', 'meta[name="author"]'],
    content: ['.ne-doc-content', '.doc-content', '.article-content', '#content', 'main'],
    textPath: []
  },
  {
    name: 'GitHub',
    match: /github\.com\/.+\/(blob|issues|discussions|pull)\//i,
    title: ['h1', '.gh-header-title', '.js-issue-title', '[class*="markdown-title"]'],
    author: ['a.author', '.author', '[class*="author"]', 'meta[name="author"]'],
    content: [
      '.markdown-body',
      '[data-testid="readme"]',
      '.comment-body',
      'article',
      '#readme article',
      'main'
    ],
    textPath: []
  },
  {
    name: 'Medium',
    match: /medium\.com\//i,
    title: ['h1'],
    author: ['a[rel="author"]', '.pw-author-name', '[data-testid="authorName"]'],
    content: ['article section', 'article', '.postArticle-content'],
    textPath: []
  },
  {
    name: 'InfoQ',
    match: /infoq\.cn\/(article|news)\//i,
    title: ['h1.article-title', 'h1.title', 'h1'],
    author: ['.article-info .author a', '.byline .author', '[rel="author"]', '.author-name'],
    content: ['#articleContent', '.article-content', '.text', 'article'],
    textPath: []
  },
  {
    name: 'SegmentFault 思否',
    match: /segmentfault\.com\/a\//i,
    title: ['h1.article-title', 'h1'],
    author: ['a.article__author', '.author-name', '.profile-name', 'meta[name="author"]'],
    content: ['.article-content', '#articleContent', '.fmt', 'article'],
    textPath: []
  },
  {
    name: '小红书',
    match: /xiaohongshu\.com\/(explore|discovery\/item)\//i,
    title: ['#detail-title', 'h1', '.title', '[class*="title"]'],
    author: ['#user-name', '.author-wrapper .name', '.user-info .name', 'meta[name="author"]'],
    content: ['#detail-desc', '.note-content', '[class*="note-content"]', '#detail-container .content'],
    textPath: []
  },
  {
    name: '什么值得买',
    match: /smzdm\.com\/(p|article)\//i,
    title: ['.article-title', '.article_title', 'h1'],
    author: ['.article-author .name', '.article-author-name', '.author-name', '.name', 'meta[name="author"]'],
    content: ['.article-detail-bd', '.txt-detail', '#articleId', '.m-article', '.article-content', '.detail-content'],
    textPath: []
  },
  {
    name: '飞书文档',
    match: /(feishu\.cn|feishu\.com|feishu\.net|larksuite\.com)\/(docx|doc|wiki|docs)\//i,
    title: ['[class*="docx-title"]', 'h1.title', '.doc-title', 'h1'],
    author: ['meta[name="author"]', '[class*="author"]', '.docx-owner'],
    content: [
      '[class*="render-unit-container"]',
      '[class*="document-container"]',
      '.docx-content',
      '.doc-content',
      '#app',
      'article'
    ],
    textPath: []
  }
];

function matchAdapter(url) {
  for (const a of SITE_ADAPTERS) {
    if (a.match.test(url)) return a;
  }
  return null;
}

function pickText(document, selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return '';
}

function pickElement(document, selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function cleanAuthor(raw) {
  let a = String(raw || '').trim();
  a = a.replace(/^作者[:：]\s*/i, '').replace(/^posted\s*@\s*/i, '').replace(/^编辑[:：]\s*/i, '');
  return a.trim();
}

// 清理标题尾部站点/栏目后缀（服务端 URL 抓取时与扩展保持一致）
const SITE_TITLE_SUFFIXES =
  /[-_|·—–－\s]*(知乎专栏|知乎|简书|掘金|CSDN博客|博客园|微信公众号|微信公众号文章|微信公众平台|IT之家|少数派|语雀|GitHub|Medium|InfoQ|SegmentFault思否|思否|小红书|小红书笔记|什么值得买|SMZDM|博客|Blog|稀土掘金|CSDN|overreacted)$/i;

// 动态探测站点品牌名（og:site_name / application-name / header 品牌容器短文本）
function detectSiteName(document) {
  if (!document) return '';
  try {
    for (const sel of ['meta[property="og:site_name"]', 'meta[name="application-name"]']) {
      const el = document.querySelector(sel);
      const v = el?.getAttribute('content');
      if (v && v.trim().length >= 2 && v.trim().length <= 30) return v.trim();
    }
    const brandSels = [
      '[class*="site-name"]',
      '[class*="siteName"]',
      '[class*="blog-title"]',
      '[class*="blogTitle"]',
      '[class*="brand"]',
      '.navbar-brand',
      'header .logo',
      '.logo a',
      '.site-title a'
    ];
    for (const sel of brandSels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length >= 2 && t.length <= 30 && !/home|首页|主页|返回/i.test(t)) return t;
    }
  } catch (e) {
    /* ignore */
  }
  return '';
}

function cleanTitleSuffix(raw, document) {
  let t = String(raw || '').trim();
  const prev = t.replace(SITE_TITLE_SUFFIXES, '').trim();
  if (prev) t = prev;
  const siteName = document ? detectSiteName(document) : '';
  if (siteName) {
    const re = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp('\\s*[-_|·—–:：]\\s*' + re + '\\s*$', 'i'), '');
    t = t.replace(new RegExp('^\\s*' + re + '\\s*[-_|·—–:：]\\s*', 'i'), '');
  }
  return t.replace(/[-_|·—–－\s]+$/i, '').trim();
}

function extractSiteMeta(adapter, document, fallback) {
  const meta = { title: '', author: '', text: '', content: '' };
  if (adapter.title.length) meta.title = pickText(document, adapter.title);
  if (adapter.author.length) {
    const el = pickElement(document, adapter.author);
    if (el) {
      const text = el.textContent?.trim();
      const byAttr = el.getAttribute('content') || el.getAttribute('data-name');
      meta.author = cleanAuthor((text && text.length <= 30 ? text : '') || byAttr || el.getAttribute('username') || '');
    }
  }
  const contentEl = pickElement(document, adapter.content);
  if (contentEl) {
    meta.content = contentEl.innerHTML || '';
    meta.text = contentEl.textContent || '';
  }
  if (!meta.title) meta.title = fallback.title;
  if (!meta.author && adapter.author.length) meta.author = fallback.author;
  return meta;
}

// 从 URL 提取用户名作为站点专项兜底（如博客园 cnblogs.com/cmt/p/xxx、简书 jianshu.com/p/xxx）
function extractAuthorFromUrl(url, adapterName) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (adapterName === '博客园' && parts[0] && !['p', 'article', 'archive'].includes(parts[0])) {
      return parts[0];
    }
    if (adapterName === '简书' && parts[0] === 'p') return '';
  } catch (e) {
    /* ignore */
  }
  return '';
}

const WAF_PATTERNS = [
  { re: /zse-ck|_zap|zst\d/i, name: '知乎反爬验证' },
  { re: /waf_js|wafchallenge|_wafchallengeid/i, name: '字节跳动 WAF 验证' },
  { re: /TCaptcha|WafCaptcha|captcha\.qq\.com/i, name: '腾讯云验证码' },
  { re: /probe\.js\?v=/i, name: '腾讯安全验证' },
  { re: /secs\.hwcdn|hwcdn/i, name: '网宿 WAF' }
];

function detectWaf(html, status) {
  if (!html) return null;
  if (status === 403 || status === 202) {
    for (const p of WAF_PATTERNS) {
      if (p.re.test(html)) return p.name;
    }
  }
  if (html.includes('__captcha') || html.includes('安全验证') || html.includes('滑动验证')) {
    return '站点安全验证';
  }
  return null;
}

const SPA_JSON_SELECTORS = [
  {
    sel: 'script#__NEXT_DATA__',
    key: 'props.pageProps',
    textPath: ['articleBody', 'content', 'body']
  },
  {
    sel: 'script#__NUXT_DATA__',
    isNuxt: true
  },
  {
    sel: 'script#js-initialData',
    key: 'initialState',
    textPath: []
  },
  {
    sel: 'script[data-name="content"]'
  }
];

function tryExtractSpaJson(document) {
  for (const { sel, key, isNuxt } of SPA_JSON_SELECTORS) {
    const el = document.querySelector(sel);
    if (!el || !el.textContent) continue;
    try {
      const data = JSON.parse(el.textContent);
      let payload = data;
      if (key && data) {
        for (const k of key.split('.')) payload = payload?.[k];
      }
      const text = JSON.stringify(payload || data);
      if (text.length > 200) {
        return {
          title: data?.title || document.title || '',
          text
        };
      }
    } catch (e) {
      /* 非 JSON 则跳过 */
    }
  }
  return null;
}

// 解析 JSON-LD Article/BlogPosting/NewsArticle 结构（自建博客 WordPress 等 SEO 插件多输出此类），
// 支持 @graph / @type 数组递归定位，提取 title/author/正文
const JSONLD_ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report', 'WebPage'];

function isArticleType(t) {
  if (typeof t === 'string') return JSONLD_ARTICLE_TYPES.includes(t);
  if (Array.isArray(t)) return t.some((x) => JSONLD_ARTICLE_TYPES.includes(x));
  return false;
}

function walkForArticle(node, found) {
  if (!node || found) return found;
  if (typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = walkForArticle(item, found);
      if (r) return r;
    }
    return found;
  }
  if (isArticleType(node['@type'])) {
    const text = extractArticleText(node);
    if (text) return node;
  }
  // 深入 @graph / mainEntity / itemListElement 等常见容器
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'hasPart']) {
    if (node[key]) {
      const r = walkForArticle(node[key], found);
      if (r) return r;
    }
  }
  return found;
}

function extractArticleText(article) {
  return (
    article.articleBody ||
    (Array.isArray(article.articleSection) ? article.articleSection.join(' ') : article.articleSection) ||
    (typeof article.text === 'string' && article.text.length > 100 ? article.text : '') ||
    (article.description && article.description.length > 100 ? article.description : '')
  );
}

function tryExtractJsonLd(document) {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent);
      const article = walkForArticle(data, null);
      if (!article) continue;
      const text = extractArticleText(article);
      if (!text) continue;
      const title = article.headline || article.name || '';
      const author = article.author
        ? (typeof article.author === 'string'
            ? article.author
            : Array.isArray(article.author)
              ? (article.author[0]?.name || '')
              : article.author.name || '')
        : '';
      const date = article.datePublished || article.dateModified || '';
      return { title, author, text, date };
    } catch (e) {
      /* 非 JSON 则跳过 */
    }
  }
  return null;
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
    validateStatus: (s) => s < 400 || s === 403 || s === 202 || s === 429
  });

  const contentType = resp.headers['content-type'] || '';
  const charset = detectCharset(contentType, Buffer.from(resp.data));
  const html = decodeBuffer(Buffer.from(resp.data), charset);
  const finalUrl = resp.request?.res?.responseUrl || url;

  const waf = detectWaf(html, resp.status);
  if (waf) {
    throw new Error(`${waf}拦截，请在浏览器中打开后使用扩展剪藏`);
  }

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
      author = cleanAuthor(el.getAttribute('content') || el.textContent.trim());
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

  const adapter = matchAdapter(finalUrl);
  if (adapter) {
    const sm = extractSiteMeta(adapter, document, { title, author });
    if (sm.title) title = sm.title;
    if (adapter.author.length) {
      if (sm.author) author = sm.author;
    } else {
      author = '';
    }
    text = sm.text;
    content = sm.content;
    if (!author) {
      const urlAuthor = extractAuthorFromUrl(finalUrl, adapter.name);
      if (urlAuthor) author = urlAuthor;
    }
  }

  // 结构化正文提取（自建博客/常规站无 adapter 时）：直接尝试 Readability，
  // 不再依赖 isProbablyReaderable 的前置判定（该判定对部分博客主题过严）
  const jsonld = tryExtractJsonLd(document);
  if (jsonld) {
    if (!title) title = jsonld.title;
    if (!author && jsonld.author) author = jsonld.author;
  }
  if (!text) {
    let readabilityContent = '';
    let readabilityText = '';
    try {
      const article = new Readability(document).parse();
      if (article) {
        readabilityText = (article.textContent || '').trim();
        readabilityContent = (article.content || '').trim();
      }
    } catch (e) {
      /* Readability 失败时回退 */
    }
    // 正文过短视为误提取，丢弃结构交由后续兜底
    const ok = readabilityText.length >= 120;
    if (ok) {
      title = (jsonld && jsonld.title) || title;
      text = readabilityText;
      content = readabilityContent;
    } else if (jsonld && jsonld.text) {
      // 无干净 DOM 结构但有 JSON-LD 正文：text 用结构化正文，content 用整页供前端编辑
      title = jsonld.title || title;
      text = jsonld.text;
      content = html;
    }
  }
  if (!text) {
    const spa = tryExtractSpaJson(document);
    if (spa) {
      title = spa.title || title;
      text = spa.text;
      content = html;
    }
  }
  if (!text) {
    text = document.body?.textContent || '';
    content = html;
  }

  content = absolutizeImages(content, finalUrl);

  if (images.length < 3) {
    const imgs = [...document.querySelectorAll('img[src], img[data-src]')]
      .map((img) => img.getAttribute('src') || img.getAttribute('data-src'))
      .filter(
        (s) =>
          /^https?:\/\//i.test(s) &&
          !/logo|icon|avatar|emoji|equation|spacer|blank|pixel|transparent|loading|data:image/i.test(s)
      )
      .slice(0, 3 - images.length);
    images.push(...imgs);
  }

  const readingTime = Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 300));

  return {
    url: finalUrl,
    title: cleanTitleSuffix(title, document) || document.title || '',
    author: author.trim(),
    text: text.trim(),
    content,
    images: [...new Set(images)],
    readingTime
  };
}
