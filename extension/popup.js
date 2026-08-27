const serverInput = document.getElementById('server');
const tokenInput = document.getElementById('token');
const titleInput = document.getElementById('title');
const textInput = document.getElementById('text');
const notebookSelect = document.getElementById('notebook');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

const DEFAULT_SERVER = 'https://5173-9b655859f5bdf233.monkeycode-ai.online';

chrome.storage.local.get(['server', 'token'], (data) => {
  serverInput.value = data.server || DEFAULT_SERVER;
  if (data.token) tokenInput.value = data.token;
  loadNotebooks();
});

async function loadNotebooks() {
  const server = serverInput.value;
  const token = tokenInput.value;
  if (!server || !token) return;
  try {
    const res = await fetch(`${server}/api/notebooks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    notebookSelect.innerHTML = '<option value="">未分类</option>';
    (data.items || []).forEach((nb) => {
      const opt = document.createElement('option');
      opt.value = nb.id;
      opt.textContent = nb.name;
      notebookSelect.appendChild(opt);
    });
  } catch (e) {
    statusEl.textContent = '无法加载笔记本列表';
    statusEl.className = 'status error';
  }
}

async function capturePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
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

      const imgSrcs = [...new Set(images)];
      const articleUrl = articleEl ? [...articleEl.querySelectorAll('img')].map((i) => i.currentSrc || i.getAttribute('src') || i.getAttribute('data-actualsrc') || i.getAttribute('data-src')).filter((s) => s && /^https?:\/\//i.test(s)) : [];

      return { text, title, url, author, content, articleText, images: imgSrcs.concat(articleUrl).filter((s, i, a) => a.indexOf(s) === i) };
    }
  });
  return results?.[0]?.result || null;
}

saveBtn.addEventListener('click', async () => {
  const server = serverInput.value.trim();
  const token = tokenInput.value.trim();
  if (!server || !token) {
    statusEl.textContent = '请填写服务器地址和 Token';
    statusEl.className = 'status error';
    return;
  }
  chrome.storage.local.set({ server, token });
  saveBtn.disabled = true;
  statusEl.textContent = '正在抓取页面…';
  statusEl.className = 'status';
  try {
    const page = await capturePage();
    const payload = {
      title: titleInput.value.trim() || page?.title || '未命名剪藏',
      url: page?.url || '',
      author: page?.author || '',
      text: textInput.value.trim() || page?.articleText || page?.text || '',
      content: page?.content || '',
      images: page?.images || [],
      notebookId: notebookSelect.value || null
    };
    const res = await fetch(`${server}/api/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '保存失败');
    statusEl.textContent = '剪藏保存成功！';
    statusEl.className = 'status';
    window.close();
  } catch (e) {
    statusEl.textContent = '保存失败：' + e.message;
    statusEl.className = 'status error';
  } finally {
    saveBtn.disabled = false;
  }
});
