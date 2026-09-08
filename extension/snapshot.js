// 共享页面快照引擎：popup 与 background 均通过 <script>/importScripts 加载。
// CAPTURE_FN 会被 chrome.scripting.executeScript 序列化注入到目标页面执行，
// 因此函数体必须完全自包含（不能引用外层作用域变量），站点规则以参数传入。

(function init(global) {
  // 站点专项规则（自上而下匹配，通用兜底放最后）
  // host/titleClean 均为正则源字符串，会在注入页面内构造 RegExp（args 无法传输 RegExp 对象）
  // author:    作者选择器（含 meta）
  // content:   正文容器选择器（按序取第一个文本>100 的）
  const SITE_RULES = [
    {
      name: '小红书',
      host: '(^|\\.)xiaohongshu\\.com',
      titleClean: '[-_|·\\s]*(小红书|小红书笔记|xiaohongshu|rednote|发现更多笔记)$',
      author: [
        '#user-name',
        '.author-wrapper .name',
        '.user-info .name',
        '.author .name',
        '[class*="author"] [class*="name"]',
        'meta[name="author"]',
        'meta[property="article:author"]'
      ],
      content: [
        '#detail-desc',
        '.note-content',
        '[class*="note-content"]',
        '#detail-container .content',
        '[class*="detail-desc"]',
        '[class*="note-container"]'
      ]
    },
    {
      name: '什么值得买',
      host: 'smzdm\\.com',
      titleClean: '[-_|·\\s]*(什么值得买|SMZDM|原创|消费众测)$',
      author: [
        '.article-author .name',
        '.article-author-name',
        '.author-name',
        '.name',
        'meta[name="author"]',
        'meta[property="article:author"]'
      ],
      content: [
        '.article-detail-bd',
        '.txt-detail',
        '#articleId',
        '.m-article',
        '.article-content',
        '.detail-content',
        '[class*="article-detail"]'
      ]
    },
    {
      name: '微信公众号',
      host: 'mp\\.weixin\\.qq\\.com',
      titleClean: '[-_|·\\s]*(微信公众平台|微信公众号|微信公众号文章)$',
      author: ['#js_name', '.rich_media_meta_nickname', '.account_nickname_inner', 'meta[name="author"]'],
      content: ['#js_content', '.rich_media_content', '#js_article']
    },
    {
      name: '知乎专栏',
      host: 'zhuanlan\\.zhihu\\.com',
      titleClean: '[-_|·\\s]*(知乎专栏|知乎)$',
      author: ['.AuthorInfo-name', 'meta[name="author"]', '[class*="author-info"] .name'],
      content: ['.Post-RichTextContainer', '.RichText', 'article']
    },
    {
      name: '知乎',
      host: 'www\\.zhihu\\.com\\/question',
      titleClean: '[-_|·\\s]*知乎$',
      author: ['meta[name="author"]', '.AuthorInfo-name', '[class*="author-info"] .name'],
      content: ['.RichContent-inner', '.RichText', '.Post-RichTextContainer']
    },
    {
      name: 'CSDN',
      host: 'blog\\.csdn\\.net',
      titleClean: '[-_|·\\s]*CSDN博客$',
      author: ['.name[username]', 'a.follow-nickName', '[class*="nick-name"]'],
      content: ['#article_content', '#content_views', '.markdown-body']
    },
    {
      name: '博客园',
      host: 'cnblogs\\.com',
      titleClean: '[-_|·\\s]*博客园$',
      author: ['#post-date a', '.postDesc a', '.day .postMeta a'],
      content: ['#cnblogs_post_body', 'article']
    },
    {
      name: '简书',
      host: 'jianshu\\.com',
      titleClean: '[-_|·\\s]*简书$',
      author: ['a.author', '.author .name'],
      content: ['article', '.article', '.post-content']
    },
    {
      name: '掘金',
      host: 'juejin\\.cn',
      titleClean: '[-_|·\\s]*掘金$',
      author: ['.author-name'],
      content: ['#article-container', '.article-content', '.markdown-body']
    },
    {
      name: 'IT之家',
      host: 'ithome\\.com',
      titleClean: '[-_|·\\s]*IT之家$',
      author: ['#author_baidu', '.aName', 'meta[name="author"]'],
      content: ['#paragraph', '.post_content', 'article']
    },
    {
      name: '少数派',
      host: 'sspai\\.com\\/post',
      titleClean: '[-_|·\\s]*少数派$',
      author: ['.tag-owner-name', '.author'],
      content: ['div.content', '.article-content']
    },
    {
      name: '阮一峰',
      host: 'ruanyifeng\\.com\\/blog',
      titleClean: '[-_|·\\s]*(阮一峰的网络日志|网络日志)$',
      author: [],
      content: ['#main-content', 'article']
    },
    {
      name: '语雀',
      host: 'yuque\\.com',
      titleClean: '[-_|·\\s]*语雀$',
      author: ['meta[name="author"]', '.doc-info .owner', '.owner'],
      content: ['.ne-doc-content', '.doc-content', '.article-content', '#content']
    },
    {
      name: 'GitHub',
      host: 'github\\.com',
      titleClean: '[-_|·\\s]*GitHub$',
      author: ['a.author', '.author', 'meta[name="author"]'],
      content: ['.markdown-body', '[data-testid="readme"]', '.comment-body', 'article']
    },
    {
      name: 'Medium',
      host: 'medium\\.com',
      titleClean: '[-_|·\\s]*Medium$',
      author: ['a[rel="author"]', '.pw-author-name', '[data-testid="authorName"]'],
      content: ['article section', 'article', '.postArticle-content']
    },
    {
      name: 'InfoQ',
      host: 'infoq\\.cn',
      titleClean: '[-_|·\\s]*InfoQ$',
      author: ['.article-info .author a', '.byline .author', '[rel="author"]'],
      content: ['#articleContent', '.article-content', '.text']
    },
    {
      name: 'SegmentFault',
      host: 'segmentfault\\.com',
      titleClean: '[-_|·\\s]*(SegmentFault|思否)$',
      author: ['a.article__author', '.author-name', 'meta[name="author"]'],
      content: ['.article-content', '#articleContent', '.fmt']
    },
    {
      name: '飞书文档',
      host: '(feishu\\.cn|feishu\\.com|feishu\\.net|larksuite\\.com)\\/(docx|doc|wiki|docs)',
      titleClean: '[-_|·\\s]*(飞书|飞书文档|larksuite)$',
      author: ['meta[name="author"]', '[class*="author"]', '.docx-owner'],
      content: [
        '[class*="render-unit-container"]',
        '[class*="document-container"]',
        '.docx-content',
        '.doc-content',
        'article'
      ]
    },
    {
      name: '通用博客',
      host: '.',
      titleClean: '[-_|·\\s]*(博客|Blog|blog)$',
      author: [
        'meta[name="author"]',
        'meta[property="article:author"]',
        '[rel="author"]',
        '.author',
        '[class*="author-name"]',
        '[class*="authorInfo"] [class*="name"]',
        '.byline a',
        '.post-meta a'
      ],
      content: [
        'article .entry-content',
        'article .post-content',
        'article .post-body',
        'article .markdown-body',
        'article .article-content',
        'article .content',
        '.entry-content',
        '.post-content',
        '.post-body',
        '.markdown-body',
        '.article-content',
        '.article_content',
        '.content-wrap',
        '[class*="article"]',
        '[class*="post-content"]',
        '[class*="RichText"]',
        '.Post-RichTextContainer',
        '.rich_media_content',
        '#js_content',
        'article'
      ]
    }
  ];

  // 页面内自包含抓取函数（会被 executeScript 序列化注入，禁止引用外层变量）
  async function CAPTURE_FN(rules, mode) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ruleOf = (url) => {
      for (const r of rules) {
        try {
          if (new RegExp(r.host, 'i').test(url)) return r;
        } catch (e) {}
      }
      return rules[rules.length - 1];
    };
    // 探测站点品牌名：优先 meta，其次 header/品牌容器短文本
    const detectSiteName = () => {
      try {
        for (const sel of ['meta[property="og:site_name"]', 'meta[name="application-name"]']) {
          const el = document.querySelector(sel);
          const v = el && el.getAttribute('content');
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
          let el = null;
          try {
            el = document.querySelector(sel);
          } catch (e) {
            continue;
          }
          if (!el) continue;
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (t && t.length >= 2 && t.length <= 30 && !/home|首页|主页|返回/i.test(t)) return t;
        }
      } catch (e) {}
      return '';
    };
    const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanTitleOf = (rule, raw) => {
      let t = String(raw || '').trim();
      if (rule.titleClean) {
        try {
          t = t.replace(new RegExp(rule.titleClean, 'i'), '');
        } catch (e) {}
      }
      const siteName = detectSiteName();
      if (siteName) {
        const re = escapeRe(siteName);
        try {
          // 尾部："文章标题 - 站点名" / "文章标题 — 站点名"
          t = t.replace(new RegExp('\\s*[-_|·—–:：]\\s*' + re + '\\s*$', 'i'), '');
          // 头部："站点名 - 文章标题"
          t = t.replace(new RegExp('^\\s*' + re + '\\s*[-_|·—–:：]\\s*', 'i'), '');
        } catch (e) {}
      }
      t = t.replace(/\s*[-_|·—–]\s*$/i, '').trim();
      return t;
    };

    // 触发图片懒加载：把 data-src/data-original/data-actualsrc 等补齐为 src
    const eagerLazyImages = () => {
      document.querySelectorAll('img[data-src],img[data-original],img[data-actualsrc],img[data-echo],img[loading="lazy"]').forEach((img) => {
        const u =
          img.getAttribute('data-src') ||
          img.getAttribute('data-original') ||
          img.getAttribute('data-actualsrc') ||
          img.getAttribute('data-echo');
        if (u && !img.getAttribute('src')) img.setAttribute('src', u);
        if (img.loading === 'lazy') {
          try {
            img.loading = 'eager';
          } catch (e) {}
        }
      });
    };

    // 尝试展开"阅读全文/展开"按钮，避免折叠正文
    const tryExpandFolded = () => {
      const hints = /阅读全文|查看全文|展开全文|展开|查看更多|点击展开|全文/i;
      document.querySelectorAll('button,span,a,div[role="button"]').forEach((el) => {
        const t = (el.textContent || '').trim();
        if (t && t.length < 12 && hints.test(t)) {
          try {
            el.click();
          } catch (e) {}
        }
      });
    };

    // 找内容区可滚动容器（正文懒加载常见于内部容器而非 window）
    const findScrollable = () => {
      const list = [];
      const all = document.querySelectorAll('main,article,.content,[class*="article"],[class*="post"],[class*="container"]');
      for (const el of all) {
        if (el.scrollHeight > el.clientHeight + 200) list.push(el);
      }
      list.sort((a, b) => b.scrollHeight - a.scrollHeight);
      return list.slice(0, 3);
    };

    // 自动滚动到底触发懒加载全文（mode 非 'fast' 时执行）
    const scrollToLoadFull = async () => {
      const scrolling = document.scrollingElement || document.documentElement;
      const initial = scrolling.scrollHeight;
      let lastH = initial;
      let stable = 0;
      for (let i = 0; i < 18; i++) {
        eagerLazyImages();
        tryExpandFolded();
        window.scrollTo(0, scrolling.scrollHeight);
        const boxes = findScrollable();
        for (const b of boxes) b.scrollTop = b.scrollHeight;
        await sleep(650);
        const h = Math.max(scrolling.scrollHeight, document.body ? document.body.scrollHeight : 0);
        if (h <= lastH + 30) {
          stable += 1;
          if (stable >= 2) break;
        } else {
          stable = 0;
          lastH = h;
        }
      }
      // 最后一轮等待图片自然解码
      await sleep(800);
      eagerLazyImages();
      window.scrollTo(0, 0);
    };

    const absolutize = (u) => {
      if (!u) return '';
      if (/^(https?:)?\/\//i.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return u;
      try {
        return new URL(u, location.href).href;
      } catch (e) {
        return u;
      }
    };

    const realSrcOf = (img) => {
      const src =
        img.currentSrc ||
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-actualsrc') ||
        img.getAttribute('data-echo');
      return absolutize(src);
    };

    // 正文容器图片重写：补全懒加载 src、绝对化、no-referrer
    const rewriteImages = (html) =>
      String(html).replace(/<(img|source)([^>]*?)>/gi, (m, tag, attrs) => {
        let na = attrs;
        const ds = /\sdata-(src|original|actualsrc|echo)=["']([^"']+)["']/i.exec(attrs);
        const src = /\ssrc=["']([^"']*)["']/i.exec(attrs);
        if (ds && (!src || !src[1])) {
          na = na.replace(ds[0], ` data-src="${ds[2]}" src="${absolutize(ds[2])}"`);
        }
        if (tag === 'img') {
          const rs = /\ssrc=["']([^"']*)["']/i.exec(na);
          if (rs && rs[1]) na = na.replace(rs[0], ` src="${absolutize(rs[1])}"`);
          if (!/referrerpolicy=/i.test(na)) na += ' referrerpolicy="no-referrer"';
        }
        return `<${tag}${na}>`;
      });

    const pick = (selectors) => {
      for (const s of selectors) {
        let el = null;
        try {
          el = document.querySelector(s);
        } catch (e) {
          continue;
        }
        if (el && (el.textContent || '').trim().length > 100) return el;
      }
      return null;
    };

    const url = location.href;
    const rule = ruleOf(url);

    if (mode !== 'fast') await scrollToLoadFull();

    const doc = document;
    const title = cleanTitleOf(rule, doc.title || '');

    let author = '';
    for (const sel of rule.author || []) {
      let el = null;
      try {
        el = doc.querySelector(sel);
      } catch (e) {
        continue;
      }
      if (!el) continue;
      const name = (el.getAttribute && (el.getAttribute('content') || el.getAttribute('username') || el.getAttribute('data-name'))) || (el.textContent || '').trim();
      const clean = String(name || '')
        .replace(/^(作者[:：]\s*|posted\s*by\s*|编辑[:：]\s*)/i, '')
        .trim();
      if (clean && clean.length > 0 && clean.length < 40) {
        author = clean;
        break;
      }
    }

    let contentEl = pick(rule.content || []);
    let content = '';
    let articleText = '';
    if (contentEl) {
      content = rewriteImages(contentEl.innerHTML);
      articleText = (contentEl.innerText || '').trim();
    } else {
      // 兜底：无法精确定位正文容器时退回整页（"先整篇取回再转化"）
      const body = doc.body;
      if (body) {
        content = rewriteImages(body.innerHTML);
        articleText = (body.innerText || '').trim();
      }
    }

    const isPlaceholderImg = (img) => {
      const aW = parseInt(img.getAttribute('width') || '', 10);
      const aH = parseInt(img.getAttribute('height') || '', 10);
      if ((aW > 0 || aH > 0) && aW < 60 && aH < 60) return true; // 显式小尺寸占位图
      if (img.naturalWidth > 0 && img.naturalWidth < 60 && img.naturalHeight < 60) return true; // 已解码小图
      const src = realSrcOf(img) || '';
      return /spacer|blank|pixel|1x1|transparent|dot_pixel|\.loading\.|loader\.|placeholder/i.test(src) ||
        /\/?(spacer|blank|pixel|px|dot|transparent)(\.|\/|$)/i.test(src);
    };

    const images = [];
    doc.querySelectorAll('img[src], img[data-src], img[data-original], img[data-actualsrc], img[data-echo]').forEach((img) => {
      const src = realSrcOf(img);
      if (
        src &&
        /^https?:/i.test(src) &&
        !/logo|icon|avatar|emoji|equation|placeholder|loading|data:image\/svg/i.test(src) &&
        !isPlaceholderImg(img) &&
        images.length < 25
      ) {
        images.push(src);
      }
    });

    const allText = (contentEl ? contentEl.innerText || '' : doc.body ? doc.body.innerText || '' : '').trim();
    return {
      title: title || '未命名剪藏',
      url: url,
      author: author,
      content: content,
      text: articleText || allText,
      articleText: articleText || allText,
      images: [...new Set(images)],
      fullText: allText
    };
  }

  global.__CLIPPER_SNAPSHOT__ = {
    SITE_RULES: SITE_RULES,
    CAPTURE_FN: CAPTURE_FN
  };
})(typeof self !== 'undefined' ? self : this);
