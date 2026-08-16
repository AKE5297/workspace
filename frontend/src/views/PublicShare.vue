<template>
  <div class="share-page" v-loading="loading">
    <div v-if="error" class="error-box">
      <el-result icon="error" :title="error" />
    </div>
    <template v-else-if="clip">
      <div class="share-header">
        <h1>{{ clip.title }}</h1>
        <div class="share-meta">
          <span v-if="clip.author">作者：{{ clip.author }}</span>
          <span>保存于 {{ formatDate(clip.createdAt) }}</span>
        </div>
        <div v-if="clip.tags && clip.tags.length" class="share-tags">
          <el-tag v-for="t in clip.tags" :key="t" size="small" type="info">{{ t }}</el-tag>
        </div>
        <div v-if="clip.url">
          <el-link type="primary" :href="clip.url" target="_blank">查看原文</el-link>
        </div>
      </div>
      <div v-if="clip.summary" class="summary-box">
        <div class="summary-label">摘要</div>
        <p>{{ clip.summary }}</p>
      </div>
      <div class="share-content">
        <div v-if="clip.content" class="content-html" v-html="clip.content"></div>
        <div v-else class="content-text" v-html="renderText"></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { shareApi } from '@/api';

const route = useRoute();
const clip = ref(null);
const loading = ref(true);
const error = ref('');

const renderText = computed(() => (clip.value?.text || '').replace(/\n/g, '<br/>'));

async function load() {
  loading.value = true;
  try {
    const { data } = await shareApi.getPublic(route.params.code);
    clip.value = data.clip;
  } catch (e) {
    error.value = e.response?.data?.message || '分享链接不存在或已失效';
  } finally {
    loading.value = false;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(load);
</script>

<style scoped>
.share-page {
  max-width: 820px;
  margin: 0 auto;
  padding: 32px 16px;
}
.share-header {
  margin-bottom: 20px;
}
.share-header h1 {
  font-size: 26px;
  margin: 0 0 10px;
}
.share-meta {
  display: flex;
  gap: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 10px;
}
.share-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.summary-box {
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}
.summary-label {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-color-primary);
}
.summary-box p {
  margin: 0;
}
.share-content {
  line-height: 1.9;
  font-size: 16px;
}
.content-html :deep(img) {
  max-width: 100%;
}
.error-box {
  padding: 60px 0;
}
</style>
