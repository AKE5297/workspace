import axios from 'axios';
import config from '../config.js';
import { getDb, loadSettings } from '../db.js';
import { stripHtml, truncate } from '../utils/helpers.js';

function getSettings() {
  const s = loadSettings();
  return {
    summaryEnabled: s.summaryEnabled !== undefined ? s.summaryEnabled : config.llm.summaryEnabled,
    tagEnabled: s.tagEnabled !== undefined ? s.tagEnabled : config.llm.tagEnabled,
    tagCount: s.tagCount || 5
  };
}

async function callLLM(messages, maxTokens = 500) {
  const apiKey = config.llm.apiKey;
  if (!apiKey) return '';
  const resp = await axios.post(
    `${config.llm.baseUrl}/chat/completions`,
    {
      model: config.llm.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000
    }
  );
  return resp.data?.choices?.[0]?.message?.content || '';
}

async function withRetry(fn, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function generateSummary(clip) {
  const s = getSettings();
  if (!s.summaryEnabled) return '';
  const content = stripHtml(clip.text || '').slice(0, 4000);
  const prompt = `请为以下文章生成一个200字以内的中文摘要，概括核心观点和主要内容，只输出摘要内容：\n\n${content}`;
  const result = await withRetry(() =>
    callLLM([{ role: 'user', content: prompt }], 300)
  );
  return truncate(result, 200);
}

export async function recommendTags(clip) {
  const s = getSettings();
  if (!s.tagEnabled) return [];
  const content = stripHtml(clip.text || '').slice(0, 3000);
  const prompt = `请根据以下文章内容，推荐${s.tagCount}个精准的中文标签，只输出逗号分隔的标签列表，不要输出其他内容：\n\n${content}`;
  const result = await withRetry(() =>
    callLLM([{ role: 'user', content: prompt }], 100)
  );
  const tags = result
    .split(/[,，、;；\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/^[#\s]+/, '').replace(/[#\s]+$/, ''))
    .slice(0, s.tagCount);
  return tags;
}

export function hasLLM() {
  return Boolean(config.llm.apiKey);
}
