import axios from 'axios';
import { ElMessage } from 'element-plus';

const api = axios.create({
  baseURL: '/api',
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
