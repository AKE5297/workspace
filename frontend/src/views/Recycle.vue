<template>
  <div class="page-container">
    <div class="page-header">
      <h2>回收站</h2>
      <div>
        <el-button type="danger" plain @click="purgeAll" :disabled="items.length === 0">清空回收站</el-button>
      </div>
    </div>

    <div v-loading="loading">
      <div v-if="items.length === 0 && !loading" class="empty-state">
        <el-empty description="回收站是空的" />
      </div>
      <template v-else>
        <div class="batch-bar">
          <el-checkbox :model-value="selected.length === items.length && items.length > 0" @change="toggleAll">全选</el-checkbox>
          <el-button size="small" type="primary" :disabled="!selected.length" @click="restoreSelected">恢复所选</el-button>
          <el-button size="small" type="danger" :disabled="!selected.length" @click="purgeSelected">永久删除</el-button>
          <span class="hint">条目保留 30 天，到期自动永久删除</span>
        </div>

        <div class="item-list">
          <div v-for="item in items" :key="item.id" class="item-card">
            <el-checkbox :model-value="selected.includes(item.id)" @change="(v) => toggleSelect(item.id, v)" />
            <div class="item-main">
              <div class="item-title text-ellipsis">{{ item.clip?.title || '已删除条目' }}</div>
              <div class="item-meta">
                <span>删除于 {{ formatDate(item.deletedAt) }}</span>
                <span>剩余 {{ item.remainDays }} 天</span>
                <el-tag size="small" type="info">{{ item.clip?.notebookName || '未分类' }}</el-tag>
              </div>
            </div>
            <div class="item-actions">
              <el-button size="small" type="primary" @click="restoreOne(item)">恢复</el-button>
              <el-button size="small" type="danger" @click="purgeOne(item)">永久删除</el-button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { recycleApi } from '@/api';

const items = ref([]);
const selected = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const { data } = await recycleApi.list();
    items.value = data.items;
  } finally {
    loading.value = false;
  }
}

function toggleSelect(id, v) {
  if (v) {
    if (!selected.value.includes(id)) selected.value = [...selected.value, id];
  } else {
    selected.value = selected.value.filter((s) => s !== id);
  }
}

function toggleAll(v) {
  selected.value = v ? items.value.map((i) => i.id) : [];
}

async function restoreSelected() {
  await recycleApi.restore(selected.value);
  ElMessage.success('已恢复');
  selected.value = [];
  load();
}

async function restoreOne(item) {
  await recycleApi.restore([item.id]);
  ElMessage.success('已恢复');
  load();
}

async function purgeSelected() {
  try {
    await ElMessageBox.confirm('永久删除后无法恢复，确定继续？', '永久删除', { type: 'error' });
  } catch (e) {
    return;
  }
  await recycleApi.purge(selected.value);
  ElMessage.success('已永久删除');
  selected.value = [];
  load();
}

async function purgeOne(item) {
  try {
    await ElMessageBox.confirm('永久删除后无法恢复，确定继续？', '永久删除', { type: 'error' });
  } catch (e) {
    return;
  }
  await recycleApi.purge([item.id]);
  ElMessage.success('已永久删除');
  load();
}

async function purgeAll() {
  try {
    await ElMessageBox.confirm(`确定清空回收站（共 ${items.value.length} 条）？无法恢复。`, '清空回收站', { type: 'error' });
  } catch (e) {
    return;
  }
  await recycleApi.purgeAll();
  ElMessage.success('回收站已清空');
  load();
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
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.item-main {
  flex: 1;
  min-width: 0;
}
.item-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
}
.item-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  align-items: center;
}
.item-actions {
  display: flex;
  gap: 4px;
}
</style>
