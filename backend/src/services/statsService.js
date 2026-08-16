import { getDb, readClipFile } from '../db.js';
import { todayKey } from '../utils/helpers.js';

function dayKeyOf(iso) {
  return todayKey(new Date(iso));
}

export function buildStats(userId) {
  const db = getDb();
  const clips = db.clips.filter((c) => c.userId === userId);
  const readLogs = (db.readLogs || []).filter((r) => r.userId === userId);

  const today = todayKey();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);

  const todayReads = readLogs.filter((r) => dayKeyOf(r.at) === today).length;
  const weekReads = readLogs.filter((r) => new Date(r.at) >= weekStart).length;

  const monthTrend = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const count = clips.filter((c) => dayKeyOf(c.createdAt) === key).length;
    monthTrend.push({ date: key, count });
  }

  const tagMap = new Map();
  clips.forEach((c) => {
    (c.tags || []).forEach((t) => {
      tagMap.set(t, (tagMap.get(t) || 0) + 1);
    });
  });
  const tagDistribution = [...tagMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const notebookMap = new Map();
  clips.forEach((c) => {
    const key = c.notebookId || 'uncategorized';
    notebookMap.set(key, (notebookMap.get(key) || 0) + 1);
  });
  const notebookNames = new Map(
    db.notebooks.map((n) => [n.id, n.name])
  );
  const notebookBars = [...notebookMap.entries()].map(([id, value]) => ({
    name: id === 'uncategorized' ? '未分类' : notebookNames.get(id) || '未知笔记本',
    value
  }));

  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  readLogs.forEach((r) => {
    const d = new Date(r.at);
    const dow = (d.getDay() + 6) % 7;
    heatmap[dow][d.getHours()] += 1;
  });

  const totalReads = readLogs.length;
  const totalClips = clips.length;

  return {
    totalClips,
    totalReads,
    todayReads,
    weekReads,
    monthTrend,
    tagDistribution,
    notebookBars,
    heatmap,
    readDistribution: { detail: totalReads, readingMode: 0 }
  };
}

export function collectNotebookStats(userId) {
  const db = getDb();
  const clips = db.clips.filter((c) => c.userId === userId);
  const countMap = new Map();
  clips.forEach((c) => countMap.set(c.notebookId || 'uncategorized', (countMap.get(c.notebookId || 'uncategorized') || 0) + 1));
  return countMap;
}
