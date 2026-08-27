const DEFAULT_SERVER = 'https://5173-9b655859f5bdf233.monkeycode-ai.online';

chrome.runtime.onInstalled.addListener(() => {
  createMenus();
});

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'clip-selection',
      title: '保存选区到 Web Clipper',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'clip-page',
      title: '保存整页到 Web Clipper',
      contexts: ['page']
    });
  });
}

async function getConfig() {
  const data = await chrome.storage.local.get(['server', 'token']);
  return { server: data.server || DEFAULT_SERVER, token: data.token || '' };
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clip-selection') {
    saveSelection(info, tab);
  } else if (info.menuItemId === 'clip-page') {
    savePage(tab);
  }
});

async function saveSelection(info, tab) {
  const { server, token } = await getConfig();
  if (!token) return notify('未配置 Token，请先打开扩展设置', true);
  let pageTitle = '';
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.title || ''
    });
    pageTitle = res?.[0]?.result || '';
  } catch (e) {}
  const cleanTitle = (raw) =>
    (raw || '')
      .replace(/\s*[-_|]\s*(知乎专栏|知乎|简书|掘金|CSDN博客|博客园|微信公众号|IT之家|少数派)$/i, '')
      .trim();
  const payload = {
    title: cleanTitle(pageTitle) || `选区摘录`,
    url: info.pageUrl || tab?.url || '',
    text: info.selectionText || '',
    content: '',
    images: []
  };
  try {
    const res = await fetch(`${server}/api/clips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || '保存失败');
    }
    notify('选区已保存到 Web Clipper');
  } catch (e) {
    notify('保存失败：' + e.message, true);
  }
}

async function savePage(tab) {
  const { server, token } = await getConfig();
  if (!token) return notify('未配置 Token，请先打开扩展设置', true);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const AUTHOR_SELECTORS = [
          [/(zhuanlan\.zhihu\.com|www\.zhihu\.com)/, ['.AuthorInfo-name', 'meta[name="author"]', '[class*="author-info"] .name']],
          [/blog\.csdn\.net/, ['.name[username]', 'a.follow-nickName', '[class*="nick-name"]']],
          [/cnblogs\.com/, ['#post-date a', '.postDesc a', '.day .postMeta a']],
          [/jianshu\.com/, ['a.author', '.author .name']],
          [/juejin\.cn/, ['.author-name']],
          [/ithome\.com/, ['#author_baidu', '.aName', 'meta[name="author"]']],
          [/sspai\.com/, ['.tag-owner-name', '.author']],
          [/mp\.weixin\.qq\.com/, ['#js_name', '.rich_media_meta_nickname']],
          [/^https?:\/\/[^/]+\//, ['meta[name="author"]', '[rel="author"]', '.author', '[class*="author"]', '.byline a', '.post-meta a']]
        ];
        const cleanTitle = (raw) =>
          (raw || '')
            .replace(/\s*[-_|]\s*(知乎专栏|知乎|简书|掘金|CSDN博客|博客园|微信公众号|IT之家|少数派)$/i, '')
            .trim();
        const extractAuthor = () => {
          const url = location.href;
          let selectors = AUTHOR_SELECTORS[AUTHOR_SELECTORS.length - 1][1];
          for (const [re, sels] of AUTHOR_SELECTORS) {
            if (re.test(url)) {
              selectors = sels;
              break;
            }
          }
          for (const s of selectors) {
            let el = null;
            try {
              el = document.querySelector(s);
            } catch (e) {
              continue;
            }
            if (el) {
              const name = el.textContent.trim();
              if (name && name.length > 0 && name.length < 30) {
                return name.replace(/^(作者[:：]\s*|posted\s+by\s+)/i, '').trim();
              }
            }
          }
          return '';
        };

        const doc = document;
        const text = doc.body?.innerText || '';
        const title = cleanTitle(doc.title || '');
        const url = location.href;
        const author = extractAuthor();
        const pick = (selectors) => {
          for (const s of selectors) {
            const el = doc.querySelector(s);
            if (el && el.textContent.trim().length > 100) return el;
          }
          return null;
        };
        const articleEl = pick([
          'article',
          '[class*="article-content"]',
          '[class*="article_content"]',
          '[class*="post-content"]',
          '[class*="RichText"]',
          '.Post-RichTextContainer',
          '.rich_media_content',
          '#js_content',
          '[class*="content"]'
        ]);
        let content = '';
        let articleText = '';
        if (articleEl) {
          content = articleEl.innerHTML || '';
          articleText = articleEl.innerText || '';
          content = content.replace(/<(img|source)([^>]*?)>/gi, (m, tag, attrs) => {
            let na = attrs;
            const dsrc = /\sdata-(src|actualsrc|original)=["']([^"']+)["']/i.exec(attrs);
            const src = /\ssrc=["']([^"']*)["']/i.exec(attrs);
            if (dsrc && (!src || !src[1])) {
              na = na.replace(dsrc[0], ` data-src="${dsrc[2]}" src="${dsrc[2]}"`);
            }
            if (tag === 'img' && !/referrerpolicy=/i.test(na)) {
              na += ' referrerpolicy="no-referrer"';
            }
            return `<${tag}${na}>`;
          });
        }
        const images = [];
        doc.querySelectorAll('img[src], img[data-src], img[data-actualsrc], img[data-original]').forEach((img) => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-actualsrc') || img.getAttribute('data-original');
          if (src && /^https?:\/\//i.test(src) && !/logo|icon|avatar|emoji|equation|data:image\/svg/i.test(src) && images.length < 20) {
            images.push(src);
          }
        });
        return { text, title, url, author, content, articleText, images: [...new Set(images)] };
      }
    });
    const page = results?.[0]?.result;
    if (!page) return notify('无法读取页面内容', true);
    const payload = {
      title: page.title || '未命名剪藏',
      url: page.url || '',
      author: page.author || '',
      text: page.articleText || page.text || '',
      content: page.content || '',
      images: page.images || []
    };
    const res = await fetch(`${server}/api/clips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || '保存失败');
    }
    notify('整页已保存到 Web Clipper');
  } catch (e) {
    notify('保存失败：' + e.message, true);
  }
}

function notify(message, isError = false) {
  chrome.notifications
    ? chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-192.png',
        title: isError ? 'Web Clipper 保存失败' : 'Web Clipper',
        message: message
      })
    : chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log('[Web Clipper]', message);
      });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'reload-menus') {
    createMenus();
    sendResponse({ ok: true });
  }
});
