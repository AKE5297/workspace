<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="desktop-only aside">
      <div class="logo">
        <img v-if="settings.logoUrl" :src="settings.logoUrl" class="logo-img" alt="logo" />
        <el-icon v-else :size="22" color="var(--wc-color)"><Scissor /></el-icon>
        <span v-if="settings.logoText">{{ settings.logoText }}</span>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item index="/clips"><el-icon><Collection /></el-icon>剪藏列表</el-menu-item>
        <el-menu-item index="/knowledge"><el-icon><Notebook /></el-icon>知识库</el-menu-item>
        <el-menu-item index="/rag"><el-icon><ChatDotRound /></el-icon>智能问答</el-menu-item>
        <el-menu-item index="/notebooks"><el-icon><Folder /></el-icon>笔记本</el-menu-item>
        <el-menu-item index="/tags"><el-icon><PriceTag /></el-icon>标签</el-menu-item>
        <el-menu-item index="/favorites"><el-icon><Star /></el-icon>收藏</el-menu-item>
        <el-menu-item index="/drafts"><el-icon><EditPen /></el-icon>草稿箱</el-menu-item>
        <el-menu-item index="/stats"><el-icon><TrendCharts /></el-icon>统计</el-menu-item>
        <el-menu-item index="/recycle"><el-icon><Delete /></el-icon>回收站</el-menu-item>
        <el-menu-item index="/shares"><el-icon><Share /></el-icon>分享管理</el-menu-item>
        <el-menu-item index="/settings"><el-icon><Setting /></el-icon>设置</el-menu-item>
      </el-menu>
      <div class="aside-footer">
        <el-dropdown @command="onCommand">
          <span class="user-chip">
            <el-avatar :size="28">{{ initial }}</el-avatar>
            <span class="username">{{ auth.user?.username }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-aside>

    <el-container class="body">
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>

    <nav class="mobile-only mobile-tab">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ active: tabActive(tab) }"
        @click="goTab(tab)"
      >
        <el-icon :size="22"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </div>
    </nav>

    <el-drawer v-model="moreVisible" direction="btt" size="40%" :with-header="false" class="more-drawer">
      <div class="more-grid">
        <div
          v-for="m in moreMenu"
          :key="m.path"
          class="more-item"
          :class="{ active: activeMenu === m.path }"
          @click="goMore(m.path)"
        >
          <el-icon :size="22"><component :is="m.icon" /></el-icon>
          <span>{{ m.label }}</span>
        </div>
      </div>
    </el-drawer>
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();

const tabs = [
  { path: '/clips', label: '首页', icon: 'HomeFilled' },
  { path: '/notebooks', label: '笔记本', icon: 'Folder' },
  { path: '/tags', label: '标签', icon: 'PriceTag' },
  { path: '/favorites', label: '收藏', icon: 'Star' },
  { path: '__more__', label: '更多', icon: 'Menu' }
];

const moreMenu = [
  { path: '/knowledge', label: '知识库', icon: 'Notebook' },
  { path: '/rag', label: '智能问答', icon: 'ChatDotRound' },
  { path: '/drafts', label: '草稿箱', icon: 'EditPen' },
  { path: '/stats', label: '统计', icon: 'TrendCharts' },
  { path: '/recycle', label: '回收站', icon: 'Delete' },
  { path: '/shares', label: '分享管理', icon: 'Share' },
  { path: '/settings', label: '设置', icon: 'Setting' }
];

const moreVisible = ref(false);

const menuPaths = [
  '/clips',
  '/notebooks',
  '/tags',
  '/knowledge',
  '/rag',
  '/favorites',
  '/drafts',
  '/stats',
  '/recycle',
  '/shares',
  '/settings'
];

const activeMenu = computed(() => {
  const p = route.path;
  for (const path of menuPaths) {
    if (p === path || p.startsWith(`${path}/`)) return path;
  }
  if (p.startsWith('/clip/')) return '/clips';
  return '/clips';
});

const initial = computed(() => (auth.user?.username || 'U').charAt(0).toUpperCase());

function tabActive(tab) {
  if (tab.path === '__more__') return moreMenu.some((m) => m.path === activeMenu.value);
  return activeMenu.value === tab.path;
}

function goTab(tab) {
  if (tab.path === '__more__') {
    moreVisible.value = true;
    return;
  }
  router.push(tab.path);
}

function goMore(path) {
  moreVisible.value = false;
  router.push(path);
}

function onCommand(cmd) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.main-layout {
  height: 100%;
}
.aside {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.logo-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  border-radius: 6px;
}
.menu {
  border-right: none;
  flex: 1;
  overflow-y: auto;
}
.aside-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}
.username {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.main-content {
  padding: 0;
  height: 100vh;
  overflow-y: auto;
}
@media (max-width: 768px) {
  .main-content {
    /* 为固定底部 Tab 预留空间，避免内容被遮挡 */
    padding-bottom: calc(56px + env(safe-area-inset-bottom));
  }
}
.mobile-tab {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0 6px;
  gap: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.tab-item.active {
  color: var(--el-color-primary);
}
.more-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px 4px;
}
.more-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 4px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.more-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.more-item:active {
  background: var(--el-fill-color-light);
}
</style>
