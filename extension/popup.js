const serverInput = document.getElementById('server');
const tokenInput = document.getElementById('token');
const titleInput = document.getElementById('title');
const textInput = document.getElementById('text');
const notebookSelect = document.getElementById('notebook');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const fullModeEl = document.getElementById('full-mode');

const DEFAULT_SERVER = 'https://5173-9b655859f5bdf233.monkeycode-ai.online';

const engine = window.__CLIPPER_SNAPSHOT__;

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

async function capturePage(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  if (!engine) {
    throw new Error('共享抓取引擎未加载，请重新加载扩展');
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: engine.CAPTURE_FN,
    args: [engine.SITE_RULES, mode]
  });
  return results?.[0]?.result || null;
}

function cleanTitle(raw) {
  return (raw || '')
    .replace(
      /\s*[-_|·\s]\s*(知乎专栏|知乎|简书|掘金|CSDN博客|博客园|微信公众号|微信公众号文章|微信公众平台|IT之家|少数派|语雀|GitHub|Medium|InfoQ|SegmentFault思否|思否|小红书|小红书笔记|什么值得买|SMZDM|博客|Blog)$/i,
      ''
    )
    .trim();
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
  const full = fullModeEl ? fullModeEl.checked : true;
  statusEl.textContent = full ? '正在滚动加载全文并抓取…' : '正在抓取页面…';
  statusEl.className = 'status';
  try {
    const page = await capturePage(full ? 'full' : 'fast');
    const payload = {
      title: titleInput.value.trim() || cleanTitle(page?.title) || '未命名剪藏',
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
