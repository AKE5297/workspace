import { Router } from 'express';
import { loadSettings, saveSettings } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const s = loadSettings();
  const {
    themeColor, darkMode, summaryEnabled, tagEnabled, tagCount,
    telegramEnabled, telegramBotToken, telegramChatId, telegramTemplate,
    telegramPushWindow, telegramPushStart, telegramPushEnd,
    emailEnabled, emailRecipient, emailMode,
    logoUrl, logoText
  } = s;
  res.json({
    themeColor: themeColor || '#409eff',
    darkMode: darkMode || 'light',
    summaryEnabled: summaryEnabled !== undefined ? summaryEnabled : true,
    tagEnabled: tagEnabled !== undefined ? tagEnabled : true,
    tagCount: tagCount || 5,
    telegramEnabled: Boolean(telegramEnabled),
    telegramBotToken: telegramBotToken ? '******' : '',
    telegramChatId: telegramChatId || '',
    telegramTemplate: telegramTemplate || '',
    telegramPushWindow: Boolean(telegramPushWindow),
    telegramPushStart: telegramPushStart || 8,
    telegramPushEnd: telegramPushEnd || 22,
    emailEnabled: Boolean(emailEnabled),
    emailRecipient: emailRecipient || '',
    emailMode: emailMode || 'realtime',
    logoUrl: logoUrl || '',
    logoText: logoText || 'Web Clipper'
  });
});

router.put('/', (req, res) => {
  const body = req.body || {};
  const s = loadSettings();
  const keys = [
    'themeColor', 'darkMode', 'summaryEnabled', 'tagEnabled', 'tagCount',
    'telegramEnabled', 'telegramBotToken', 'telegramChatId', 'telegramTemplate',
    'telegramPushWindow', 'telegramPushStart', 'telegramPushEnd',
    'emailEnabled', 'emailRecipient', 'emailMode',
    'logoUrl', 'logoText'
  ];
  keys.forEach((k) => {
    if (body[k] !== undefined) s[k] = body[k];
  });
  saveSettings(s);
  res.json({ ok: true, settings: s });
});

export default router;
