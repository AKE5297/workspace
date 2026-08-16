<template>
  <div class="page-container">
    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索剪藏（支持标题、正文、标签）"
        clearable
        class="search-input"
        :prefix-icon="Search"
        @keyup.enter="loadClips"
        @clear="loadClips"
      />
      <el-button type="primary" :icon="Plus" @click="openCreate">新建剪藏</el-button>
    </div>

    <div class="filter-row">
      <el-select v-model="filters.notebookId" placeholder="全部笔记本" clearable style="width: 160px" @change="loadClips">
        <el-option v-for="nb in notebooks" :key="nb.id" :label="nb.name" :value="nb.id" />
      </el-select>
      <el-select v-model="filters.tag" placeholder="全部标签" clearable style="width: 140px" @change="loadClips">
        <el-option v-for="t in tags" :key="t.name" :label="t.name" :value="t.name" />
      </el-select>
      <el-select v-model="filters.sort" style="width: 140px" @change="loadClips">
        <el-option label="最新优先" value="newest" />
        <el-option label="最早优先" value="oldest" />
        <el-option label="阅读最多" value="read" />
      </el-select>
      <span class="spacer" />
      <span class="kbd-hint desktop-only">
        快捷键：<span class="kbd">J</span> 下移 <span class="kbd">K</span> 上移
        <span class="kbd">S</span> 收藏 <span class="kbd">D</span> 删除
        <span class="kbd">E</span> 编辑 <span class="kbd">Esc</span> 取消
      </span>
    </div>

    <div v-if="selectedIds.length" class="batch-bar">
      <el-checkbox :model-value="allSelected" @change="toggleAll">
        已选 {{ selectedIds.length }} 项
      </el-checkbox>
      <el-button size="small" type="primary" @click="openBatchEdit">批量编辑</el-button>
      <el-button size="small" @click="batchFavorite(true)">批量收藏</el-button>
      <el-button size="small" @click="batchFavorite(false)">取消收藏</el-button>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" text @click="selectedIds = []">取消选择</el-button>
    </div>

    <div v-loading="loading">
      <div v-if="clips.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无剪藏，点击「新建剪藏」开始收藏你的第一篇内容" />
      </div>

      <div v-else class="clip-list">
        <div
          v-for="clip in clips"
          :key="clip.id"
          class="clip-card"
          :class="{ selected: selectedIds.includes(clip.id) }"
          @click="selectClip(clip)"
          @dblclick="openDetail(clip)"
        >
          <el-checkbox
            :model-value="selectedIds.includes(clip.id)"
            class="clip-check"
            @change="(v) => toggleSelect(clip, v)"
            @click.stop
          />
          <div class="clip-main">
            <div class="clip-title-row">
              <el-icon v-if="clip.isFavorite || clip.favorite" color="#e6a23c" class="fav-icon"><StarFilled /></el-icon>
              <span class="clip-title text-ellipsis">{{ clip.title }}</span>
            </div>
            <div v-if="clip.summary" class="clip-summary text-ellipsis-2">{{ clip.summary }}</div>
            <div v-else-if="clip.excerpt" class="clip-summary text-ellipsis-2">{{ clip.excerpt }}</div>
            <div class="clip-meta">
              <span v-if="clip.domain" class="meta-item">{{ clip.domain }}</span>
              <span v-if="clip.author" class="meta-item">{{ clip.author }}</span>
              <span class="meta-item">{{ formatDate(clip.createdAt) }}</span>
              <span v-if="clip.readCount" class="meta-item"><el-icon><View /></el-icon>{{ clip.readCount }}</span>
            </div>
            <div v-if="clip.tags && clip.tags.length" class="clip-tags">
              <el-tag v-for="t in clip.tags.slice(0, 4)" :key="t" size="small" type="info" class="tag">{{ t }}</el-tag>
            </div>
          </div>
          <div class="clip-actions" @click.stop>
            <el-button circle size="small" :type="clip.isFavorite || clip.favorite ? 'warning' : 'default'" @click="toggleFavorite(clip)">
              <el-icon><Star /></el-icon>
            </el-button>
            <el-button circle size="small" @click="openDetail(clip)">
              <el-icon><View /></el-icon>
            </el-button>
            <el-button circle size="small" @click="openEdit(clip)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button circle size="small" type="danger" @click="removeClip(clip)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="total > pageSize" class="pagination">
        <el-pagination
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPage"
        />
      </div>
    </div>

    <el-drawer v-model="editVisible" :title="editingId ? '编辑剪藏' : '新建剪藏'" size="min(720px, 92vw)">
      <ClipEditor
        v-if="editVisible"
        :clip-id="editingId"
        :initial="editingClip"
        :notebooks="notebooks"
        @saved="onSaved"
        @close="editVisible = false"
      />
    </el-drawer>

    <el-dialog v-model="batchVisible" title="批量编辑" width="480px">
      <el-form label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="batchForm.title" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="batchForm.author" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="笔记本">
          <el-select v-model="batchForm.notebookId" clearable placeholder="选择笔记本" style="width: 100%">
            <el-option v-for="nb in notebooks" :key="nb.id" :label="nb.name" :value="nb.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="batchForm.tags" multiple filterable allow-create default-first-option placeholder="选择或输入标签" style="width: 100%" />
        </el-form-item>
        <el-form-item label="标签模式">
          <el-radio-group v-model="batchForm.tagMode">
            <el-radio value="append">追加</el-radio>
            <el-radio value="overwrite">覆盖</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="doBatchEdit">确认修改 {{ selectedIds.length }} 项</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import { clipApi, notebookApi, tagApi, batchApi } from '@/api';
