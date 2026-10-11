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
import { shouldProxy, proxyRequest } from '../shared/cloudflareProxy.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!shouldProxy(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    return proxyRequest(request, env.API_ORIGIN);
  }
};
