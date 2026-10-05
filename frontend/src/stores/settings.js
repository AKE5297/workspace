import { defineStore } from 'pinia';
import { settingsApi } from '@/api';

const PRESET_THEMES = {
  '#409eff': { label: '默认蓝', color: '#409eff' },
  '#67c23a': { label: '清新绿', color: '#67c23a' },
  '#e6a23c': { label: '活力橙', color: '#e6a23c' },
  '#f56c6c': { label: '热情红', color: '#f56c6c' },
  '#9c27b0': { label: '高贵紫', color: '#9c27b0' },
  '#00bcd4': { label: '科技青', color: '#00bcd4' },
  '#ff7043': { label: '暖阳橙红', color: '#ff7043' },
  '#607d8b': { label: '沉稳灰蓝', color: '#607d8b' }
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    themeColor: '#409eff',
    darkMode: 'light',
    presets: PRESET_THEMES,
    summaryEnabled: true,
    tagEnabled: true,
    tagCount: 5,
    logoUrl: '',
    logoText: 'Web Clipper',
    loaded: false
  }),
  actions: {
    applyLogo() {
      const url = this.logoUrl || '/icons/icon-192.png';
      const link = document.querySelector("link[rel='icon']") || document.getElementById('site-favicon');
      if (link) {
        link.href = url;
      } else {
        const el = document.createElement('link');
        el.rel = 'icon';
        el.id = 'site-favicon';
        el.href = url;
        document.head.appendChild(el);
      }
    },
    applyTheme() {
      const root = document.documentElement;
      root.style.setProperty('--wc-color', this.themeColor);
      root.style.setProperty('--wc-color-light', this.lighten(this.themeColor, 30));
      root.style.setProperty('--wc-color-lighter', this.lighten(this.themeColor, 55));
      root.style.setProperty('--wc-color-dark', this.darken(this.themeColor, 15));
      root.style.setProperty('--el-color-primary', this.themeColor);
      root.style.setProperty('--el-color-primary-light-3', this.lighten(this.themeColor, 30));
      root.style.setProperty('--el-color-primary-light-5', this.lighten(this.themeColor, 50));
      root.style.setProperty('--el-color-primary-light-7', this.lighten(this.themeColor, 70));
      root.style.setProperty('--el-color-primary-light-8', this.lighten(this.themeColor, 80));
      root.style.setProperty('--el-color-primary-light-9', this.lighten(this.themeColor, 90));
      root.style.setProperty('--el-color-primary-dark-2', this.darken(this.themeColor, 20));
      const meta = document.getElementById('meta-theme-color');
      if (meta) meta.content = this.themeColor;
    },
    applyDark() {
      const root = document.documentElement;
      if (this.darkMode === 'dark') {
        root.classList.add('dark');
      } else if (this.darkMode === 'auto') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', dark);
      } else {
        root.classList.remove('dark');
      }
    },
    lighten(hex, percent) {
      const { r, g, b } = this.hexToRgb(hex);
      const f = (v) => Math.round(v + (255 - v) * (percent / 100));
      return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
    },
    darken(hex, percent) {
      const { r, g, b } = this.hexToRgb(hex);
      const f = (v) => Math.round(v * (1 - percent / 100));
      return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
    },
    hexToRgb(hex) {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
      };
    },
    loadTheme() {
      const localColor = localStorage.getItem('wc_theme_color');
      if (localColor) this.themeColor = localColor;
      const localDark = localStorage.getItem('wc_dark_mode');
      if (localDark) this.darkMode = localDark;
      const localLogo = localStorage.getItem('wc_logo_url');
      if (localLogo !== null) this.logoUrl = localLogo;
      const localLogoText = localStorage.getItem('wc_logo_text');
      if (localLogoText !== null) this.logoText = localLogoText;
      this.applyTheme();
      this.applyDark();
      this.applyLogo();
    },
    async fetchRemote() {
      try {
        const { data } = await settingsApi.get();
        this.themeColor = data.themeColor || this.themeColor;
        this.darkMode = data.darkMode || this.darkMode;
        this.summaryEnabled = data.summaryEnabled;
        this.tagEnabled = data.tagEnabled;
        this.tagCount = data.tagCount;
        this.logoUrl = data.logoUrl || '';
        this.logoText = data.logoText || 'Web Clipper';
        this.loaded = true;
        localStorage.setItem('wc_theme_color', this.themeColor);
        localStorage.setItem('wc_dark_mode', this.darkMode);
        localStorage.setItem('wc_logo_url', this.logoUrl);
        localStorage.setItem('wc_logo_text', this.logoText);
        this.applyTheme();
        this.applyDark();
        this.applyLogo();
      } catch (e) {
        /* 未登录时忽略 */
      }
    },
    async setThemeColor(color) {
      this.themeColor = color;
      localStorage.setItem('wc_theme_color', color);
      this.applyTheme();
      try {
        await settingsApi.update({ themeColor: color });
      } catch (e) { /* ignore */ }
    },
    async setDarkMode(mode) {
      this.darkMode = mode;
      localStorage.setItem('wc_dark_mode', mode);
      this.applyDark();
      try {
        await settingsApi.update({ darkMode: mode });
      } catch (e) { /* ignore */ }
    },
    async setLogo({ url, text } = {}) {
      if (url !== undefined) this.logoUrl = url || '';
      if (text !== undefined) this.logoText = text;
      localStorage.setItem('wc_logo_url', this.logoUrl);
      localStorage.setItem('wc_logo_text', this.logoText);
      this.applyLogo();
      try {
        await settingsApi.update({ logoUrl: this.logoUrl, logoText: this.logoText });
      } catch (e) { /* ignore */ }
    }
  }
});
