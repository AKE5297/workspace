<template>
  <div class="page-container">
    <div class="page-header">
      <h2>分享管理</h2>
    </div>

    <div v-loading="loading">
      <div v-if="items.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无分享链接，在剪藏详情页可开启分享" />
      </div>
      <div v-else class="share-list">
        <div v-for="s in items" :key="s.id" class="share-card">
          <div class="share-main">
            <div class="share-title text-ellipsis">
              {{ s.clipTitle }}
              <el-tag :type="s.active ? 'success' : 'danger'" size="small">{{ s.active ? '有效' : '已失效' }}</el-tag>
            </div>
            <div class="share-meta">
              <span>创建于 {{ formatDay(s.createdAt) }}</span>
              <span v-if="s.expiresAt">有效期至 {{ formatDay(s.expiresAt) }}</span>
              <span v-else>永久有效</span>
              <span v-if="s.viewCount">访问 {{ s.viewCount }} 次</span>
            </div>
            <div class="share-url text-ellipsis">{{ shareUrl(s.code) }}</div>
          </div>
          <div class="share-actions">
            <el-button size="small" @click="copy(s)">复制链接</el-button>
            <el-button size="small" type="warning" @click="toggle(s)">{{ s.active ? '关闭' : '开启' }}</el-button>
            <el-button size="small" type="danger" @click="remove(s)">删除</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { shareApi } from '@/api';
import { formatDay } from '@/utils/date';

const items = ref([]);
const loading = ref(false);

const shareUrl = (code) => `${window.location.origin}/share/${code}`;

async function load() {
  loading.value = true;
  try {
    const { data } = await shareApi.list();
    items.value = data.items;
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '加载分享列表失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

async function copy(s) {
  try {
    await navigator.clipboard.writeText(shareUrl(s.code));
    ElMessage.success('链接已复制');
  } catch (e) {
    ElMessage.warning('复制失败');
  }
}

async function toggle(s) {
  await shareApi.toggle(s.id);
  s.active = !s.active;
  ElMessage.success(s.active ? '分享已开启' : '分享已关闭');
}

async function remove(s) {
  try {
    await ElMessageBox.confirm('删除后该分享链接立即失效，确定继续？', '删除分享', { type: 'warning' });
  } catch (e) {
    return;
  }
  await shareApi.remove(s.id);
  ElMessage.success('分享已删除');
  load();
}

onMounted(load);
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
}
.share-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.share-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.share-main {
  flex: 1;
  min-width: 0;
}
.share-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.share-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.share-url {
  font-size: 12px;
  color: var(--el-color-primary);
}
.share-actions {
  display: flex;
  gap: 4px;
  align-items: flex-start;
}
</style>
