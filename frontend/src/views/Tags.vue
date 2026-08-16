<template>
  <div class="page-container">
    <div class="page-header">
      <h2>标签</h2>
      <div class="header-right">
        <el-input v-model="newTag" placeholder="新建标签" style="width: 180px" @keyup.enter="create" />
        <el-button type="primary" @click="create">创建</el-button>
      </div>
    </div>

    <div v-loading="loading">
      <div v-if="tags.length === 0" class="empty-state">
        <el-empty description="暂无标签" />
      </div>
      <div v-else class="tag-list">
        <div v-for="t in tags" :key="t.id" class="tag-card" @click="goTag(t.name)">
          <el-tag size="large" type="info" class="tag-name"># {{ t.name }}</el-tag>
          <span class="tag-count">{{ t.count }} 条剪藏</span>
          <el-button size="small" text type="danger" @click.stop="remove(t)">删除</el-button>
        </div>
      </div>
    </div>

    <div class="rss-block">
      <el-divider content-position="left">RSS 订阅</el-divider>
      <p class="rss-desc">
        选择标签或笔记本生成 RSS Feed，可在外部阅读器中订阅。
      </p>
      <div class="rss-actions">
        <el-select v-model="rssType" style="width: 120px">
          <el-option label="笔记本" value="notebook" />
          <el-option label="标签" value="tag" />
        </el-select>
        <el-select v-model="rssId" filterable placeholder="选择笔记本或标签" style="width: 220px">
          <template v-if="rssType === 'notebook'">
            <el-option v-for="nb in notebooks" :key="nb.id" :label="nb.name" :value="nb.id" />
          </template>
          <template v-else>
            <el-option v-for="t in tags" :key="t.name" :label="t.name" :value="t.name" />
          </template>
        </el-select>
        <el-select v-model="rssFormat" style="width: 120px">
          <el-option label="RSS 2.0" value="rss" />
          <el-option label="Atom" value="atom" />
        </el-select>
        <el-button @click="copyRss" :disabled="!rssId">复制订阅链接</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { tagApi, notebookApi } from '@/api';

const router = useRouter();
const tags = ref([]);
const notebooks = ref([]);
const newTag = ref('');
const loading = ref(false);
const rssType = ref('notebook');
const rssId = ref('');
const rssFormat = ref('rss');

const rssUrl = () => `${window.location.origin}/rss/${rssType.value}/${encodeURIComponent(rssId.value)}?format=${rssFormat.value}`;

async function load() {
  loading.value = true;
  try {
    const [t, nb] = await Promise.all([tagApi.list(), notebookApi.list()]);
    tags.value = t.data.items;
    notebooks.value = nb.data.items;
  } finally {
    loading.value = false;
  }
}

async function create() {
  const name = newTag.value.trim();
  if (!name) return ElMessage.warning('请输入标签名');
  try {
    await tagApi.create(name);
    newTag.value = '';
    ElMessage.success('标签已创建');
    load();
  } catch (e) {
    if (e.response?.status === 409) ElMessage.warning('标签已存在');
  }
}

async function remove(t) {
  try {
    await ElMessageBox.confirm(`删除标签「${t.name}」将从所有剪藏中移除该标签`, '删除标签', { type: 'warning' });
  } catch (e) {
    return;
  }
  await tagApi.remove(t.name);
  ElMessage.success('标签已删除');
  load();
}

function goTag(name) {
  router.push({ path: '/clips', query: { tag: name } });
}

async function copyRss() {
  try {
    await navigator.clipboard.writeText(rssUrl());
    ElMessage.success('订阅链接已复制');
  } catch (e) {
    ElMessage.warning('复制失败，请手动复制');
  }
}

onMounted(load);
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-header h2 {
  margin: 0;
}
.header-right {
  display: flex;
  gap: 8px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.tag-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  min-width: 180px;
}
.tag-card:hover {
  border-color: var(--el-color-primary);
}
.tag-count {
  flex: 1;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.rss-block {
  margin-top: 24px;
}
.rss-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.rss-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
