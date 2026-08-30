<template>
  <div class="knowledge-page">
    <div class="header">
      <h2>知识库</h2>
      <p class="sub">跨全部剪藏的整合检索与来源统计</p>
    </div>

    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-num">{{ stats.totals?.clips ?? '-' }}</div>
        <div class="stat-label">剪藏总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.totals?.tags ?? '-' }}</div>
        <div class="stat-label">标签数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.totals?.domains ?? '-' }}</div>
        <div class="stat-label">来源站点</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ formatChars(stats.totals?.chars) }}</div>
        <div class="stat-label">累计字数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.totals?.months ?? '-' }}</div>
        <div class="stat-label">覆盖月份</div>
      </div>
    </div>

    <div class="search-box">
      <el-input
        v-model="query"
        placeholder="在全库中搜索标题、正文、标签、作者…"
        clearable
        :prefix-icon="Search"
        @keyup.enter="doSearch"
        @clear="clearSearch"
      >
        <template #append>
          <el-button :icon="Search" @click="doSearch">搜索</el-button>
        </template>
      </el-input>
    </div>

    <div v-if="searching" class="search-result" v-loading="searching">
      <template v-if="results.length">
        <div class="result-summary">共 {{ results.length }} 条匹配结果</div>
        <div v-for="r in results" :key="r.id" class="result-item" @click="openClip(r)">
          <div class="result-title">
            <el-icon v-if="r.isFavorite || r.favorite" color="#e6a23c"><StarFilled /></el-icon>
            {{ r.title }}
          </div>
          <div v-if="r.excerpt" class="result-excerpt">{{ r.excerpt }}</div>
          <div class="result-meta">
            <span v-if="r.domain">{{ r.domain }}</span>
            <span v-if="r.author">{{ r.author }}</span>
            <span>{{ formatDate(r.createdAt) }}</span>
            <span v-if="r.notebookName" class="nb-tag">{{ r.notebookName }}</span>
          </div>
        </div>
      </template>
      <el-empty v-else description="没有匹配的剪藏" />
    </div>

    <div class="charts-row" v-if="!searching">
      <div class="chart-card">
        <div class="chart-title">按来源站点</div>
        <div ref="domainChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">按标签</div>
        <div ref="tagChart" class="chart"></div>
      </div>
    </div>
    <div class="chart-card full" v-if="!searching">
      <div class="chart-title">剪藏趋势（按月）</div>
      <div ref="monthChart" class="chart"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Search, StarFilled } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { clipApi, knowledgeApi, notebookApi } from '@/api';

const router = useRouter();
const stats = ref({});
const query = ref('');
const results = ref([]);
const searching = ref(false);
const nbMap = ref({});

const domainChart = ref(null);
const tagChart = ref(null);
const monthChart = ref(null);
let charts = [];

function formatChars(n) {
  if (n == null) return '-';
  if (n >= 10000) return (n / 10000).toFixed(1) + ' 万';
  if (n >= 1000) return (n / 1000).toFixed(1) + ' 千';
  return n;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderCharts() {
  charts.forEach((c) => c?.dispose());
  charts = [];

  const base = (el, option) => {
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption(option);
    charts.push(chart);
    window.addEventListener('resize', chart.resize);
  };

  base(domainChart.value, {
    tooltip: { trigger: 'axis' },
    grid: { left: 20, right: 30, top: 10, bottom: 30, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { color: 'var(--el-border-color-lighter)' } }
    },
    yAxis: {
      type: 'category',
      data: (stats.value.byDomain || []).map((d) => d.key).reverse(),
      axisLabel: { fontSize: 11 }
    },
    series: [
      {
        type: 'bar',
        data: (stats.value.byDomain || []).map((d) => d.value).reverse(),
        itemStyle: { color: '#409eff', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18
      }
    ]
  });

  base(tagChart.value, {
    tooltip: { trigger: 'axis' },
    grid: { left: 20, right: 30, top: 10, bottom: 30, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { color: 'var(--el-border-color-lighter)' } }
    },
    yAxis: {
      type: 'category',
      data: (stats.value.byTag || []).map((t) => t.key).reverse(),
      axisLabel: { fontSize: 11 }
    },
    series: [
      {
        type: 'bar',
        data: (stats.value.byTag || []).map((t) => t.value).reverse(),
        itemStyle: { color: '#67c23a', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18
      }
    ]
  });

  base(monthChart.value, {
    tooltip: { trigger: 'axis' },
    grid: { left: 20, right: 20, top: 10, bottom: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: (stats.value.byMonth || []).map((m) => m.key),
      axisLabel: { fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { color: 'var(--el-border-color-lighter)' } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        data: (stats.value.byMonth || []).map((m) => m.value),
        itemStyle: { color: '#409eff' },
        areaStyle: { color: 'rgba(64, 158, 255, 0.12)' }
      }
    ]
  });
}

async function loadStats() {
  try {
    const { data } = await knowledgeApi.stats();
    stats.value = data;
    requestAnimationFrame(renderCharts);
  } catch (e) { /* ignore */ }
}

async function doSearch() {
  const q = query.value.trim();
  if (!q) return;
  searching.value = true;
  try {
    const { data } = await clipApi.list({ q, pageSize: 50 });
    results.value = data.items.map((c) => ({
      ...c,
      notebookName: nbMap.value[c.notebookId] || ''
    }));
  } catch (e) {
    ElMessage.error('搜索失败');
  } finally {
    searching.value = false;
  }
}

function clearSearch() {
  results.value = [];
  searching.value = false;
}

function openClip(r) {
  router.push(`/clip/${r.id}`);
}

onMounted(() => {
  loadStats();
  notebookApi
    .list()
    .then(({ data }) => {
      nbMap.value = Object.fromEntries((data.items || []).map((nb) => [nb.id, nb.name]));
    })
    .catch(() => {});
});

onUnmounted(() => {
  charts.forEach((c) => {
    window.removeEventListener('resize', c.resize);
    c.dispose();
  });
  charts = [];
});
</script>

<style scoped>
.knowledge-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
}
.header h2 {
  margin: 0 0 4px;
}
.sub {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.stat-num {
  font-size: 26px;
  font-weight: 700;
  color: var(--el-color-primary);
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.search-box {
  margin-bottom: 20px;
}
.search-result {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
  min-height: 80px;
}
.result-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}
.result-item {
  padding: 12px 8px;
  border-radius: 6px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.result-item:hover {
  background: var(--el-fill-color-light);
}
.result-item:last-child {
  border-bottom: none;
}
.result-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 500;
}
.result-excerpt {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 6px 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.result-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-wrap: wrap;
}
.nb-tag {
  color: var(--el-color-primary);
}
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.chart-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 16px;
}
.chart-card.full {
  margin-bottom: 16px;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.chart {
  width: 100%;
  height: 260px;
}
@media (max-width: 768px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}
</style>
