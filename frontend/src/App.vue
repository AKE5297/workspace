<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

onMounted(() => {
  settings.loadTheme();
});
</script>
