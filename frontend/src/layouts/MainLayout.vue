<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="desktop-only aside">
      <div class="logo">
        <el-icon :size="22" color="var(--wc-color)"><Scissor /></el-icon>
        <span>Web Clipper</span>
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
        :class="{ active: activeMenu === tab.path }"
        @click="goTab(tab.path)"
      >
        <el-icon :size="22"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </div>
    </nav>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const tabs = [
  { path: '/clips', label: '首页', icon: 'HomeFilled' },
  { path: '/notebooks', label: '笔记本', icon: 'Folder' },
  { path: '/tags', label: '标签', icon: 'PriceTag' },
  { path: '/favorites', label: '收藏', icon: 'Star' },
  { path: '/settings', label: '我的', icon: 'User' }
];

const activeMenu = computed(() => {
  const p = route.path;
  if (p.startsWith('/knowledge')) return '/knowledge';
  if (p.startsWith('/rag')) return '/rag';
  if (p.startsWith('/notebooks')) return '/notebooks';
  if (p.startsWith('/tags')) return '/tags';
  if (p.startsWith('/favorites')) return '/favorites';
  if (p.startsWith('/settings')) return '/settings';
  return '/clips';
});

const initial = computed(() => (auth.user?.username || 'U').charAt(0).toUpperCase());

function goTab(path) {
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
</style>
