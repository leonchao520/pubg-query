<script setup lang="ts">
import { ref, computed } from 'vue'
import { t } from '@/i18n'
import { searchPlayerFull } from '@/api'

const namesInput = ref('')
const players = ref<any[]>([])
const loading = ref(false)
const error = ref('')

async function doCompare() {
  const names = namesInput.value.split(/[,，\n]/).map(n => n.trim()).filter(Boolean)
  if (names.length < 2) {
    error.value = '请至少输入 2 个玩家名，用逗号分隔'
    return
  }
  if (names.length > 6) {
    error.value = '最多对比 6 个玩家'
    return
  }

  loading.value = true
  error.value = ''
  players.value = []

  const results = await Promise.allSettled(
    names.map(name => searchPlayerFull(name))
  )

  const loaded: any[] = []
  for (let i = 0; i < names.length; i++) {
    const r: any = results[i]
    if (r.status === 'fulfilled') {
      loaded.push({
        name: names[i],
        data: (r as any).value,
        status: 'ok'
      })
    } else {
      loaded.push({
        name: names[i],
        data: null,
        status: 'error',
        error: (r as any).reason?.message || '查询失败'
      })
    }
  }
  players.value = loaded
  loading.value = false

  if (loaded.every(p => p.status === 'error')) {
    error.value = '所有玩家查询均失败，请检查昵称是否正确'
  }
}

function getStat(player: any, key: string): any {
  const modes = player?.data?.season?.data?.attributes?.gameModeStats
  if (!modes) return null
  const stats = Object.values(modes)[0] as any
  if (!stats) return null
  if (key === 'kd') return (stats.kills / Math.max(stats.deaths, 1)).toFixed(2)
  if (key === 'winRate') return ((stats.wins / Math.max(stats.roundsPlayed, 1)) * 100).toFixed(1) + '%'
  return stats[key] ?? null
}

function banDisplay(player: any): { label: string; cls: string } {
  const bt = player?.data?.banType
  if (!bt || bt === 'Innocent') return { label: '正常', cls: 'ban-clean' }
  if (bt === 'PermanentBan') return { label: '永久封禁', cls: 'ban-perm' }
  return { label: '临时封禁', cls: 'ban-temp' }
}

const hasData = computed(() => players.value.some(p => p.status === 'ok'))
</script>

