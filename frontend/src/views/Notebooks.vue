<template>
  <div class="page-container">
    <div class="page-header">
      <h2>笔记本</h2>
      <el-button type="primary" @click="openCreate">新建笔记本</el-button>
    </div>

    <el-tree
      :data="tree"
      :props="{ label: 'name', children: 'children' }"
      node-key="id"
      :expand-on-click-node="false"
      class="nb-tree"
    >
      <template #default="{ data }">
        <div class="tree-node">
          <el-icon><Folder /></el-icon>
          <span class="node-name" @click="goNotebook(data.id)">{{ data.name }}</span>
          <span class="node-count">{{ data.count }}</span>
          <span class="node-actions">
            <el-button size="small" text @click.stop="openCreate(data.id)">子笔记本</el-button>
            <el-button size="small" text @click.stop="openEdit(data)">编辑</el-button>
            <el-button size="small" text type="danger" @click.stop="removeNotebook(data)">删除</el-button>
          </span>
        </div>
      </template>
    </el-tree>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑笔记本' : '新建笔记本'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="笔记本名称" />
        </el-form-item>
        <el-form-item v-if="!editing" label="父级">
          <el-select v-model="form.parentId" clearable placeholder="无（顶级）" style="width: 100%">
            <el-option v-for="nb in notebooks" :key="nb.id" :label="nb.name" :value="nb.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { notebookApi } from '@/api';

const router = useRouter();
const notebooks = ref([]);
const tree = ref([]);
const dialogVisible = ref(false);
const editing = ref(null);
const saving = ref(false);
const form = reactive({ name: '', parentId: null });

async function load() {
  const { data } = await notebookApi.list();
  notebooks.value = data.items;
  tree.value = data.tree;
}

function openCreate(parentId) {
  editing.value = null;
  form.name = '';
  form.parentId = parentId || null;
  dialogVisible.value = true;
}

function openEdit(nb) {
  editing.value = nb;
  form.name = nb.name;
  form.parentId = nb.parentId;
  dialogVisible.value = true;
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('请输入名称');
  saving.value = true;
  try {
    if (editing.value) {
      await notebookApi.update(editing.value.id, { name: form.name, parentId: form.parentId });
    } else {
      await notebookApi.create({ name: form.name, parentId: form.parentId });
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function removeNotebook(nb) {
  try {
    const { value } = await ElMessageBox.confirm(
      `删除「${nb.name}」时如何处理子笔记本及内容？`,
      '删除笔记本',
      {
        distinguishCancelAndClose: true,
        confirmButtonText: '级联删除子笔记本',
        cancelButtonText: '转移并删除',
        type: 'warning'
      }
    );
    await notebookApi.remove(nb.id, { cascade: true });
  } catch (action) {
    if (action === 'cancel') {
      await notebookApi.remove(nb.id, { cascade: false });
    } else {
      return;
    }
  }
  ElMessage.success('已删除');
  load();
}

function goNotebook(id) {
  router.push({ path: '/clips', query: { notebookId: id } });
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
.nb-tree {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 8px;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding-right: 8px;
}
.node-name {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.node-name:hover {
  color: var(--el-color-primary);
}
.node-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.node-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.tree-node:hover .node-actions {
  opacity: 1;
}
@media (max-width: 768px) {
  .node-actions {
    opacity: 1;
  }
}
</style>
