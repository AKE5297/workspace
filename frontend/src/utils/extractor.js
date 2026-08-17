// 网页内容抓取已迁移到后端 /api/extract 接口（见 backend/src/services/extractService.js）。
// 服务端抓取可绕过浏览器 CORS 限制，支持微信公众号、博客、普通网页等绝大多数站点。
//
// 前端抓取请调用：
//   import { extractApi } from '@/api';
//   const { data } = await extractApi.extract(url);
//
// 此模块已废弃，不再提供导出，请勿引用。
export {};
