<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { t } from '@/i18n'

// ── State ──
const platform = ref('pc-na')
const season = ref('')
const gameMode = ref('squad')
const seasons = ref<any[]>([])
const seasonsLoading = ref(false)

const result = reactive<{
  snapshots: { from: string; to: string } | null
  players: any[]
}>({
  snapshots: null,
  players: [],
})

const loading = ref(false)
const error = ref('')
const empty = ref(false)

// ── Constants ──
const SHARDS = [
  { key: 'pc-na', label: '北美 (NA)' },
  { key: 'pc-eu', label: '欧洲 (EU)' },
  { key: 'pc-as', label: '亚洲 (AS)' },
  { key: 'pc-krjp', label: '韩日 (KRJP)' },
  { key: 'pc-sea', label: '东南亚 (SEA)' },
  { key: 'pc-sa', label: '南美 (SA)' },
  { key: 'pc-oc', label: '大洋洲 (OC)' },
  { key: 'pc-ru', label: '俄罗斯 (RU)' },
]

const BAN_LABELS: Record<string, string> = {
  VAC: 'VAC',
  GameBan: '游戏封禁',
  CommunityBan: '社区封禁',
}

// ── Computed ──
const totalDropped = computed(() => result.players.length)
const totalBanned = computed(() => result.players.filter((p) => p.isBanned).length)

// ── Methods ──
async function loadSeasons() {
  seasonsLoading.value = true
  try {
    const res = await fetch('/api/seasons')
    const json = await res.json()
    seasons.value = json.data?.data || []
    // 默认选中当前赛季
    const current = seasons.value.find((s: any) => s.attributes?.isCurrentSeason)
    if (current) season.value = current.id
    else if (seasons.value.length > 0) season.value = seasons.value[0].id
  } catch {
    // 静默处理
  } finally {
    seasonsLoading.value = false
  }
}

async function analyze() {
  if (!season.value) {
    error.value = '请先选择赛季'
    return
  }
  loading.value = true
  error.value = ''
  empty.value = false
  result.snapshots = null
  result.players = []

  try {
    const res = await fetch('/api/monitoring/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: platform.value,
        season: season.value,
        gameMode: gameMode.value,
      }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '对比失败')

    result.snapshots = json.data.snapshots || null
    result.players = json.data.players || []

    if (result.players.length === 0) {
      empty.value = true
    }
  } catch (e: any) {
    error.value = e.message || '请求失败'
  } finally {
    loading.value = false
  }
}

