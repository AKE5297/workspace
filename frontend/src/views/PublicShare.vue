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
          <span>保存于 {{ formatDateTime(clip.createdAt) }}</span>
          <span v-if="viewCount">访问 {{ viewCount }} 次</span>
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
        <div v-if="clip.content" class="content-html" v-html="displayContent"></div>
        <div v-else class="content-text" v-html="renderText"></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { shareApi } from '@/api';
import { resolveAssets } from '@/api/client';
import { formatDateTime } from '@/utils/date';

const route = useRoute();
const clip = ref(null);
const loading = ref(true);
const error = ref('');
const viewCount = ref(0);

const renderText = computed(() => resolveAssets((clip.value?.text || '').replace(/\n/g, '<br/>')));
const displayContent = computed(() => resolveAssets(clip.value?.content || ''));

async function load() {
  loading.value = true;
  try {
    const { data } = await shareApi.getPublic(route.params.code);
    clip.value = data.clip;
    viewCount.value = data.viewCount || 0;
  } catch (e) {
    error.value = e.response?.data?.message || '分享链接不存在或已失效';
  } finally {
    loading.value = false;
  }
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
  border-radius: 6px;
}
.content-html :deep(h1),
.content-html :deep(h2),
.content-html :deep(h3),
.content-html :deep(h4) {
  margin: 1.2em 0 0.6em;
  line-height: 1.5;
}
.content-html :deep(h2) {
  border-bottom: 1px solid var(--el-border-color-light);
  padding-bottom: 0.3em;
}
.content-html :deep(p) {
  margin: 0.8em 0;
}
.content-html :deep(pre) {
  background: var(--el-fill-color-light);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.6;
  font-size: 14px;
}
.content-html :deep(code) {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}
.content-html :deep(pre code) {
  background: transparent;
  padding: 0;
}
.content-html :deep(blockquote) {
  border-left: 4px solid var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  margin: 0.8em 0;
  padding: 8px 16px;
  border-radius: 4px;
  color: var(--el-text-color-regular);
}
.content-html :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
}
.content-html :deep(th),
.content-html :deep(td) {
  border: 1px solid var(--el-border-color-light);
  padding: 8px 12px;
  text-align: left;
}
.content-html :deep(ul),
.content-html :deep(ol) {
  padding-left: 1.6em;
  margin: 0.8em 0;
}
.content-html :deep(a) {
  color: var(--el-color-primary);
  word-break: break-all;
}
.content-html :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color-light);
  margin: 1.5em 0;
}
.error-box {
  padding: 60px 0;
}
</style>
