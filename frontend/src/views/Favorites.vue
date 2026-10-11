<template>
  <div class="page-container">
    <div class="page-header">
      <h2>收藏</h2>
      <span class="count">共 {{ total }} 条</span>
    </div>

    <div v-loading="loading">
      <div v-if="clips.length === 0 && !loading" class="empty-state">
        <el-empty description="还没有收藏的剪藏，在列表或详情页点击收藏即可添加" />
      </div>
      <div v-else class="clip-list">
        <div
          v-for="clip in clips"
          :key="clip.id"
          class="clip-card"
          @click="$router.push(`/clip/${clip.id}`)"
        >
          <div class="clip-main">
            <div class="clip-title-row">
              <el-icon color="#e6a23c"><StarFilled /></el-icon>
              <span class="clip-title text-ellipsis">{{ clip.title }}</span>
            </div>
            <div v-if="clip.summary" class="clip-summary text-ellipsis-2">{{ clip.summary }}</div>
            <div class="clip-meta">
              <span v-if="clip.domain">{{ clip.domain }}</span>
              <span>{{ formatDay(clip.createdAt) }}</span>
            </div>
            <div v-if="clip.tags && clip.tags.length" class="clip-tags">
              <el-tag v-for="t in clip.tags.slice(0, 4)" :key="t" size="small" type="info">{{ t }}</el-tag>
            </div>
          </div>
        </div>
      </div>

      <div v-if="total > pageSize" class="pagination">
        <el-pagination layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPage" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { clipApi } from '@/api';
import { formatDay } from '@/utils/date';

const clips = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const { data } = await clipApi.list({ favorite: 'true', page: page.value, pageSize });
    clips.value = data.items;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '加载收藏失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

function onPage(p) {
  page.value = p;
  load();
}

onMounted(load);
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
}
.count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.clip-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.clip-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
}
.clip-card:hover {
  border-color: var(--el-color-primary);
}
.clip-main {
  flex: 1;
  min-width: 0;
}
.clip-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.clip-title {
  font-size: 15px;
  font-weight: 500;
}
.clip-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.clip-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.clip-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
