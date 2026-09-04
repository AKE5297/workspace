import axios from 'axios';
import config from '../config.js';
import { getDb, readClipFile } from '../db.js';
import * as search from './searchService.js';
import { stripHtml } from '../utils/helpers.js';

const MAX_CONTEXT_CHARS = 8000;
const TOP_K = 5;
const MAX_HISTORY = 6;

export function hasLLM() {
  return Boolean(config.llm.apiKey);
}

function searchScoped(question, userId, notebookId) {
  const db = getDb();
  const hits = search.search(question, { limit: 50 });
  let mine = hits.filter((c) => c.userId === userId);
  if (notebookId) mine = mine.filter((c) => c.notebookId === notebookId);
  return mine.slice(0, TOP_K);
}

function findBestSnippet(text, question, maxLen = 500) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const qLower = String(question || '').toLowerCase();
  let idx = 0;
  if (qLower) {
    const found = lower.indexOf(qLower);
    if (found >= 0) idx = Math.max(0, found - 100);
  }
  return text.slice(idx, idx + maxLen);
}

export function buildContext(question, clips) {
  const parts = [];
  for (const c of clips) {
    const full = readClipFile(c.id) || c;
    const body = stripHtml(full.markdown || full.text || '').replace(/\s+/g, ' ');
    const snippet = findBestSnippet(body, question);
    parts.push(`【${full.title}】\n来源：${full.url || '未知'}\n内容：${snippet}`);
  }
  return parts.join('\n\n---\n\n').slice(0, MAX_CONTEXT_CHARS);
}

function buildMessages(question, history, context) {
  const system =
    '你是一个基于用户知识库的智能问答助手。请严格依据提供的资料回答用户问题，只使用资料中的信息，不要编造。' +
    '如果资料不足，请明确说明。回答使用简体中文，条理清晰，善用列表和代码块。';
  const messages = [{ role: 'system', content: system }];
  const recent = (Array.isArray(history) ? history : []).slice(-MAX_HISTORY);
  for (const m of recent) {
    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: String(m.content || '').slice(0, 2000) });
    }
  }
  messages.push({
    role: 'user',
    content: `以下是从用户知识库检索到的相关资料：\n\n${context}\n\n请基于以上资料回答用户问题：${question}`
  });
  return messages;
}

export function buildSources(hits) {
  return hits.map((c) => ({
    id: c.id,
    title: c.title,
    url: c.url || '',
    domain: c.domain || '',
    author: c.author || '',
    createdAt: c.createdAt || ''
  }));
}

async function doChat(messages, { stream, onToken } = {}) {
  const resp = await axios.post(
    `${config.llm.baseUrl}/chat/completions`,
    {
      model: config.llm.model,
      messages,
      max_tokens: 800,
      temperature: 0.3,
      stream
    },
    {
      headers: { Authorization: `Bearer ${config.llm.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 120000,
      responseType: stream ? 'stream' : 'json'
    }
  );
  if (!stream) {
    return resp.data?.choices?.[0]?.message?.content || '';
  }
  let full = '';
  for await (const chunk of resp.data) {
    const line = chunk.toString('utf-8').trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        if (onToken) onToken(delta);
      }
    } catch (e) {
      /* 忽略非 JSON 分片 */
    }
  }
  return full;
}

export async function ask(question, userId, opts = {}) {
  const { history = [], notebookId = null } = opts;
  if (!hasLLM()) {
    return {
      ok: false,
      needsKey: true,
      answer: '',
      sources: [],
      message: '尚未配置大模型 API Key，无法进行智能问答。请在 backend/.env 中设置 USER_LLM_API_KEY（及可选的 USER_LLM_BASE_URL、USER_LLM_MODEL）后重启服务。'
    };
  }
  const hits = searchScoped(question, userId, notebookId);
  const sources = buildSources(hits);

  if (!hits.length) {
    return {
      ok: true,
      answer: '没有在知识库中检索到与问题相关的剪藏内容。建议换一种表达方式，或先收藏更多相关资料。',
      sources: []
    };
  }

  const context = buildContext(question, hits);
  const messages = buildMessages(question, history, context);
  try {
    const answer = await doChat(messages, { stream: false });
    if (!answer) {
      return { ok: false, answer: '大模型返回为空，请稍后重试。', sources };
    }
    return { ok: true, answer, sources };
  } catch (e) {
    return {
      ok: false,
      answer: '',
      sources,
      message: `问答服务调用失败：${e.response?.data?.error?.message || e.message}`
    };
  }
}

export async function askStream(req, res, question, userId, opts = {}) {
  const { history = [], notebookId = null } = opts;
  if (!hasLLM()) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write(
      `data: ${JSON.stringify({ type: 'needsKey', message: '尚未配置大模型 API Key，无法进行智能问答。' })}\n\n`
    );
    res.end();
    return;
  }
  const hits = searchScoped(question, userId, notebookId);
  const sources = buildSources(hits);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  if (!hits.length) {
    res.write(
      `data: ${JSON.stringify({ type: 'answer', content: '没有在知识库中检索到与问题相关的剪藏内容。建议换一种表达方式，或先收藏更多相关资料。', sources: [] })}\n\n`
    );
    res.end();
    return;
  }
  res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

  const context = buildContext(question, hits);
  const messages = buildMessages(question, history, context);
  try {
    await doChat(messages, {
      stream: true,
      onToken: (delta) => {
        res.write(`data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`);
      }
    });
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (e) {
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: `问答服务调用失败：${e.response?.data?.error?.message || e.message}` })}\n\n`
    );
  }
  res.end();
}
