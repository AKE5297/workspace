<template>
  <div class="clip-editor">
    <el-form label-position="top">
      <el-form-item label="页面 URL">
        <div class="url-row">
          <el-input v-model="form.url" placeholder="输入或粘贴要剪藏的页面 URL" @blur="checkDuplicate" />
          <el-button v-if="form.url" @click="fetchPage" :loading="fetching">抓取内容</el-button>
        </div>
        <div v-if="wafHint" class="waf-hint">
          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              该站点有反爬验证/需要登录，服务端无法直接抓取。推荐使用浏览器扩展剪藏：
              扩展会自动滚动页面加载全文，把完整正文与图片保存进来。
              <el-link type="primary" @click="wafExpanded = !wafExpanded">{{ wafExpanded ? '收起' : '查看安装与使用方法' }}</el-link>
            </template>
            <ol v-if="wafExpanded" class="waf-steps">
              <li>Chrome/Edge 打开 <code>chrome://extensions</code>，开启右上角「开发者模式」</li>
              <li>点击「加载已解压的扩展程序」，选择项目 <code>extension</code> 目录</li>
              <li>打开扩展设置，填入服务器地址 <code>{{ previewHost }}</code> 和 API Token（设置页获取）</li>
              <li>在文章页点扩展图标 → 保存剪藏（默认自动滚动加载全文；长文也可右键页面 →「滚动加载全文后保存」）</li>
            </ol>
          </el-alert>
        </div>
        <div v-if="duplicateInfo" class="dup-warning">
          <el-alert type="warning" :closable="false" show-icon>
            <template #title>
              该页面已被剪藏：<strong>{{ duplicateInfo.title }}</strong>
              （保存于 {{ formatDate(duplicateInfo.createdAt) }}）
            </template>
          </el-alert>
          <div class="dup-actions">
            <el-button size="small" type="primary" @click="continueSave">仍然保存</el-button>
            <el-button size="small" @click="duplicateInfo = null; cancelByDup = true">取消</el-button>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="剪藏标题" />
      </el-form-item>

      <el-form-item label="作者">
        <el-input v-model="form.author" placeholder="作者（可选）" />
      </el-form-item>

      <el-form-item label="笔记本">
        <el-select v-model="form.notebookId" clearable placeholder="选择笔记本" style="width: 100%">
          <el-option v-for="nb in notebooks" :key="nb.id" :label="nb.name" :value="nb.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="标签">
        <div class="tag-input">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入后回车创建标签"
            style="width: 100%"
          />
          <el-button v-if="form.text && settings.tagEnabled" size="small" @click="recommendTags" :loading="aiTagLoading">
            AI 推荐标签
          </el-button>
        </div>
        <div v-if="recommendedTags.length" class="rec-tags">
          <span class="rec-label">推荐：</span>
          <el-tag
            v-for="t in recommendedTags"
            :key="t"
            size="small"
            class="rec-tag"
            :type="form.tags.includes(t) ? 'success' : 'info'"
            @click="addTag(t)"
          >
            + {{ t }}
          </el-tag>
        </div>
      </el-form-item>

      <el-form-item label="正文内容">
        <el-input
          v-model="form.text"
          type="textarea"
          :rows="8"
          placeholder="剪藏正文内容"
          @input="scheduleDraftSave"
        />
      </el-form-item>

      <el-form-item label="原文 HTML">
        <el-input v-model="form.content" type="textarea" :rows="5" placeholder="原文 HTML（可选）" />
      </el-form-item>

      <el-form-item v-if="settings.summaryEnabled" label="AI 摘要">
        <div class="summary-row">
          <el-input v-model="form.summary" type="textarea" :rows="3" placeholder="留空则保存时自动生成" />
          <el-button v-if="form.text" size="small" @click="genSummary" :loading="aiSummaryLoading">生成摘要</el-button>
        </div>
      </el-form-item>
    </el-form>

    <div class="editor-footer">
      <el-button @click="saveDraft">存为草稿</el-button>
      <span class="spacer" />
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { clipApi, tagApi, extractApi } from '@/api';
import { useSettingsStore } from '@/stores/settings';
import { useLocalDrafts } from '@/stores/localDrafts';

const props = defineProps({
  clipId: { type: String, default: null },
  initial: { type: Object, default: null },
  notebooks: { type: Array, default: () => [] }
});
const emit = defineEmits(['saved', 'close']);

const settings = useSettingsStore();
const { saveDraft: saveLocalDraft, remove: removeLocalDraft } = useLocalDrafts();
const form = reactive({
  title: '',
  url: '',
  author: '',
  notebookId: null,
  tags: [],
  text: '',
  content: '',
  summary: ''
});

const fetching = ref(false);
const saving = ref(false);
const duplicateInfo = ref(null);
const wafHint = ref(false);
const wafExpanded = ref(false);
const cancelByDup = ref(false);
const recommendedTags = ref([]);
const aiTagLoading = ref(false);
const aiSummaryLoading = ref(false);
let draftTimer = null;
const draftSaved = ref(false);

const previewHost = computed(() => window.location.origin);

const isEdit = computed(() => Boolean(props.clipId));

