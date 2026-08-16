<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="brand">
        <el-icon :size="36" color="var(--wc-color)"><Scissor /></el-icon>
        <h2>Web Clipper</h2>
        <p>网页剪藏工具</p>
      </div>
      <el-tabs v-model="activeTab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form @submit.prevent="onLogin">
            <el-form-item>
              <el-input v-model="loginForm.username" placeholder="用户名" size="large" :prefix-icon="User" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="loginForm.password" type="password" placeholder="密码" size="large" :prefix-icon="Lock" show-password @keyup.enter="onLogin" />
            </el-form-item>
            <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onLogin">
              登录
            </el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form @submit.prevent="onRegister">
            <el-form-item>
              <el-input v-model="regForm.username" placeholder="用户名" size="large" :prefix-icon="User" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.email" placeholder="邮箱（可选）" size="large" :prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.password" type="password" placeholder="密码" size="large" :prefix-icon="Lock" show-password />
            </el-form-item>
            <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onRegister">
              注册
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Message } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const activeTab = ref('login');
const loading = ref(false);

const loginForm = reactive({ username: '', password: '' });
const regForm = reactive({ username: '', email: '', password: '' });

async function onLogin() {
  if (!loginForm.username || !loginForm.password) {
    return ElMessage.warning('请输入用户名和密码');
  }
  loading.value = true;
  try {
    await auth.login(loginForm.username, loginForm.password);
    ElMessage.success('登录成功');
    router.push('/clips');
  } catch (e) {
    /* 已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}

async function onRegister() {
  if (!regForm.username || !regForm.password) {
    return ElMessage.warning('请输入用户名和密码');
  }
  if (regForm.password.length < 6) {
    return ElMessage.warning('密码至少 6 位');
  }
  loading.value = true;
  try {
    await auth.register(regForm.username, regForm.password, regForm.email);
    ElMessage.success('注册成功');
    router.push('/clips');
  } catch (e) {
    /* 已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--wc-color-light-9, #ecf5ff), var(--el-bg-color-page));
}
.login-card {
  width: 380px;
  max-width: calc(100vw - 32px);
}
.brand {
  text-align: center;
  margin-bottom: 12px;
}
.brand h2 {
  margin: 8px 0 4px;
}
.brand p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
