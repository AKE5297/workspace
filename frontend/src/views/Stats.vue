<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <h2>阅读统计</h2>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.todayReads || 0 }}</div>
        <div class="stat-label">今日阅读</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.weekReads || 0 }}</div>
        <div class="stat-label">本周阅读</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalReads || 0 }}</div>
        <div class="stat-label">累计阅读</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalClips || 0 }}</div>
        <div class="stat-label">剪藏总数</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">近 30 天剪藏趋势</div>
        <div ref="trendRef" class="chart"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">标签分布</div>
        <div ref="tagRef" class="chart"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">笔记本容量</div>
        <div ref="nbRef" class="chart"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">阅读时间分布（按周几和时段）</div>
        <div ref="heatRef" class="chart"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { statsApi } from '@/api';

const stats = ref({});
const loading = ref(true);
const trendRef = ref();
const tagRef = ref();
const nbRef = ref();
const heatRef = ref();
let charts = [];

async function load() {
  loading.value = true;
  try {
    const { data } = await statsApi.get();
    stats.value = data;
    renderCharts(data);
  } finally {
    loading.value = false;
  }
}

function renderCharts(data) {
  charts.forEach((c) => c?.dispose());
  charts = [];

  if (trendRef.value) {
    const c = echarts.init(trendRef.value);
    c.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: data.monthTrend.map((i) => i.date.slice(5)), axisLabel: { interval: 4 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'line',
        smooth: true,
        data: data.monthTrend.map((i) => i.count),
        areaStyle: { opacity: 0.15 }
      }]
    });
    charts.push(c);
  }

  if (tagRef.value && data.tagDistribution.length) {
    const c = echarts.init(tagRef.value);
    c.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        data: data.tagDistribution,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } }
      }]
    });
    charts.push(c);
  } else if (tagRef.value) {
    const c = echarts.init(tagRef.value);
    c.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: '暂无标签数据', fill: '#909399' } }] });
    charts.push(c);
  }

  if (nbRef.value) {
    const c = echarts.init(nbRef.value);
    c.setOption({
      tooltip: {},
      grid: { left: 70, right: 16, top: 16, bottom: 30 },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: data.notebookBars.map((i) => i.name), axisLabel: { width: 60, overflow: 'truncate' } },
      series: [{ type: 'bar', data: data.notebookBars.map((i) => i.value), barMaxWidth: 18 }]
    });
    charts.push(c);
  }

  if (heatRef.value) {
    const c = echarts.init(heatRef.value);
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const hours = Array.from({ length: 24 }, (_, i) => `${i}时`);
    const maxV = Math.max(1, ...data.heatmap.flat());
    c.setOption({
      tooltip: { position: 'top' },
      grid: { left: 40, right: 16, top: 16, bottom: 60 },
      xAxis: { type: 'category', data: hours, splitArea: { show: true } },
      yAxis: { type: 'category', data: weekDays, splitArea: { show: true } },
      visualMap: { min: 0, max: maxV, calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
      series: [{
        type: 'heatmap',
        data: data.heatmap.flatMap((row, y) => row.map((v, x) => [x, y, v])),
        label: { show: false }
      }]
    });
    charts.push(c);
  }
}

function onResize() {
  charts.forEach((c) => c?.resize());
}

onMounted(() => {
  load();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  charts.forEach((c) => c?.dispose());
});
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
}
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--el-color-primary);
}
.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 4px;
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.chart-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
}
.chart-title {
  font-weight: 500;
  margin-bottom: 12px;
  font-size: 14px;
}
.chart {
  height: 300px;
}
@media (max-width: 900px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
