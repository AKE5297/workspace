// Cloudflare Pages Functions：将 /api、/rss、/uploads 反向代理到后端服务
//
// 部署步骤：
//   1. 在 Cloudflare Pages 项目设置中配置环境变量 API_ORIGIN（例如 https://api.example.com）
//   2. 构建命令：npm --prefix frontend ci && npm --prefix frontend run build
//   3. 构建输出目录：frontend/dist
// 这样前端与后端在浏览器看来同源，正文中的 /uploads 图片无需重写。
//
// 代理范围由 frontend/public/_routes.json 收敛到上述前缀，
// 静态资源与 SPA 路由不会触发本函数，节省调用次数。
import { shouldProxy, proxyRequest } from '../shared/cloudflareProxy.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (!shouldProxy(url.pathname)) return next();

  return proxyRequest(request, env.API_ORIGIN);
}
