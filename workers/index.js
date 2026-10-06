// Cloudflare Workers 入口：静态资源 + 边缘反向代理
//
// 作用：把 /api、/rss、/uploads 代理到后端服务，其余请求交给静态资源（env.ASSETS）。
// 配合 wrangler.workers.toml 中的 [assets] 使用：
//   directory            = "./frontend/dist"
//   binding              = "ASSETS"
//   not_found_handling   = "single-page-application"
//
// 部署步骤：
//   1. npm --prefix frontend ci && npm --prefix frontend run build
//   2. wrangler secret put API_ORIGIN --config wrangler.workers.toml
//   3. wrangler deploy --config wrangler.workers.toml
const PROXY_PREFIXES = ['/api', '/rss', '/uploads'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const shouldProxy = PROXY_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    );
    if (!shouldProxy) {
      return env.ASSETS.fetch(request);
    }

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
};
