import axios from 'axios';
import config from '../config.js';
import { loadSettings } from '../db.js';
import { stripHtml, truncate } from '../utils/helpers.js';

function getTelegramConfig() {
  const s = loadSettings();
  return {
    botToken: s.telegramBotToken || config.telegram.botToken,
    chatId: s.telegramChatId || config.telegram.chatId
  };
}

function getPushWindow(s) {
  const start = Number(s.telegramPushStart ?? 8);
  const end = Number(s.telegramPushEnd ?? 22);
  return { start, end };
}

export function isTelegramConfigured() {
  const c = getTelegramConfig();
  return Boolean(c.botToken && c.chatId);
}

function inWindow() {
  const s = loadSettings();
  const { start, end } = getPushWindow(s);
  const hour = new Date().getHours();
  return hour >= start && hour <= end;
}

function renderTemplate(template, clip, baseUrl) {
  const map = {
    '{{title}}': clip.title || '',
    '{{summary}}': truncate(stripHtml(clip.summary || clip.text || ''), 200),
    '{{tags}}': (clip.tags || []).map((t) => `#${t}`).join(' '),
    '{{createdAt}}': clip.createdAt || '',
    '{{url}}': clip.url || ''
  };
  const tpl =
    template ||
    '📌 新剪藏：{{title}}\n\n{{summary}}\n\n标签：{{tags}}\n保存时间：{{createdAt}}\n原文：{{url}}';
  return tpl.replace(/{{[^}]+}}/g, (m) => map[m] || '');
}

export async function sendTelegram(clip) {
  const s = loadSettings();
  if (s.telegramEnabled === false) return { sent: false, reason: 'disabled' };
  if (!isTelegramConfigured()) return { sent: false, reason: 'not_configured' };
  if (s.telegramPushWindow === true && !inWindow()) {
    return { sent: false, reason: 'outside_window' };
  }
  const c = getTelegramConfig();
  const text = renderTemplate(s.telegramTemplate, clip, config.publicBaseUrl);
  const url = `https://api.telegram.org/bot${c.botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: c.chatId,
    text,
    disable_web_page_preview: false
  }, { timeout: 15000 });
  return { sent: true };
}

export async function sendEmail(clip) {
  const s = loadSettings();
  if (s.emailEnabled !== true) return { sent: false, reason: 'disabled' };
  if (!config.smtp.host) return { sent: false, reason: 'not_configured' };
  // 使用 nodemailer 动态加载，避免依赖缺失影响启动
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
  const to = s.emailRecipient || config.smtp.user;
  const title = clip.title || '剪藏';
  const summary = truncate(stripHtml(clip.summary || clip.text || ''), 200);
  const html = `
    <h2><a href="${clip.url || ''}">${title}</a></h2>
    <p>保存时间：${clip.createdAt || ''}</p>
    <p>原文链接：<a href="${clip.url || ''}">${clip.url || ''}</a></p>
    <p>${summary}</p>
  `;
  await transporter.sendMail({
    from: config.smtp.from || config.smtp.user,
    to,
    subject: `新剪藏：${title}`,
    html
  });
  return { sent: true };
}
