import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'web-clipper-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  clipsDir: process.env.CLIPS_DIR || path.join(__dirname, '..', 'data', 'clips'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'data', 'uploads'),
  recycleDays: parseInt(process.env.RECYCLE_DAYS || '30', 10),
  llm: {
    apiKey: process.env.USER_LLM_API_KEY || '',
    baseUrl: process.env.USER_LLM_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.USER_LLM_MODEL || 'deepseek-chat',
    summaryEnabled: process.env.AI_SUMMARY_ENABLED !== 'false',
    tagEnabled: process.env.AI_TAG_ENABLED !== 'false'
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || ''
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  // 允许的跨域来源：默认 * 放行全部（本地开发同源代理场景无 CORS）；
  // 前后端分离部署时建议设为前端域名，多个用英文逗号分隔，例如 https://app.example.com,https://pages.dev
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
