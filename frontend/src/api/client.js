import axios from 'axios';
import { ElMessage } from 'element-plus';

// API 基地址：默认同源 /api（本地开发经 Vite 代理、Docker/Nginx 经反向代理）；
// 部署到静态托管（Cloudflare Pages / Netlify / Vercel 等）且后端独立时，用 VITE_API_BASE 指定后端地址
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '') || '/api';

// 媒体资源基地址：默认同源；后端独立部署时用 VITE_ASSET_BASE 指向后端，用于重写正文中的 /uploads/ 图片地址
export const ASSET_BASE = (import.meta.env.VITE_ASSET_BASE || '').replace(/\/+$/, '');

export const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

// 将正文 HTML 中的 /uploads/ 资源地址重写为后端地址（跨域静态托管场景）
export function resolveAssets(html) {
  if (!html || !ASSET_BASE) return html;
  return String(html).replace(/(["'(])\/uploads\//g, `$1${ASSET_BASE}/uploads/`);
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('wc_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } else {
      const msg = error.response?.data?.message || error.message || '请求失败';
      ElMessage.error(msg);
    }
    return Promise.reject(error);
  }
);

export default api;
