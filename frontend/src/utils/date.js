// 统一的日期格式化工具，避免各页面重复实现与格式不一致。

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 仅日期：2026-10-09
export function formatDay(iso) {
  const d = toDate(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 日期 + 时分：2026-10-09 14:30
export function formatDateTime(iso) {
  const d = toDate(iso);
  if (!d) return '';
  return `${formatDay(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
