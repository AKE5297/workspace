<template>
  <div class="page-container">
    <div class="page-header">
      <h2>设置</h2>
    </div>

    <el-card class="section-card">
      <template #header>外观</template>
      <el-form label-width="90px">
        <el-form-item label="主题色">
          <div class="theme-colors">
            <div
              v-for="(t, key) in settings.presets"
              :key="key"
              class="theme-dot"
              :style="{ background: t.color }"
              :class="{ active: settings.themeColor === t.color }"
              :title="t.label"
              @click="settings.setThemeColor(t.color)"
            >
              <el-icon v-if="settings.themeColor === t.color" color="#fff" size="14"><Check /></el-icon>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="深色模式">
          <el-radio-group :model-value="settings.darkMode" @change="settings.setDarkMode">
            <el-radio value="light">浅色</el-radio>
            <el-radio value="dark">深色</el-radio>
            <el-radio value="auto">跟随系统</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <template #header>品牌 Logo</template>
      <el-form label-width="110px">
        <el-form-item label="显示名称">
          <el-input v-model="form.logoText" placeholder="Web Clipper" maxlength="20" show-word-limit @change="saveLogo" />
        </el-form-item>
        <el-form-item label="Logo 图片">
          <div class="logo-editor">
            <img class="logo-preview" :src="form.logoUrl || '/icons/icon-192.png'" alt="logo preview" />
            <div class="logo-actions">
              <el-input v-model="form.logoUrl" placeholder="图片 URL，留空使用默认图标" clearable @change="saveLogo" />
              <div class="logo-btns">
                <el-upload :show-file-list="false" :before-upload="onLogoUpload" accept="image/*">
                  <el-button size="small" :loading="logoUploading">上传图片</el-button>
                </el-upload>
                <el-button size="small" @click="resetLogo">恢复默认</el-button>
              </div>
              <span class="form-tip">建议使用正方形图片，将同时作为侧边栏 Logo 与浏览器标签页图标</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <template #header>AI 功能</template>
      <el-form label-width="110px">
        <el-form-item label="自动摘要">
          <el-switch v-model="form.summaryEnabled" @change="saveSettings" />
          <span class="form-tip">保存剪藏后自动生成 200 字以内摘要</span>
        </el-form-item>
        <el-form-item label="智能标签">
          <el-switch v-model="form.tagEnabled" @change="saveSettings" />
          <span class="form-tip">根据内容语义推荐精准标签</span>
        </el-form-item>
        <el-form-item label="推荐标签数">
          <el-input-number v-model="form.tagCount" :min="1" :max="10" @change="saveSettings" />
        </el-form-item>
        <el-alert type="info" :closable="false" class="ai-tip">
          需要在后端环境变量中配置 USER_LLM_API_KEY 才能启用 AI 摘要与智能标签功能。
        </el-alert>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <template #header>Telegram 推送</template>
      <el-form label-width="110px">
        <el-form-item label="启用推送">
          <el-switch v-model="form.telegramEnabled" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="Bot Token">
          <el-input v-model="form.telegramBotToken" placeholder="配置在后端 TELEGRAM_BOT_TOKEN，此处显示为掩码" disabled />
        </el-form-item>
        <el-form-item label="接收 Chat ID">
          <el-input v-model="form.telegramChatId" placeholder="配置在后端 TELEGRAM_CHAT_ID，此处显示为掩码" disabled />
        </el-form-item>
        <el-form-item label="推送时段">
          <el-switch v-model="form.telegramPushWindow" @change="saveSettings" />
          <span class="form-tip">仅在设定时段内推送，避免非工作时间打扰</span>
        </el-form-item>
        <el-form-item v-if="form.telegramPushWindow" label="时段">
          <el-time-picker
            is-range
            v-model="pushTimeRange"
            format="HH:mm"
            value-format="HH:mm"
            range-separator="至"
            @change="onPushTimeChange"
          />
        </el-form-item>
        <el-form-item label="模板">
          <el-input v-model="form.telegramTemplate" type="textarea" :rows="4" placeholder="可用变量：{{title}} {{summary}} {{tags}} {{createdAt}} {{url}}" @change="saveSettings" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <template #header>邮件推送</template>
      <el-form label-width="110px">
        <el-form-item label="启用邮件">
          <el-switch v-model="form.emailEnabled" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="接收邮箱">
          <el-input v-model="form.emailRecipient" placeholder="接收通知的邮箱地址" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="推送模式">
          <el-radio-group v-model="form.emailMode" @change="saveSettings">
            <el-radio value="realtime">实时</el-radio>
            <el-radio value="daily">每日汇总</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-alert type="info" :closable="false" class="ai-tip">
          需要在后端环境变量中配置 SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS 才能发送邮件。
        </el-alert>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import { settingsApi, uploadApi } from '@/api';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();
const form = reactive({});
const pushTimeRange = ref(null);
const logoUploading = ref(false);

async function load() {
  const { data } = await settingsApi.get();
  Object.assign(form, data);
  if (data.telegramPushStart !== undefined && data.telegramPushEnd !== undefined) {
    pushTimeRange.value = [
      String(data.telegramPushStart).padStart(2, '0') + ':00',
      String(data.telegramPushEnd).padStart(2, '0') + ':00'
    ];
  }
}

async function saveSettings() {
  try {
    await settingsApi.update({ ...form, telegramBotToken: undefined });
    ElMessage.success('设置已保存');
  } catch (e) { /* ignore */ }
}

function onPushTimeChange(val) {
  if (!val) return;
  form.telegramPushStart = parseInt(val[0].split(':')[0], 10);
  form.telegramPushEnd = parseInt(val[1].split(':')[0], 10);
  saveSettings();
}

async function saveLogo() {
  await settings.setLogo({ url: form.logoUrl || '', text: form.logoText || '' });
  ElMessage.success('Logo 已更新');
}

async function onLogoUpload(file) {
  logoUploading.value = true;
  try {
    const { data } = await uploadApi.upload(file);
    form.logoUrl = data.url;
    await saveLogo();
  } catch (e) {
    ElMessage.error('Logo 上传失败');
  } finally {
    logoUploading.value = false;
  }
  return false;
}

function resetLogo() {
  form.logoUrl = '';
  form.logoText = 'Web Clipper';
  saveLogo();
}

onMounted(load);
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
}
.section-card {
  margin-bottom: 16px;
}
.theme-colors {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.theme-dot {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.2s;
}
.theme-dot:hover {
  transform: scale(1.15);
}
.theme-dot.active {
  border-color: var(--el-text-color-primary);
}
.form-tip {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.ai-tip {
  max-width: 480px;
}
.logo-editor {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.logo-preview {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
  padding: 4px;
}
.logo-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 360px;
  max-width: 100%;
}
.logo-btns {
  display: flex;
  gap: 8px;
}
</style>
