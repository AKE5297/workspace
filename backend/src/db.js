import fs from 'fs';
import path from 'path';
import config from './config.js';

const dataFile = path.join(config.dataDir, 'db.json');
const settingsFile = path.join(config.dataDir, 'settings.json');

const DEFAULT_DB = {
  users: [],
  clips: [],
  tags: [],
  notebooks: [],
  shares: [],
  recycle: [],
  counters: { clip: 0, user: 0, notebook: 0, share: 0 }
};

let db = null;

function ensureDirs() {
  [config.dataDir, config.clipsDir, config.uploadsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function load() {
  ensureDirs();
  if (fs.existsSync(dataFile)) {
    try {
      db = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    } catch (e) {
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  } else {
    db = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  if (!db.counters) db.counters = { clip: 0, user: 0, notebook: 0, share: 0 };
  return db;
}

export function getDb() {
  if (!db) load();
  return db;
}

export function save() {
  if (!db) return;
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmp, dataFile);
}

export function nextId(type) {
  db.counters[type] = (db.counters[type] || 0) + 1;
  return db.counters[type];
}

export function now() {
  return new Date().toISOString();
}

export function readClipFile(id) {
  const fp = path.join(config.clipsDir, `${id}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (e) {
    return null;
  }
}

export function writeClipFile(id, content) {
  const fp = path.join(config.clipsDir, `${id}.json`);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(content, null, 2), 'utf-8');
  fs.renameSync(tmp, fp);
}

export function deleteClipFile(id) {
  const fp = path.join(config.clipsDir, `${id}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

export function loadSettings() {
  if (fs.existsSync(settingsFile)) {
    try {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

export function saveSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
}
