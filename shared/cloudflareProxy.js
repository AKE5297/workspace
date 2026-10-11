// Cloudflare 边缘代理共享逻辑（供 Pages Functions 与 Workers 复用）
//
// 作用：判断请求是否需要代理到后端，并构造转发请求。
// 被以下两处引用：
//   - functions/[[path]].js（Cloudflare Pages Functions）
//   - workers/index.js（Cloudflare Workers Static Assets）

// 需要代理到后端的路径前缀
export const PROXY_PREFIXES = ['/api', '/rss', '/uploads'];

// hop-by-hop 头不应转发到上游，移除以避免语义错误或被上游拒绝
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
];

export function shouldProxy(pathname) {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// 将请求原样转发到 API_ORIGIN，返回上游响应；缺少配置时返回 500
export function proxyRequest(request, origin) {
  const base = String(origin || '').replace(/\/+$/, '');
  if (!base) {
    return new Response('Missing API_ORIGIN environment variable', { status: 500 });
  }

  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, base);
  const headers = new Headers(request.headers);
  HOP_BY_HOP.forEach((name) => headers.delete(name));
  headers.delete('host');
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  };
  // GET/HEAD 无请求体；其余方法转发原始流（支持文件上传）
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  return fetch(new Request(target.toString(), init));
}