<template>
  <div class="page-container">
    <div class="title-section">
      <h1 class="page-title">{{ t('compare.title') }}</h1>
      <p class="page-subtitle">{{ t('compare.subtitle') }}</p>
    </div>

    <div class="input-card">
      <div class="input-icon">⚔️</div>
      <textarea
        v-model="namesInput"
        class="names-input"
        placeholder="输入玩家昵称，用逗号或换行分隔&#10;例如: Shroud, Kaymind, Jeemzz"
        rows="3"
      ></textarea>
      <button class="compare-btn" @click="doCompare" :disabled="loading">
        {{ loading ? t('search.loading') : t('compare.button') }}
      </button>
    </div>

    <div v-if="error" class="error-card">
      <span>⚠️ {{ error }}</span>
    </div>

    <div v-if="hasData" class="compare-table glass">
      <table>
        <thead>
          <tr>
            <th class="th-name">玩家</th>
            <th class="th-stat">封禁状态</th>
            <th class="th-stat">场次</th>
            <th class="th-stat">胜场</th>
            <th class="th-stat">KD</th>
            <th class="th-stat">场均伤害</th>
            <th class="th-stat">胜率</th>
            <th class="th-stat">生存等级</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in players" :key="p.name" :class="{ 'row-error': p.status === 'error' }">
            <td class="td-name">
              <span v-if="p.status === 'ok'" class="name-text">{{ p.data?.player?.attributes?.name || p.name }}</span>
              <span v-else class="name-error">{{ p.name }}</span>
            </td>
            <td>
              <span v-if="p.status === 'ok'" :class="['ban-tag', banDisplay(p).cls]">{{ banDisplay(p).label }}</span>
              <span v-else class="error-text">{{ p.error }}</span>
            </td>
            <td class="td-num">{{ p.status === 'ok' ? (getStat(p, 'roundsPlayed') ?? '-') : '-' }}</td>
            <td class="td-num gold">{{ p.status === 'ok' ? (getStat(p, 'wins') ?? '-') : '-' }}</td>
            <td class="td-num">{{ p.status === 'ok' ? (getStat(p, 'kd') ?? '-') : '-' }}</td>
            <td class="td-num">{{ p.status === 'ok' ? (getStat(p, 'damageDealt') ? Math.round(getStat(p, 'damageDealt') / Math.max(getStat(p, 'roundsPlayed'), 1)) : '-') : '-' }}</td>
            <td class="td-num">{{ p.status === 'ok' ? (getStat(p, 'winRate') ?? '-') : '-' }}</td>
            <td class="td-num">{{ p.status === 'ok' ? ('Lv.' + (p.data?.survival?.level ?? '?')) : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!hasData && !loading" class="idle-card">
      <span class="idle-icon">👥</span>
      <p>输入 2-6 个玩家名{{ t('compare.button') }}</p>
    </div>
  </div>
</template>

<style scoped>
.page-container { max-width: 960px; margin: 0 auto; padding: 40px 20px 80px; }
.title-section { text-align: center; margin-bottom: 24px; }
.page-title { font-size: 28px; font-weight: 800; color: var(--text-primary); margin: 0; }
.page-subtitle { color: var(--text-muted); margin-top: 6px; font-size: 14px; }

.input-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 18px 20px;
  background: var(--bg-glass);
  border: var(--border-light);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
}
.input-icon { font-size: 28px; flex-shrink: 0; margin-top: 4px; }
.names-input {
  flex: 1;
  padding: 12px;
  background: rgba(0,0,0,.3);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  resize: vertical;
  min-height: 72px;
  line-height: 1.6;
}
.names-input:focus { border-color: var(--brand-glow); }
.names-input::placeholder { color: var(--text-dark); }
.compare-btn {
  padding: 12px 28px;
  background: linear-gradient(135deg, var(--brand), var(--brand-hover));
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.compare-btn:hover:not(:disabled) { opacity: .9; }
.compare-btn:disabled { opacity: .5; cursor: not-allowed; }

.error-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  margin-bottom: 20px;
  background: var(--error-bg);
  border: var(--error-border);
  border-radius: var(--radius-lg);
  color: var(--error);
  font-size: 14px;
}

.compare-table {
  overflow-x: auto;
  padding: 4px;
}
.compare-table table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}
.compare-table th {
  padding: 12px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .5px;
  border-bottom: var(--border-subtle);
  white-space: nowrap;
}
.compare-table td {
  padding: 12px 12px;
  font-size: 14px;
  border-top: var(--border-subtle);
  color: var(--text-primary);
}
.compare-table tbody tr:hover { background: var(--bg-hover); }
.th-stat { text-align: center; }
.td-num { text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
.gold { color: var(--gold); }
.th-name, .td-name { min-width: 120px; }
.name-text { font-weight: 600; }
.name-error { color: var(--error); font-size: 13px; }
.error-text { color: var(--error); font-size: 12px; }
.row-error td { opacity: .6; }

.ban-tag { padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.ban-clean { background: var(--success-bg); color: var(--success); }
.ban-temp { background: var(--warning-bg); color: var(--warning); }
.ban-perm { background: var(--error-bg); color: var(--error); }

.idle-card {
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-glass);
  border: var(--border-light);
  border-radius: var(--radius-lg);
}
.idle-icon { font-size: 40px; display: block; margin-bottom: 12px; }
.idle-card p { color: var(--text-muted); font-size: 15px; margin: 0; }

@media (max-width: 640px) {
  .page-container { padding: 20px 12px 60px; }
  .page-title { font-size: 22px; }
  .input-card { flex-direction: column; }
  .compare-btn { width: 100%; justify-content: center; }
  .compare-table { overflow-x: auto; }
  .compare-table table { min-width: 600px; }
  .compare-table th, .compare-table td { padding: 8px 6px; font-size: 12px; }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .page-container { padding: 30px 16px 60px; }
}
</style>
