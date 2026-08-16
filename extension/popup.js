const serverInput = document.getElementById('server');
const tokenInput = document.getElementById('token');
const titleInput = document.getElementById('title');
const textInput = document.getElementById('text');
const notebookSelect = document.getElementById('notebook');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['server', 'token'], (data) => {
  if (data.server) serverInput.value = data.server;
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
      const text = document.body?.innerText || '';
      const title = document.title || '';
      const url = location.href;
      return { text, title, url };
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
      text: textInput.value.trim() || page?.text || '',
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