onMounted(() => {
  if (props.initial) {
    Object.assign(form, {
      title: props.initial.title || '',
      url: props.initial.url || '',
      author: props.initial.author || '',
      notebookId: props.initial.notebookId || null,
      tags: props.initial.tags || [],
      text: props.initial.text || props.initial.excerpt || '',
      content: props.initial.content || '',
      summary: props.initial.summary || ''
    });
  }
});

async function checkDuplicate() {
  if (!form.url || isEdit.value) return;
  try {
    const { data } = await clipApi.checkDuplicate(form.url);
    if (data.duplicated) {
      duplicateInfo.value = data;
    }
  } catch (e) { /* ignore */ }
}

async function fetchPage() {
  if (!form.url) return ElMessage.warning('请先输入 URL');
  fetching.value = true;
  try {
    const { data } = await extractApi.extract(form.url);
    form.url = data.url || form.url;
    form.title = data.title || form.title;
    form.author = data.author || form.author;
    form.text = data.text || form.text;
    form.content = data.content || form.content;
    if (form.title && form.text) {
      ElMessage.success('内容抓取成功');
    } else {
      ElMessage.warning('抓取到页面但未能提取正文，请检查内容后手动补充');
    }
  } catch (e) {
    const msg = e.response?.data?.message || '无法抓取该链接，请手动填写内容';
    wafHint.value = msg.includes('扩展剪藏');
    ElMessage.warning(msg);
  } finally {
    fetching.value = false;
  }
}

async function recommendTags() {
  if (!form.text && !form.title) return ElMessage.warning('请先填写内容');
  aiTagLoading.value = true;
  try {
    const { data } = await tagApi.recommend({ text: form.text, title: form.title });
    recommendedTags.value = data.tags || [];
  } catch (e) {
    ElMessage.warning('标签推荐失败：' + e.message);
  } finally {
    aiTagLoading.value = false;
  }
}

function addTag(t) {
  if (!form.tags.includes(t)) {
    form.tags = [...form.tags, t];
  }
}

async function genSummary() {
  if (!form.text) return ElMessage.warning('请先填写内容');
  aiSummaryLoading.value = true;
  try {
    let clipId = props.clipId;
    if (!clipId) {
      const { data } = await clipApi.create({
        title: form.title || '未命名剪藏',
        url: form.url,
        author: form.author,
        notebookId: form.notebookId,
        tags: form.tags,
        text: form.text,
        content: form.content,
        summary: form.summary,
        autoSummary: false
      });
      clipId = data.clip.id;
      generatedClipId.value = clipId;
      draftDbid.value = null;
    }
    const { data } = await clipApi.generateSummary(clipId);
    form.summary = data.summary || '';
    ElMessage.success(data.summary ? '摘要已生成' : '摘要生成失败，请检查 LLM 配置');
  } catch (e) {
    ElMessage.warning('摘要生成失败：' + e.message);
  } finally {
    aiSummaryLoading.value = false;
  }
}

function continueSave() {
  duplicateInfo.value = null;
  save();
}

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    saveDraft(true);
  }, 2000);
}

async function saveDraft(silent = false) {
  if (!form.title && !form.url && !form.text) return;
  const { id } = saveLocalDraft({
    id: draftDbid.value || undefined,
    title: form.title,
    url: form.url,
    text: form.text,
    content: form.content,
    tags: form.tags,
    notebookId: form.notebookId
  });
  draftDbid.value = id;
  draftSaved.value = true;
  if (!silent) ElMessage.success('已保存为草稿（本地）');
}

const draftDbid = ref(null);
const generatedClipId = ref(null);
async function save() {
  if (cancelByDup.value) return;
  if (!form.title && !form.text && !form.url) {
    return ElMessage.warning('标题、内容或 URL 至少填写一项');
  }
  saving.value = true;
  try {
    const payload = {
      title: form.title || '未命名剪藏',
      url: form.url,
      author: form.author,
      notebookId: form.notebookId,
      tags: form.tags,
      text: form.text,
      content: form.content,
      summary: form.summary,
      autoSummary: settings.summaryEnabled && !form.summary
    };
    if (isEdit.value || generatedClipId.value) {
      await clipApi.update(generatedClipId.value || props.clipId, payload);
    } else {
      const { data } = await clipApi.create(payload);
      if (data.duplicated) {
        // 用户已确认继续保存
      }
    }
    if (draftDbid.value) {
      removeLocalDraft(draftDbid.value);
    }
    ElMessage.success(isEdit.value ? '剪藏已更新' : '剪藏已保存');
    emit('saved');
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<style scoped>
.clip-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.url-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.waf-hint {
  margin-top: 8px;
}
.waf-steps {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--el-text-color-regular);
}
.waf-steps code {
  background: var(--el-fill-color-light);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}
.dup-warning {
  margin-top: 8px;
}
.dup-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.tag-input {
  display: flex;
  gap: 8px;
  width: 100%;
}
.rec-tags {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.rec-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.rec-tag {
  cursor: pointer;
}
.summary-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.editor-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}
.spacer {
  flex: 1;
}
</style>
