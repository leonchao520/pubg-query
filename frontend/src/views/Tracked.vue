<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { t } from '@/i18n'
import { searchPlayerFull } from '@/api'

const trackedList = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const refreshing = ref(false)
const adding = ref(false)
const addName = ref('')
const addError = ref('')

// 历史...
type TrendData = { snapshot_time: number; kd: number; wins: number; matches_played: number; kills: number; ban_type: string; }
const showTrend = ref(false)
const trendName = ref('')
const trendData = ref<TrendData[]>([])
const trendLoading = ref(false)

async function loadTracked() {
  loading.value = true
  try {
    const res = await fetch('/api/tracked')
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    trackedList.value = json.data || []
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function addPlayer() {
  if (!addName.value.trim()) return
  adding.value = true
  addError.value = ''
  try {
    // 先查询验证玩家是否存在
    await searchPlayerFull(addName.value.trim())
    
    const res = await fetch('/api/tracked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName.value.trim() })
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    
    addName.value = ''
    await loadTracked()
  } catch (e: any) {
    addError.value = e.message
  } finally {
    adding.value = false
  }
}

async function removePlayer(name: string) {
  try {
    const res = await fetch('/api/tracked', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    await loadTracked()
  } catch (e: any) {
    error.value = e.message
  }
}

async function batchRefresh() {
  refreshing.value = true
  error.value = ''
  try {
    const res = await fetch('/api/tracked/refresh', { method: 'POST' })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    await loadTracked()
  } catch (e: any) {
    error.value = e.message
  } finally {
    refreshing.value = false
  }
}

async function loadTrend(name: string) {
  showTrend.value = true
  trendName.value = name
  trendLoading.value = true
  try {
    // 先触发查询获取历史数据
    const result = await searchPlayerFull(name)
    if (result.history && result.history.length > 0) {
      trendData.value = result.history
    } else {
      trendData.value = []
    }
  } catch {
    trendData.value = []
  } finally {
    trendLoading.value = false
  }
}

const trendKD = computed(() => {
  const d = trendData.value
  if (!d.length) return ''
  const maxKd = Math.max(...d.map(x => x.kd), 1)
  return d.map((p, i) => {
    const x = (i / Math.max(d.length - 1, 1)) * 300
    const y = 120 - (p.kd / maxKd) * 100 - 10
    return x + ',' + y
  }).join(' ')
})

const trendKills = computed(() => {
  const d = trendData.value
  if (!d.length) return ''
  const maxK = Math.max(...d.map(x => x.kills), 1)
  return d.map((p, i) => {
    const x = (i / Math.max(d.length - 1, 1)) * 300
    const y = 120 - (p.kills / maxK) * 100 - 10
    return x + ',' + y
  }).join(' ')
})

const trendAxisLabels = computed(() => {
  const d = trendData.value
  if (!d.length) return []
  const step = Math.max(Math.floor(d.length / 5), 1)
  return d.filter((_, i) => i % step === 0 || i === d.length - 1)
})

function formatTime(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(() => loadTracked())
</script>

<template>
  <div class="page-container">
    <div class="title-section">
      <h1 class="page-title">{{ t('nav.tracked') }}</h1>
      <p class="page-subtitle">{{ t('nav.tracked') }} · 批量查询最新状态</p>
    </div>

    <!-- {{ t('monitoring.analyze') }} -->
    <div class="add-section glass">
      <div class="add-row">
        <input v-model="addName" class="add-input" placeholder="输入 PUBG 玩家昵称" @keyup.enter="addPlayer" />
        <button class="add-btn" @click="addPlayer" :disabled="adding">
          {{ adding ? t('search.loading') : t('monitoring.analyze') }}
        </button>
      </div>
      <p v-if="addError" class="add-error">{{ addError }}</p>
    </div>

    <!-- 控制栏 -->
    <div class="toolbar" v-if="trackedList.length > 0">
      <span class="count">共 {{ trackedList.length }} 个收藏</span>
      <button class="refresh-btn" @click="batchRefresh" :disabled="refreshing">
        {{ refreshing ? t('search.loading') : t('player.refresh') }}
      </button>
    </div>

    <div v-if="loading" class="loading-text">{{ t('loading') }}</div>
    <div v-if="error" class="error-card glass">{{ error }}</div>

    <!-- 列表 -->
    <div v-if="trackedList.length > 0 && !loading" class="tracked-list">
      <div v-for="p in trackedList" :key="p.name" class="tracked-item glass">
        <div class="item-info">
          <router-link :to="'/?q=' + p.name" class="item-name">{{ p.name }}</router-link>
          <span class="item-meta">
            <span class="badge">{{ p.platform || 'steam' }}</span>
            <span v-if="p.lastChecked" class="badge badge-time">{{ new Date(p.lastChecked).toLocaleString() }}</span>
          </span>
        </div>
        <button class="remove-btn" @click="removePlayer(p.name)">...</button>
        <button class="trend-btn" @click="loadTrend(p.name)">...</button>
      </div>
    </div>

    <div v-if="trackedList.length === 0 && !loading" class="empty-card glass">
      <p>暂无{{ t('nav.tracked') }}</p>
      <p class="hint">搜索玩家并{{ t('monitoring.analyze') }}收藏，方便批量查询</p>
    </div>
  </div>

  <!-- ...弹窗 -->
  <div v-if="showTrend" class="modal-overlay" @click.self="showTrend = false">
    <div class="modal glass">
      <div class="modal-header">
        <h3 class="modal-title">📈 {{ trendName }} 数据...</h3>
        <button class="modal-close" @click="showTrend = false">✕</button>
      </div>
      <div class="modal-body">
        <div v-if="trendLoading" class="loading-text">{{ t('search.loading') }}</div>
        <div v-else-if="trendData.length === 0" class="loading-text">{{ t('stat.no_data') }}</div>
        <div v-else class="trend-chart">
          <!-- KD ...图 -->
          <div class="chart-section">
            <h4 class="chart-title">KD ...</h4>
            <svg viewBox="0 0 300 120" class="chart-svg">
              <polyline
                :points="trendKD"
                fill="none" stroke="#7b68ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              />
            </svg>
            <div class="chart-axis">
              <span v-for="(d,i) in trendAxisLabels" :key="i" class="axis-label">
                {{ formatTime(d.snapshot_time) }}
              </span>
            </div>
          </div>
          <!-- 击杀...图 -->
          <div class="chart-section">
            <h4 class="chart-title">击杀...</h4>
            <svg viewBox="0 0 300 120" class="chart-svg">
              <polyline
                :points="trendKills"
                fill="none" stroke="#ffc328" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              />
            </svg>
          </div>
          <!-- 最近记录表格 -->
          <div class="trend-table">
            <table>
              <thead><tr><th>时间</th><th>KD</th><th>击杀</th><th>场次</th><th>胜场</th><th>{{ t('ban.permanent') }}</th></tr></thead>
              <tbody>
                <tr v-for="d in trendData.slice(-10).reverse()" :key="d.snapshot_time">
                  <td>{{ formatTime(d.snapshot_time) }}</td>
                  <td>{{ d.kd }}</td>
                  <td>{{ d.kills }}</td>
                  <td>{{ d.matches_played }}</td>
                  <td>{{ d.wins }}</td>
                  <td>
                    <span :class="d.ban_type === 'Innocent' ? 'ban-ok' : 'ban-bad'">
                      {{ d.ban_type === 'Innocent' ? t('ban.normal') : t('ban.permanent') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container { max-width: 800px; margin: 0 auto; padding: 40px 20px 60px; }
.title-section { text-align: center; margin-bottom: 30px; }
.page-title { font-size: 28px; font-weight: 800; color: #fff; }
.page-subtitle { color: #a3a3a3; margin-top: 8px; font-size: 14px; }
.glass { background: linear-gradient(135deg,#2d2d2d,#1f1f1f); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; }
.add-section { padding: 16px; margin-bottom: 20px; }
.add-row { display: flex; gap: 12px; }
.add-input { flex: 1; padding: 12px; background: #171717; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; font-size: 14px; outline: none; }
.add-input:focus { border-color: #7b68ee; }
.add-btn { padding: 10px 20px; background: linear-gradient(135deg,#7b68ee,#9d7bff); border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; white-space: nowrap; }
.add-btn:disabled { opacity: .6; }
.add-error { color: #ff6b6b; font-size: 12px; margin-top: 8px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.count { color: #888; font-size: 13px; }
.refresh-btn { padding: 8px 18px; background: rgba(123,104,238,.2); border: 1px solid rgba(123,104,238,.3); border-radius: 8px; color: #7b68ee; cursor: pointer; font-size: 13px; }
.refresh-btn:disabled { opacity: .6; }
.tracked-list { display: flex; flex-direction: column; gap: 8px; }
.tracked-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; }
.item-info { display: flex; flex-direction: column; gap: 6px; }
.item-name { font-size: 15px; font-weight: 600; color: #fff; text-decoration: none; }
.item-name:hover { color: #7b68ee; }
.item-meta { display: flex; gap: 8px; }
.badge { font-size: 11px; padding: 2px 8px; background: rgba(255,255,255,.06); color: #888; border-radius: 20px; }
.badge-time { color: #666; }
.remove-btn { padding: 6px 14px; background: transparent; border: 1px solid rgba(255,107,107,.3); border-radius: 6px; color: #ff6b6b; cursor: pointer; font-size: 12px; }
.remove-btn:hover { background: rgba(255,107,107,.1); }
.empty-card { padding: 40px; text-align: center; }
.empty-card p { color: #888; }
.hint { font-size: 13px; margin-top: 8px; color: #555; }
.loading-text { text-align: center; padding: 40px; color: #888; }
.error-card { padding: 16px; margin-bottom: 20px; color: #ff6b6b; text-align: center; }

.trend-btn { padding: 6px 14px; background: rgba(123,104,238,.15); border: 1px solid rgba(123,104,238,.3); border-radius: 6px; color: #7b68ee; cursor: pointer; font-size: 12px; margin-left: 6px; }
.trend-btn:hover { background: rgba(123,104,238,.25); }

/* ...弹窗 */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 520px; max-height: 80vh; display: flex; flex-direction: column;
  border: 1px solid rgba(255,255,255,.1);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px; border-bottom: 1px solid rgba(255,255,255,.05);
}
.modal-title { font-size: 16px; font-weight: 700; color: #fff; }
.modal-close {
  width: 28px; height: 28px; border: none; background: rgba(255,255,255,.05);
  border-radius: 6px; color: #888; cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.modal-close:hover { color: #fff; background: rgba(255,255,255,.1); }
.modal-body { padding: 14px 20px 20px; overflow-y: auto; flex: 1; }

.trend-chart { display: flex; flex-direction: column; gap: 20px; }
.chart-section { }
.chart-title { font-size: 14px; font-weight: 600; color: #ccc; margin-bottom: 8px; }
.chart-svg { width: 100%; height: auto; background: rgba(0,0,0,.2); border-radius: 8px; }
.chart-axis {
  display: flex; justify-content: space-between; margin-top: 4px;
}
.axis-label { font-size: 10px; color: #555; }

.trend-table { overflow-x: auto; }
.trend-table table { width: 100%; border-collapse: collapse; font-size: 12px; }
.trend-table th {
  padding: 8px 6px; text-align: left; color: #888; font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,.05); white-space: nowrap;
}
.trend-table td { padding: 8px 6px; color: #ccc; border-top: 1px solid rgba(255,255,255,.03); }
.ban-ok { color: #22c55e; }
.ban-bad { color: #ff6b6b; }
</style>
