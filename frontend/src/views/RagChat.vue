<template>
  <div class="rag-page">
    <div class="header">
      <h2>智能问答</h2>
      <p class="sub">
        基于知识库内容回答问题
        <el-tag v-if="configured" size="small" type="success" class="status-tag">已启用</el-tag>
        <el-tag v-else size="small" type="warning" class="status-tag">未配置 API Key</el-tag>
      </p>
    </div>

    <el-alert v-if="!configured" type="warning" :closable="false" class="key-alert">
      <template #title>
        当前未配置大模型 API Key，问答功能不可用。
      </template>
      请在 <code>backend/.env</code> 中设置 <code>USER_LLM_API_KEY</code>（可选 <code>USER_LLM_BASE_URL</code>、<code>USER_LLM_MODEL</code>）后重启后端服务，即可开启基于知识库的智能问答。
    </el-alert>

    <div class="chat-box">
      <div v-if="!messages.length" class="chat-empty">
        <el-icon :size="40" color="var(--el-color-primary)"><ChatDotRound /></el-icon>
        <p>向你的知识库提问，AI 将基于已收藏的剪藏内容回答</p>
        <div class="suggestion-list">
          <el-button
            v-for="s in suggestions"
            :key="s"
            size="small"
            plain
            @click="askQuestion(s)"
          >{{ s }}</el-button>
        </div>
      </div>

      <div v-else class="messages">
        <div v-for="(msg, i) in messages" :key="i" class="msg" :class="msg.role">
          <div class="msg-bubble" :class="msg.role">
            <div v-if="msg.role === 'assistant'" class="msg-content markdown-body" v-html="renderMd(msg.content)"></div>
            <div v-else class="msg-content">{{ msg.content }}</div>
            <div v-if="msg.sources && msg.sources.length" class="msg-sources">
              <div class="sources-title">参考来源（{{ msg.sources.length }}）：</div>
              <div
                v-for="s in msg.sources"
                :key="s.id"
                class="source-item"
                @click="openClip(s.id)"
              >
                <el-icon><Document /></el-icon>
                <span class="source-title">{{ s.title }}</span>
                <span v-if="s.domain" class="source-domain">{{ s.domain }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="loading" class="msg assistant">
          <div class="msg-bubble assistant typing">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-row">
      <el-select v-model="notebookId" placeholder="限定范围：全部剪藏" clearable style="width: 200px">
        <el-option v-for="nb in notebooks" :key="nb.id" :label="nb.name" :value="nb.id" />
      </el-select>
      <span class="filter-hint">按笔记本限定问答检索范围</span>
    </div>

    <div class="input-bar">
      <el-input
        v-model="question"
        type="textarea"
        :rows="2"
        resize="none"
        placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
        :disabled="loading"
        @keydown.enter.exact.prevent="send"
      />
      <el-button type="primary" :loading="loading" :disabled="!question.trim()" @click="send">
        发送
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Document } from '@element-plus/icons-vue';
import { marked } from 'marked';
import { ragApi, notebookApi } from '@/api';
import api from '@/api/client';

const router = useRouter();
const messages = ref([]);
const question = ref('');
const loading = ref(false);
const configured = ref(true);
const notebooks = ref([]);
const notebookId = ref(null);

const suggestions = [
  '我的知识库里收藏了哪些技术主题？',
  '总结一下关于 RAG 的内容',
  '有哪些剪藏来自知乎？'
];

const renderMd = (content) => {
  try {
    return marked.parse(content || '', { gfm: true, breaks: true });
  } catch (e) {
    return `<pre>${content || ''}</pre>`;
  }
};

async function checkStatus() {
  try {
    const { data } = await ragApi.status();
    configured.value = data.configured;
  } catch (e) {
    configured.value = false;
  }
}

async function loadNotebooks() {
  try {
    const { data } = await notebookApi.list();
    notebooks.value = data.items;
  } catch (e) { /* ignore */ }
}

