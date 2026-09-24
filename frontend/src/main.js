import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import router from './router';
import './styles/theme.css';
import './styles/global.css';

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

app.mount('#app');

// 动态 import 的 chunk 加载失败（依赖哈希更新、Service Worker 旧缓存等）时自动刷新一次恢复
let recovering = false;
function recoverFromChunkError() {
  if (recovering) return;
  try {
    const key = 'wc_chunk_recover_at';
    const last = Number(sessionStorage.getItem(key) || 0);
    // 10 秒内只恢复一次，避免持续失败导致无限刷新
    if (Date.now() - last < 10000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch (e) {
    /* sessionStorage 不可用时仍允许恢复一次 */
  }
  recovering = true;
  window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  recoverFromChunkError();
});

router.onError((error) => {
  const message = String((error && error.message) || '');
  if (/dynamically imported module|Importing a module script failed|Outdated Optimize Dep|Failed to fetch/i.test(message)) {
    recoverFromChunkError();
  }
});

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    // 开发环境不启用 Service Worker：其缓存会与 Vite HMR / 依赖预构建冲突
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
  }
}
