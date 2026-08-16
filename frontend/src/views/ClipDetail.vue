<template>
  <div class="detail-page" v-loading="loading">
    <template v-if="clip">
      <div class="detail-header">
        <el-button text :icon="ArrowLeft" @click="$router.push('/clips')">返回列表</el-button>
        <div class="header-actions">
          <el-button size="small" @click="shareVisible = true" :icon="Share">分享</el-button>
          <el-button size="small" @click="toggleReadingMode" :type="readingMode ? 'primary' : 'default'" :icon="Reading">
            阅读模式
          </el-button>
          <el-button
            size="small"
            :type="clip.isFavorite || clip.favorite ? 'warning' : 'default'"
            @click="toggleFavorite"
          >
            <el-icon><Star /></el-icon> {{ clip.isFavorite || clip.favorite ? '已收藏' : '收藏' }}
          </el-button>
          <el-button size="small" type="primary" @click="editVisible = true">编辑</el-button>
          <el-button size="small" type="danger" @click="remove">删除</el-button>
        </div>
      </div>

      <div class="detail-content" :class="{ 'reading-mode': readingMode }">
        <h1 class="detail-title">{{ clip.title }}</h1>
        <div class="detail-meta">
          <span v-if="clip.domain">{{ clip.domain }}</span>
          <span v-if="clip.author">作者：{{ clip.author }}</span>
          <span>保存于 {{ formatDate(clip.createdAt) }}</span>
          <span v-if="clip.readCount">阅读 {{ clip.readCount }} 次</span>
        </div>
        <div v-if="clip.tags && clip.tags.length" class="detail-tags">
          <el-tag v-for="t in clip.tags" :key="t" size="small" type="info">{{ t }}</el-tag>
        </div>

        <div v-if="clip.url" class="original-link">
          <el-link type="primary" :href="clip.url" target="_blank">
            <el-icon><Link /></el-icon> 查看原文
          </el-link>
        </div>

        <div v-if="clip.summary" class="summary-box">
          <div class="summary-label"><el-icon><Document /></el-icon> AI 摘要</div>
          <p>{{ clip.summary }}</p>
        </div>

        <el-divider v-if="readingMode && clip.content" />
        <div v-if="readingMode && clip.content" class="reader-html" v-html="clip.content"></div>

        <div v-else-if="clip.text" class="plain-text" v-html="renderText"></div>
      </div>
    </template>

    <el-drawer v-model="editVisible" title="编辑剪藏" size="min(720px, 92vw)">
      <ClipEditor
        v-if="editVisible"
        :clip-id="clip.id"
        :initial="clip"
        :notebooks="notebooks"
        @saved="reload"
        @close="editVisible = false"
      />
    </el-drawer>

    <el-dialog v-model="shareVisible" title="剪藏分享" width="420px">
      <template v-if="clip">
        <el-alert type="info" :closable="false">
          开启后将生成公开只读链接，任何人均可通过该链接访问。
        </el-alert>
        <div style="margin-top: 12px">
          <el-form label-width="90px">
            <el-form-item label="有效期">
              <el-select v-model="expiresIn">
                <el-option label="永久有效" :value="null" />
                <el-option label="1 天" :value="1" />
                <el-option label="7 天" :value="7" />
                <el-option label="30 天" :value="30" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
        <template v-if="shareLink">
          <el-input :model-value="shareLink" readonly class="share-input">
            <template #append>
              <el-button @click="copyLink">复制</el-button>
            </template>
          </el-input>
          <el-button type="danger" plain size="small" style="margin-top: 8px" @click="disableShare">关闭分享</el-button>
        </template>
        <template v-else>
          <el-button type="primary" style="margin-top: 12px" :loading="shareLoading" @click="createShare">
            生成分享链接
          </el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, Share, Reading, Star, Link, Document } from '@element-plus/icons-vue';
import { clipApi, notebookApi, shareApi } from '@/api';
import ClipEditor from '@/components/ClipEditor.vue';

const route = useRoute();
const router = useRouter();
const clip = ref(null);
const notebooks = ref([]);
const loading = ref(true);
const readingMode = ref(false);
const editVisible = ref(false);
const shareVisible = ref(false);
const shareLoading = ref(false);
const shareLink = ref('');
const expiresIn = ref(null);

const renderText = computed(() => {
  if (!clip.value?.text) return '';
  return clip.value.text.replace(/\n/g, '<br/>');
});

async function load() {
  loading.value = true;
  try {
    const { data } = await clipApi.get(route.params.id);
    clip.value = data;
    clipApi.recordRead(route.params.id).catch(() => {});
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

function reload() {
  editVisible.value = false;
  load();
}

async function toggleFavorite() {
  const { data } = await clipApi.toggleFavorite(clip.value.id);
  clip.value.isFavorite = data.isFavorite;
  clip.value.favorite = data.isFavorite;
}

async function remove() {
  try {
    await ElMessageBox.confirm(`确定删除「${clip.value.title}」？将移入回收站`, '删除确认', { type: 'warning' });
  } catch (e) {
    return;
  }
  await clipApi.remove(clip.value.id);
  ElMessage.success('已删除');
  router.push('/clips');
}

async function createShare() {
  shareLoading.value = true;
  try {
    const { data } = await shareApi.create({
      clipId: clip.value.id,
      expiresIn: expiresIn.value
    });
    shareLink.value = `${window.location.origin}/share/${data.share.code}`;
  } finally {
    shareLoading.value = false;
  }
}

async function disableShare() {
  const { data } = await shareApi.create({ clipId: clip.value.id });
  // 需要 toggle 关闭
  const list = await shareApi.list();
  const item = list.data.items.find((s) => s.clipId === clip.value.id);
  if (item) {
    await shareApi.toggle(item.id);
  }
  shareLink.value = '';
  ElMessage.success('分享已关闭');
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    ElMessage.success('链接已复制');
  } catch (e) {
    ElMessage.warning('复制失败，请手动复制');
  }
}

function toggleReadingMode() {
  readingMode.value = !readingMode.value;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
  load();
  loadNotebooks();
});
</script>

<style scoped>
.detail-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  min-height: 100%;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-content {
  padding: 24px;
  border-radius: 10px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  line-height: 1.8;
}
.detail-title {
  margin: 0 0 12px;
  font-size: 24px;
}
.detail-meta {
  display: flex;
  gap: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.detail-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.original-link {
  margin-bottom: 16px;
}
.summary-box {
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
}
.summary-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-color-primary);
}
.summary-box p {
  margin: 0;
  color: var(--el-text-color-regular);
}
.reading-mode {
  background: var(--el-bg-color);
  font-size: 17px;
  line-height: 2;
}
.reader-html img {
  max-width: 100%;
}
.reader-html :deep(img) {
  max-width: 100%;
}
.plain-text {
  word-break: break-word;
  white-space: normal;
}
.share-input {
  margin-top: 12px;
}
</style>
