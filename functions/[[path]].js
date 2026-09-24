// Cloudflare Pages Functions：将 /api、/rss、/uploads 反向代理到后端服务
//
// 部署步骤：
//   1. 在 Cloudflare Pages 项目设置中配置环境变量 API_ORIGIN（例如 https://api.example.com）
//   2. 构建命令：npm --prefix frontend ci && npm --prefix frontend run build
//   3. 构建输出目录：frontend/dist
// 这样前端与后端在浏览器看来同源，正文中的 /uploads 图片无需重写。
const PROXY_PREFIXES = ['/api', '/rss', '/uploads'];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const shouldProxy = PROXY_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );
  if (!shouldProxy) return next();

  const origin = String(env.API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return new Response('Missing API_ORIGIN environment variable', { status: 500 });
  }

  const target = new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
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