import { useSettingsStore } from '@/stores/settings';
import ClipEditor from '@/components/ClipEditor.vue';

const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();

const clips = ref([]);
const notebooks = ref([]);
const tags = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const searchQuery = ref('');
const filters = reactive({ notebookId: '', tag: '', sort: 'newest' });
const selectedIds = ref([]);
const lastSelectedIndex = ref(-1);

const editVisible = ref(false);
const editingId = ref(null);
const editingClip = ref(null);

const batchVisible = ref(false);
const batchLoading = ref(false);
const batchForm = reactive({ title: '', author: '', notebookId: null, tags: [], tagMode: 'append' });

const allSelected = computed(
  () => clips.value.length > 0 && selectedIds.value.length === clips.value.length
);

async function loadClips() {
  loading.value = true;
  try {
    const params = {
      page: page.value,
      pageSize,
      sort: filters.sort
    };
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim();
    if (filters.notebookId) params.notebookId = filters.notebookId;
    if (filters.tag) params.tag = filters.tag;
    const { data } = await clipApi.list(params);
    clips.value = data.items;
    total.value = data.total;
    selectedIds.value = selectedIds.value.filter((id) => data.items.some((c) => c.id === id));
  } finally {
    loading.value = false;
  }
}

async function loadMeta() {
  try {
    const [nb, tg] = await Promise.all([notebookApi.list(), tagApi.list()]);
    notebooks.value = nb.data.items;
    tags.value = tg.data.items;
  } catch (e) { /* ignore */ }
}

function onPage(p) {
  page.value = p;
  loadClips();
}

function selectClip(clip) {
  const idx = clips.value.findIndex((c) => c.id === clip.id);
  const isSelected = selectedIds.value.includes(clip.id);
  if (isSelected) {
    selectedIds.value = selectedIds.value.filter((id) => id !== clip.id);
  } else {
    selectedIds.value = [...selectedIds.value, clip.id];
  }
  lastSelectedIndex.value = idx;
}

function toggleSelect(clip, v) {
  if (v) {
    if (!selectedIds.value.includes(clip.id)) selectedIds.value = [...selectedIds.value, clip.id];
  } else {
    selectedIds.value = selectedIds.value.filter((id) => id !== clip.id);
  }
}

function toggleAll(v) {
  if (v) {
    selectedIds.value = clips.value.map((c) => c.id);
  } else {
    selectedIds.value = [];
  }
}

async function toggleFavorite(clip) {
  const { data } = await clipApi.toggleFavorite(clip.id);
  clip.isFavorite = data.isFavorite;
  clip.favorite = data.isFavorite;
}

async function removeClip(clip) {
  try {
    await ElMessageBox.confirm(`确定删除「${clip.title}」？将移入回收站`, '删除确认', { type: 'warning' });
  } catch (e) {
    return;
  }
  await clipApi.remove(clip.id);
  ElMessage.success('已移入回收站');
  loadClips();
}

