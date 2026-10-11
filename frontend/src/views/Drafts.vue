<template>
  <div class="page-container">
    <div class="page-header">
      <h2>草稿箱</h2>
      <span class="desc">未完成保存的剪藏草稿，保存在本地，不占用服务器资源</span>
    </div>

    <div v-loading="loading">
      <div v-if="drafts.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无草稿" />
      </div>
      <div v-else class="draft-list">
        <div v-for="d in drafts" :key="d.id" class="draft-card">
          <div class="draft-main" @click="continueEdit(d)">
            <div class="draft-title text-ellipsis">{{ d.title || '未命名剪藏' }}</div>
            <div v-if="d.url" class="draft-url text-ellipsis">{{ d.url }}</div>
            <div v-if="d.text" class="draft-excerpt text-ellipsis-2">{{ d.text }}</div>
            <div class="draft-meta">
              <span>编辑于 {{ formatDateTime(d.updatedAt) }}</span>
              <span v-if="d.tags && d.tags.length">标签：{{ d.tags.join(', ') }}</span>
            </div>
          </div>
          <div class="draft-actions">
            <el-button size="small" type="primary" @click="continueEdit(d)">继续编辑</el-button>
            <el-button size="small" type="danger" @click="removeDraft(d)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-drawer v-model="editVisible" title="继续编辑草稿" size="min(720px, 92vw)" :before-close="confirmCloseEditor">
      <ClipEditor
        v-if="editVisible"
        ref="editorRef"
        :initial="editingDraft"
        :notebooks="notebooks"
        @saved="onSaved"
        @close="editVisible = false"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { notebookApi } from '@/api';
import { useLocalDrafts } from '@/stores/localDrafts';
import { formatDateTime } from '@/utils/date';
import ClipEditor from '@/components/ClipEditor.vue';

const { list, remove } = useLocalDrafts();
const drafts = ref([]);
const notebooks = ref([]);
const loading = ref(false);
const editVisible = ref(false);
const editingDraft = ref(null);
const editorRef = ref(null);

async function load() {
  loading.value = true;
  try {
    drafts.value = list();
  } finally {
    loading.value = false;
  }
}

async function loadNotebooks() {
  try {
    const { data } = await notebookApi.list();
    notebooks.value = data.items;
  } catch (e) { /* ignore */ }
}

function continueEdit(d) {
  editingDraft.value = {
    ...d,
    tags: d.tags || []
  };
  editVisible.value = true;
}

async function removeDraft(d) {
  try {
    await ElMessageBox.confirm('确定删除该草稿？', '删除草稿', { type: 'warning' });
  } catch (e) {
    return;
  }
  remove(d.id);
  ElMessage.success('草稿已删除');
  load();
}

function onSaved() {
  editVisible.value = false;
  load();
}

function confirmCloseEditor(done) {
  if (editorRef.value?.isDirty?.()) {
    ElMessageBox.confirm('有未保存的修改，确定放弃？', '放弃修改', { type: 'warning' })
      .then(() => done())
      .catch(() => {});
  } else {
    done();
  }
}

onMounted(() => {
  load();
  loadNotebooks();
});
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0 0 4px;
}
.desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.draft-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.draft-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.draft-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.draft-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
}
.draft-url {
  color: var(--el-color-primary);
  font-size: 12px;
  margin-bottom: 4px;
}
.draft-excerpt {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.draft-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.draft-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>
