import axios from 'axios';
import config from '../config.js';
import { getDb, readClipFile } from '../db.js';
import * as search from './searchService.js';
import { stripHtml } from '../utils/helpers.js';

const MAX_CONTEXT_CHARS = 8000;
const TOP_K = 5;

export function hasLLM() {
  return Boolean(config.llm.apiKey);
}

function searchScoped(question, userId) {
  const db = getDb();
  const hits = search.search(question, { limit: 50 });
  const mine = hits.filter((c) => c.userId === userId);
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

export async function ask(question, userId) {
  if (!hasLLM()) {
    return {
      ok: false,
      needsKey: true,
      answer: '',
      sources: [],
      message: '尚未配置大模型 API Key，无法进行智能问答。请在 backend/.env 中设置 USER_LLM_API_KEY（及可选的 USER_LLM_BASE_URL、USER_LLM_MODEL）后重启服务。'
    };
  }
  const hits = searchScoped(question, userId);
  const sources = hits.map((c) => ({
    id: c.id,
    title: c.title,
    url: c.url || '',
    domain: c.domain || '',
    author: c.author || '',
    createdAt: c.createdAt || ''
  }));

  if (!hits.length) {
    return {
      ok: true,
      answer: '没有在知识库中检索到与问题相关的剪藏内容。建议换一种表达方式，或先收藏更多相关资料。',
      sources: []
    };
  }

  const context = buildContext(question, hits);
  const system = '你是一个基于用户知识库的智能问答助手。请严格依据提供的资料回答用户问题，只使用资料中的信息，不要编造。如果资料不足，请明确说明。回答使用简体中文，条理清晰。';
  const user = `以下是从用户知识库检索到的相关资料：\n\n${context}\n\n请回答用户问题：${question}`;

  try {
    const resp = await axios.post(
      `${config.llm.baseUrl}/chat/completions`,
      {
        model: config.llm.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: 800,
        temperature: 0.3
      },
      {
        headers: { Authorization: `Bearer ${config.llm.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );
    const answer = resp.data?.choices?.[0]?.message?.content || '';
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