function formatTime(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

function banDisplay(p: any) {
  if (!p.isBanned) return '未检测到'
  return BAN_LABELS[p.banType] || p.banType || '已封禁'
}

onMounted(loadSeasons)
</script>

<template>
  <div class="page-container">
    <!-- Title -->
    <div class="title-section">
      <h1 class="page-title">{{ t('monitoring.title') }}</h1>
      <p class="page-subtitle">{{ t('monitoring.subtitle') }}</p>
    </div>

    <!-- Intro card -->
    <div class="intro-card">
      <div class="intro-icon">ℹ️</div>
      <div class="intro-body">
        <p>
          本站提供非官方的排行榜变动追踪服务，相关数据由系统通过对比前后一小时的榜单快照独立计算得出。系统会自动排查所有"掉榜"玩家。因正常扣分（RP不足）导致的掉榜将被过滤，本站仅记录因账号封禁（临时/永久）或昵称变更导致的掉榜事件。
        </p>
        <p>
          受官方数据接口稳定性限制，玩家被封禁后的 24 小时内，其状态可能在"已封禁"与"正常"间频繁波动。尽管本站已部署多轮复查机制，但仍可能受此波动影响，导致少部分因封禁掉榜的玩家未被成功捕捉，敬请谅解。
        </p>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls-card">
      <div class="control-row">
        <div class="control-item">
          <label class="control-label">{{ t('monitoring.region') }}</label>
          <select v-model="platform" class="control-select">
            <option v-for="s in SHARDS" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="control-item">
          <label class="control-label">{{ t('monitoring.season') }}</label>
          <select v-model="season" class="control-select" :disabled="seasonsLoading">
            <option value="" disabled>加载赛季中...</option>
            <option v-for="s in seasons" :key="s.id" :value="s.id">
              {{ s.attributes?.name || s.id }}
              <template v-if="s.attributes?.isCurrentSeason"> (当前)</template>
            </option>
          </select>
        </div>
        <div class="control-item">
          <label class="control-label">{{ t('monitoring.mode') }}</label>
          <select v-model="gameMode" class="control-select">
            <option value="squad">四排 (TPP & FPP)</option>
          </select>
        </div>
        <div class="control-item control-action">
          <label class="control-label">&nbsp;</label>
          <button class="analyze-btn" @click="analyze" :disabled="loading || !season">
            {{ loading ? t('monitoring.analyzing') : t('monitoring.analyze') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="status-card">
      <div class="loading-spinner"></div>
      <p>{{ t('monitoring.analyze') }}...</p>
    </div>

    <!-- Error -->
    <div v-if="error && !loading" class="error-card">
      <span class="error-icon">⚠️</span>
      <span>{{ error }}</span>
    </div>

    <!-- Empty -->
    <div v-if="empty && !loading && !error" class="status-card">
      <span class="empty-icon">✅</span>
      <p>{{ t('monitoring.empty') }}</p>
      <p class="hint">最近一小时内排行榜未发现异常变动</p>
    </div>

    <!-- Results -->
    <div v-if="result.snapshots && result.players.length > 0 && !loading" class="result-section">
      <!-- Snapshot info -->
      <div class="snapshot-info">
        <div class="snapshot-item">
          <span class="snapshot-label">{{ t('monitoring.snapshot_from') }}</span>
          <span class="snapshot-value">{{ formatTime(result.snapshots.from) }}</span>
        </div>
        <span class="snapshot-arrow">→</span>
        <div class="snapshot-item">
          <span class="snapshot-label">{{ t('monitoring.snapshot_to') }}</span>
          <span class="snapshot-value">{{ formatTime(result.snapshots.to) }}</span>
        </div>
      </div>

      <!-- Summary -->
      <div class="summary-card">
        <div class="summary-stat">
          <span class="summary-num total">{{ totalDropped }}</span>
          <span class="summary-label">{{ t('monitoring.total') }}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-stat">
          <span class="summary-num banned">{{ totalBanned }}</span>
          <span class="summary-label">{{ t('monitoring.banned') }}</span>
        </div>
      </div>

      <!-- Data table -->
      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-name">玩家名称</th>
              <th class="col-tier">段位</th>
              <th class="col-rp">掉榜前 RP</th>
              <th class="col-ban">封禁类型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, idx) in result.players" :key="p.id || idx">
              <td class="col-rank">{{ idx + 1 }}</td>
              <td class="col-name">{{ p.name || 'Unknown' }}</td>
              <td class="col-tier">
                <span class="tier-badge">{{ p.previousTier || '-' }}</span>
              </td>
              <td class="col-rp">{{ p.previousRP ?? '-' }}</td>
              <td class="col-ban">
                <span :class="['ban-badge', p.isBanned ? 'ban-yes' : 'ban-no']">
                  {{ banDisplay(p) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Idle state (initial) -->
    <div v-if="!loading && !error && !empty && !result.snapshots" class="status-card idle">
      <span class="idle-icon">🔍</span>
      <p>选择{{ t('monitoring.region') }}和{{ t('monitoring.season') }}后，点击「{{ t('monitoring.analyze') }}」</p>
      <p class="hint">系统将对比最近两个整点快照，识别掉榜封禁玩家</p>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

.title-section {
  text-align: center;
  margin-bottom: 24px;
}
.page-title {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  margin: 0;
}
.page-subtitle {
  color: #888;
  margin-top: 6px;
  font-size: 14px;
}

/* ── Intro Card ── */
.intro-card {
  display: flex;
  gap: 14px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #262626, #1e1e1e);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  margin-bottom: 20px;
  line-height: 1.7;
}
.intro-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}
.intro-body p {
  color: #b0b0b0;
  font-size: 13.5px;
  margin: 0 0 8px;
}
.intro-body p:last-child {
  margin-bottom: 0;
}

/* ── Controls ── */
.controls-card {
  background: linear-gradient(135deg, #2a2a2a, #1f1f1f);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 20px;
}
.control-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.control-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 140px;
}
.control-action {
  flex: 0 0 auto;
  min-width: auto;
}
.control-label {
  font-size: 13px;
  color: #999;
  font-weight: 500;
}
.control-select {
  padding: 10px 12px;
  background: #171717;
  border: 1px solid #333;
  border-radius: 8px;
  color: #e5e5e5;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color .2s;
}
.control-select:focus {
  border-color: #7b68ee;
}
.control-select:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.analyze-btn {
  padding: 10px 28px;
  background: linear-gradient(135deg, #7b68ee, #9d7bff);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity .2s;
  white-space: nowrap;
}
.analyze-btn:hover:not(:disabled) {
  opacity: .9;
}
.analyze-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

/* ── Status cards (loading / error / empty / idle) ── */
.status-card {
  text-align: center;
  padding: 50px 20px;
  background: linear-gradient(135deg, #2a2a2a, #1f1f1f);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
}
.status-card p {
  color: #aaa;
  margin: 8px 0 0;
  font-size: 15px;
}
.status-card .hint {
  font-size: 13px;
  color: #666;
}

.idle-icon, .empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}

/* Loading spinner */
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,.1);
  border-top-color: #7b68ee;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin .8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 20px;
  background: rgba(255, 70, 70, .08);
  border: 1px solid rgba(255, 70, 70, .2);
  border-radius: 12px;
  color: #ff6b6b;
  font-size: 14px;
  margin-bottom: 20px;
}
.error-icon {
  font-size: 18px;
}

/* ── Snapshot info ── */
.snapshot-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 14px 20px;
  background: linear-gradient(135deg, #2a2a2a, #1f1f1f);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  margin-bottom: 16px;
}
.snapshot-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.snapshot-label {
  font-size: 12px;
  color: #777;
}
.snapshot-value {
  font-size: 13px;
  color: #ccc;
  font-weight: 500;
}
.snapshot-arrow {
  font-size: 18px;
  color: #7b68ee;
}

/* ── Summary ── */
.summary-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 20px;
  background: linear-gradient(135deg, #2a2a2a, #1f1f1f);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 12px;
  margin-bottom: 16px;
}
.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.summary-num {
  font-size: 32px;
  font-weight: 800;
}
.summary-num.total {
  color: #f59e0b;
}
.summary-num.banned {
  color: #ef4444;
}
.summary-label {
  font-size: 13px;
  color: #888;
}
.summary-divider {
  width: 1px;
  height: 40px;
  background: rgba(255,255,255,.1);
}

/* ── Data table ── */
.table-card {
  background: linear-gradient(135deg, #2a2a2a, #1f1f1f);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  overflow: hidden;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table thead {
  background: rgba(255,255,255,.04);
}
.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #777;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.data-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #ccc;
  border-top: 1px solid rgba(255,255,255,.04);
}
.data-table tbody tr:hover {
  background: rgba(255,255,255,.03);
}

.col-rank {
  width: 48px;
  text-align: center;
  color: #666;
  font-weight: 600;
}
.col-name {
  min-width: 160px;
  color: #e5e5e5;
  font-weight: 500;
}
.col-tier {
  width: 100px;
}
.col-rp {
  width: 100px;
  color: #7b68ee;
  font-weight: 600;
}
.col-ban {
  width: 120px;
}

.tier-badge {
  display: inline-block;
  padding: 2px 10px;
  background: rgba(255,255,255,.06);
  border-radius: 4px;
  font-size: 12px;
  color: #aaa;
}

.ban-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.ban-yes {
  background: rgba(239, 68, 68, .15);
  color: #f87171;
}
.ban-no {
  background: rgba(255,255,255,.06);
  color: #888;
}

@media (max-width: 640px) {
  .page-container { padding: 20px 12px 60px; }
  .page-title { font-size: 22px; }
  .control-row { flex-direction: column; gap: 10px; }
  .control-item { min-width: 100%; }
  .control-action { width: 100%; }
  .analyze-btn { width: 100%; justify-content: center; }
  .snapshot-info { flex-direction: column; gap: 8px; }
  .snapshot-arrow { transform: rotate(90deg); }
  .summary-card { gap: 16px; padding: 14px; }
  .summary-num { font-size: 24px; }
  .data-table th, .data-table td { padding: 10px 8px; font-size: 12px; }
  .col-name { min-width: 100px; }
  .col-rp, .col-tier { width: auto; }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .page-container { padding: 30px 16px 60px; }
}
</style>