function buildHistory() {
  return messages.value
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function askQuestion(q) {
  question.value = q;
  await send();
}

async function send() {
  const q = question.value.trim();
  if (!q || loading.value) return;
  messages.value.push({ role: 'user', content: q });
  question.value = '';
  loading.value = true;
  const payload = {
    question: q,
    history: buildHistory(),
    notebookId: notebookId.value
  };

  try {
    const res = await api.post('/rag/ask-stream', payload, { responseType: 'text' });
    const data = res.data;
    let answer = '';
    let sources = [];
    let assistantMsg = null;
    let failed = false;

    for (const line of data.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const jsonText = line.slice(5).trim();
      if (!jsonText) continue;
      try {
        const evt = JSON.parse(jsonText);
        if (evt.type === 'needsKey') {
          configured.value = false;
          messages.value.push({ role: 'assistant', content: evt.message || '未配置 API Key' });
          failed = true;
        } else if (evt.type === 'sources') {
          sources = evt.sources || [];
        } else if (evt.type === 'token') {
          answer += evt.content;
          if (!assistantMsg) {
            assistantMsg = { role: 'assistant', content: '' };
            messages.value.push(assistantMsg);
          }
          assistantMsg.content = answer;
          scrollToBottom();
        } else if (evt.type === 'error') {
          messages.value.push({ role: 'assistant', content: evt.message || '问答失败，请稍后重试' });
          failed = true;
        } else if (evt.type === 'done') {
          if (assistantMsg) assistantMsg.sources = sources;
          if (!assistantMsg && !failed) {
            messages.value.push({ role: 'assistant', content: '', sources });
          }
        }
      } catch (e) { /* 忽略解析失败分片 */ }
    }
    if (assistantMsg && !assistantMsg.sources) assistantMsg.sources = sources;
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: e.response?.data?.message || '问答失败，请稍后重试'
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

function openClip(id) {
  router.push(`/clip/${id}`);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const box = document.querySelector('.chat-box');
    if (box) box.scrollTop = box.scrollHeight;
  });
}

onMounted(() => {
  checkStatus();
  loadNotebooks();
});
</script>

<style scoped>
.rag-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.header h2 {
  margin: 0 0 4px;
}
.sub {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-tag {
  margin-left: 4px;
}
.key-alert {
  margin-bottom: 16px;
}
.chat-box {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}
.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--el-text-color-secondary);
  padding: 40px 0;
}
.chat-empty p {
  margin: 0;
}
.suggestion-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 480px;
}
.messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.msg {
  display: flex;
}
.msg.user {
  justify-content: flex-end;
}
.msg-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-bubble.user {
  background: var(--el-color-primary);
  color: #fff;
  border-top-right-radius: 2px;
}
.msg-bubble.assistant {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  border-top-left-radius: 2px;
}
.msg-content {
  font-size: 14px;
}
.msg-content :deep(p) {
  margin: 0.5em 0;
}
.msg-content :deep(pre) {
  background: var(--el-bg-color);
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.6;
  font-size: 13px;
  border: 1px solid var(--el-border-color-lighter);
}
.msg-content :deep(code) {
  background: var(--el-bg-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}
.msg-content :deep(pre code) {
  background: transparent;
  padding: 0;
}
.msg-content :deep(ul),
.msg-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.4em 0;
}
.msg-content :deep(blockquote) {
  border-left: 4px solid var(--el-color-primary);
  margin: 0.6em 0;
  padding-left: 12px;
  color: var(--el-text-color-secondary);
}
.msg-content :deep(table) {
  border-collapse: collapse;
  margin: 0.6em 0;
}
.msg-content :deep(th),
.msg-content :deep(td) {
  border: 1px solid var(--el-border-color-light);
  padding: 6px 10px;
}
.msg-content :deep(h1),
.msg-content :deep(h2),
.msg-content :deep(h3) {
  margin: 0.8em 0 0.4em;
  font-size: 1.1em;
}
.msg-sources {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color);
  font-size: 12px;
}
.sources-title {
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.source-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  cursor: pointer;
  color: var(--el-color-primary);
}
.source-item:hover {
  text-decoration: underline;
}
.source-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-domain {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
  animation: blink 1.2s infinite;
}
.dot:nth-child(2) {
  animation-delay: 0.2s;
}
.dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.filter-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.input-bar {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.input-bar .el-button {
  height: 46px;
  min-width: 80px;
}
</style>
