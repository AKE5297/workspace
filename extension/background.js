importScripts('snapshot.js');

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
    chrome.contextMenus.create({
      id: 'clip-page-full',
      title: '滚动加载全文后保存到 Web Clipper',
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
    savePage(tab, 'fast');
  } else if (info.menuItemId === 'clip-page-full') {
    savePage(tab, 'full');
  }
});

// 通用标题清理：去掉常见站点名后缀
function cleanTitle(raw) {
  return (raw || '')
    .replace(
      /\s*[-_|·\s]\s*(知乎专栏|知乎|简书|掘金|CSDN博客|博客园|微信公众号|微信公众号文章|微信公众平台|IT之家|少数派|语雀|GitHub|Medium|InfoQ|SegmentFault思否|思否|小红书|小红书笔记|什么值得买|SMZDM|博客|Blog)$/i,
      ''
    )
    .trim();
}

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

// 通过共享快照引擎抓取当前页（mode: 'fast' 直接抓 / 'full' 先滚动加载全文）
async function snapshotTab(tabId, mode) {
  const engine = self.__CLIPPER_SNAPSHOT__;
  if (!engine) return null;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: engine.CAPTURE_FN,
    args: [engine.SITE_RULES, mode]
  });
  return results?.[0]?.result || null;
}

async function savePage(tab, mode = 'fast') {
  const { server, token } = await getConfig();
  if (!token) return notify('未配置 Token，请先打开扩展设置', true);
  try {
    const page = await snapshotTab(tab.id, mode);
    if (!page) return notify('无法读取页面内容', true);
    const payload = {
      title: cleanTitle(page.title) || '未命名剪藏',
      url: page.url || tab?.url || '',
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
    notify(mode === 'full' ? '全文已加载并保存到 Web Clipper' : '整页已保存到 Web Clipper');
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