async function batchFavorite(v) {
  await batchApi.favorite(selectedIds.value, v);
  ElMessage.success(v ? '已收藏' : '已取消收藏');
  loadClips();
}

async function batchDelete() {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条剪藏？将移入回收站`, '批量删除', { type: 'warning' });
  } catch (e) {
    return;
  }
  await batchApi.remove(selectedIds.value);
  ElMessage.success('已删除');
  selectedIds.value = [];
  loadClips();
}

function openBatchEdit() {
  batchForm.title = '';
  batchForm.author = '';
  batchForm.notebookId = null;
  batchForm.tags = [];
  batchForm.tagMode = 'append';
  batchVisible.value = true;
}

async function doBatchEdit() {
  const data = {};
  if (batchForm.title) data.title = batchForm.title;
  if (batchForm.author) data.author = batchForm.author;
  if (batchForm.notebookId) data.notebookId = batchForm.notebookId;
  if (batchForm.tags.length) {
    data.tags = batchForm.tags;
    data.tagMode = batchForm.tagMode;
  }
  if (!Object.keys(data).length) {
    return ElMessage.warning('请至少填写一个要修改的字段');
  }
  batchLoading.value = true;
  try {
    const { data: res } = await batchApi.edit(selectedIds.value, data);
    ElMessage.success(`修改成功：${res.success} 项${res.failed.length ? `，失败 ${res.failed.length} 项` : ''}`);
    batchVisible.value = false;
    selectedIds.value = [];
    loadClips();
  } finally {
    batchLoading.value = false;
  }
}

function openDetail(clip) {
  router.push(`/clip/${clip.id}`);
}

function openCreate() {
  editingId.value = null;
  editingClip.value = null;
  editVisible.value = true;
}

function openEdit(clip) {
  editingId.value = clip.id;
  editingClip.value = clip;
  editVisible.value = true;
}

function onSaved() {
  editVisible.value = false;
  loadClips();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  const key = e.key.toLowerCase();
  if (editVisible.value || batchVisible.value) {
    if (key === 'escape') {
      if (editVisible.value) editVisible.value = false;
      if (batchVisible.value) batchVisible.value = false;
    }
    return;
  }
  if (key === 'j') {
    const next = Math.min(lastSelectedIndex.value + 1, clips.value.length - 1);
    if (next >= 0 && clips.value[next]) selectClip(clips.value[next]);
    lastSelectedIndex.value = Math.max(next, 0);
    scrollToSelected();
  } else if (key === 'k') {
    const next = Math.max(lastSelectedIndex.value - 1, 0);
    if (clips.value[next]) selectClip(clips.value[next]);
    lastSelectedIndex.value = next;
    scrollToSelected();
  } else if (key === 's' && lastSelectedIndex.value >= 0) {
    const clip = clips.value[lastSelectedIndex.value];
    if (clip) toggleFavorite(clip);
  } else if (key === 'd' && lastSelectedIndex.value >= 0) {
    const clip = clips.value[lastSelectedIndex.value];
    if (clip) removeClip(clip);
  } else if (key === 'e' && lastSelectedIndex.value >= 0) {
    const clip = clips.value[lastSelectedIndex.value];
    if (clip) openEdit(clip);
  } else if (key === 'escape') {
    selectedIds.value = [];
    lastSelectedIndex.value = -1;
  }
}

function scrollToSelected() {
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.clip-card');
    const target = cards[lastSelectedIndex.value];
    if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

onMounted(() => {
  if (route.query.notebookId) filters.notebookId = route.query.notebookId;
  if (route.query.tag) filters.tag = route.query.tag;
  loadClips();
  loadMeta();
  window.addEventListener('keydown', handleKeydown);
});

watch(
  () => route.query,
  () => {
    if (route.query.notebookId) filters.notebookId = route.query.notebookId;
    if (route.query.tag) filters.tag = route.query.tag;
    page.value = 1;
    loadClips();
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.search-input {
  flex: 1;
  max-width: 480px;
}
.filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.kbd-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--el-color-primary);
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
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
  transition: box-shadow 0.2s;
}
.clip-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.clip-check {
  padding-top: 4px;
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
.fav-icon {
  flex-shrink: 0;
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
  flex-wrap: wrap;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.clip-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.clip-actions {
  display: flex;
  gap: 4px;
  align-items: flex-start;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
