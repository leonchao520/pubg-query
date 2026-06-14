<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchPlayerFull } from '@/api'
import { t } from '@/i18n'

const route = useRoute()
const router = useRouter()

const searchQuery = ref('')
const playerData = ref<any>(null)
const seasonData = ref<any>(null)
const matchIds = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const currentTab = ref<'overview' | 'season' | 'matches'>('overview')
const clan = ref<any>(null)

onMounted(() => {
  fetchStatus()
  countdownTimer = window.setInterval(tickCountdown, 1000)
  loadHistory()
  loadFavorites()
  const q = route.query.q as string
  if (q) {
    searchQuery.value = q
    doSearch()
  }
})

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})

async function doSearch() {
  if (!searchQuery.value.trim()) return
  // URL 可分享：把搜索词写入地址栏
  router.replace({ query: { q: searchQuery.value.trim() } })
  loading.value = true
  error.value = ''
  playerData.value = null
  seasonData.value = null
  matchIds.value = []

  try {
    const result = await searchPlayerFull(searchQuery.value)
    playerData.value = result.player
    saveToHistory(searchQuery.value)
    seasonData.value = result.season
    matchIds.value = result.matchIds || []
    steamBan.value = result.steam?.bans || null
    steamUser.value = result.steam?.user || null
    clan.value = result.clan || null
    banType.value = result.banType || result.banStatus || 'Innocent'
    survival.value = result.survival
    weaponTotalLevel.value = result.weaponTotalLevel || 0
    // 如果返回了 stale 标记，提示用户
    if (result._stale) {
      error.value = '⚠️ 当前为缓存数据，可能不是最新（PUBG API 请求受限）'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const steamBan = ref<any>(null)
const steamUser = ref<any>(null)
const banType = ref<string>("Innocent")
const survival = ref<any>(null)
const weaponTotalLevel = ref<number>(0)

const seasonStats = computed(() => {
  if (!seasonData.value?.data?.attributes?.gameModeStats) return null
  const modes = seasonData.value.data.attributes.gameModeStats
  const result: any[] = []
  for (const [mode, stats] of Object.entries(modes)) {
    const s = stats as any
    result.push({
      mode,
      roundsPlayed: s.roundsPlayed || 0,
      wins: s.wins || 0,
      kills: s.kills || 0,
      deaths: s.deaths || 0,
      assists: s.assists || 0,
      damageDealt: s.damageDealt || 0,
      top10s: s.top10s || 0,
      winRate: s.roundsPlayed > 0 ? ((s.wins / s.roundsPlayed) * 100).toFixed(1) : '0.0',
      kd: s.roundsPlayed > 0 ? (s.kills / Math.max(s.deaths, 1)).toFixed(2) : '0.00',
      avgDamage: s.roundsPlayed > 0 ? Math.round(s.damageDealt / s.roundsPlayed) : 0,
      top10Rate: s.roundsPlayed > 0 ? ((s.top10s / s.roundsPlayed) * 100).toFixed(1) : '0.0',
    })
  }
  return result
})

// 服务器状态
const statusOk = ref(false)
const onlinePlayers = ref(0)
const countdown = ref(60)
const formattedPlayers = computed(() => {
  if (!onlinePlayers.value) return '...'
  return onlinePlayers.value.toLocaleString()
})

let statusTimer: number | null = null
let countdownTimer: number | null = null

function tickCountdown() {
  countdown.value--
  if (countdown.value <= 0) {
    countdown.value = 60
    fetchStatus()
  }
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status')
    const json = await res.json()
    if (json.success) {
      statusOk.value = json.data.pubgApi?.data?.type === 'status'
      onlinePlayers.value = json.data.steamPlayers || 0
    }
  } catch { /* silent */ }
}

// {{ t('search.history') }}
const showHistory = ref(false)
const showSuggestions = ref(false)
const searchHistory = ref<string[]>([])

const filteredHistory = computed(() => {
  if (!searchQuery.value.trim()) return searchHistory.value.slice(0, 8)
  const q = searchQuery.value.toLowerCase()
  return searchHistory.value.filter(n => n.toLowerCase().includes(q)).slice(0, 8)
})

function openSuggestions() {
  showSuggestions.value = true
}

function hideSuggestions() {
  setTimeout(() => { showSuggestions.value = false }, 200)
}

function selectSuggestion(name: string) {
  searchQuery.value = name
  showSuggestions.value = false
  doSearch()
}

function loadHistory() {
  try {
    searchHistory.value = JSON.parse(localStorage.getItem('pubgbar_history') || '[]')
  } catch { searchHistory.value = [] }
}

function saveToHistory(name: string) {
  loadHistory()
  const filtered = searchHistory.value.filter(n => n.toLowerCase() !== name.toLowerCase())
  filtered.unshift(name)
  if (filtered.length > 50) filtered.pop()
  searchHistory.value = filtered
  localStorage.setItem('pubgbar_history', JSON.stringify(filtered))
}

// 收藏
const favorites = ref<string[]>([])

function loadFavorites() {
  try {
    favorites.value = JSON.parse(localStorage.getItem('pubgbar_favorites') || '[]')
  } catch { favorites.value = [] }
}

function toggleFavorite(name: string) {
  loadFavorites()
  const idx = favorites.value.findIndex(n => n.toLowerCase() === name.toLowerCase())
  if (idx >= 0) {
    favorites.value.splice(idx, 1)
  } else {
    favorites.value.push(name)
  }
  localStorage.setItem('pubgbar_favorites', JSON.stringify(favorites.value))
  searchHistory.value = [...searchHistory.value]
}

function isFavorite(name: string): boolean {
  return favorites.value.some(n => n.toLowerCase() === name.toLowerCase())
}

// 封禁状态辅助函数
function banBadgeClass(type: string): string {
  if (type === 'Innocent') return 'ban-badge-clean'
  if (type === 'TemporaryBan' || type === 'TempBan' || type === 'temp') return 'ban-badge-temp'
  if (type === 'PermanentBan') return 'ban-badge-banned'
  return 'ban-badge-banned'
}

function banLabel(type: string): string {
  if (type === 'Innocent') return t('ban.normal')
  if (type === 'TemporaryBan' || type === 'TempBan' || type === 'temp') return t('ban.temp')
  if (type === 'PermanentBan') return t('ban.permanent')
  return type
}

const steamBanClass = computed(() => {
  const s = steamBan.value
  if (!s) return 'ban-badge-clean'
  if (s.VACBanned || s.NumberOfGameBans > 0) {
    if (s.VACBanned) return 'ban-badge-banned'
    return 'ban-badge-temp'
  }
  return 'ban-badge-clean'
})

const steamBanLabel = computed(() => {
  const s = steamBan.value
  if (!s) return t('ban.steam.clean')
  if (s.VACBanned) {
    return s.NumberOfGameBans > 0 ? t('ban.steam.vac') + ' + ' + s.NumberOfGameBans + ' ' + t('ban.steam.game') : t('ban.steam.vac')
  }
  if (s.NumberOfGameBans > 0) return s.NumberOfGameBans + ' ' + t('ban.steam.game')
  return t('ban.steam.clean')
})

function removeHistory(idx: number) {
  searchHistory.value.splice(idx, 1)
  localStorage.setItem('pubgbar_history', JSON.stringify(searchHistory.value))
}

function clearHistory() {
  searchHistory.value = []
  localStorage.removeItem('pubgbar_history')
}
</script>

<template>
  <div class="page-container">
    <div class="hero-section">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <h1 class="hero-title">PUBG.<span class="accent">BAR</span></h1>
        <p class="hero-subtitle">{{ t('app.subtitle') }}</p>
      </div>
    </div>

    <div class="search-section">
      <div class="search-wrapper glass">
        <div class="search-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input v-model="searchQuery" class="search-input" :placeholder="t('search.placeholder')" @keyup.enter="doSearch" @focus="openSuggestions" @blur="hideSuggestions" @input="openSuggestions" />
        <div class="search-btn-group">
          <button class="search-btn" @click="doSearch" :disabled="loading">{{ loading ? t('search.loading') : t('search.button') }}</button>
          <button class="history-btn" @click="showHistory = true" :title="t('search.history')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
        </div>
      </div>
      <!-- 搜索建议下拉 -->
      <div v-if="showSuggestions && filteredHistory.length > 0" class="search-suggestions glass">
        <div
          v-for="(name, i) in filteredHistory"
          :key="i"
          class="suggestion-item"
          @mousedown.prevent="selectSuggestion(name)"
        >
          <span class="suggestion-icon">🕐</span>
          <span class="suggestion-name">{{ name }}</span>
          <span v-if="isFavorite(name)" class="suggestion-fav">⭐</span>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div class="status-item">
        <span class="status-dot" :class="{ online: statusOk }"></span>
        <span class="status-label">{{ t('status.server') }}</span>
        <span class="status-value" :class="{ online: statusOk }">{{ statusOk ? t('status.online') : t('status.error') }}</span>
      </div>
      <div class="status-item">
        <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="status-label">{{ t('status.players') }}</span>
        <span class="status-value">{{ formattedPlayers }}</span>
      </div>
      <span class="status-refresh">{{ countdown }}{{ t('status.refresh') }}</span>
    </div>

    <div v-if="loading" class="loading-section">
      <div class="loader"><svg viewBox="0 0 44 44"><rect x="1" y="1" width="42" height="42" /></svg><span class="letter">P</span></div>
      <p class="loading-text">{{ t('loading.data') }}</p>
    </div>

    <div v-if="error && !loading" class="error-card glass">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span>{{ error }}</span>
    </div>

    <div v-if="playerData && !loading" class="player-card glass">
      <div class="player-header">
        <div class="player-avatar"><img src="https://cdn.pubg.hk/images/pubg.webp" alt="avatar" /></div>
        <div class="player-info">
          <div class="player-name-row">
            <h2 class="player-name">{{ playerData.attributes?.name }}</h2>
            <button class="fav-btn" @click="toggleFavorite(playerData.attributes?.name)" :title="isFavorite(playerData.attributes?.name) ? t('player.unfavorite') : t('player.favorite')">
              {{ isFavorite(playerData.attributes?.name) ? '⭐' : '☆' }}
            </button>
            <button class="refresh-btn" @click="doSearch" title="刷新数据">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: loading }">
                <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
          </div>
          <div class="player-meta">
            <span class="badge">{{ t('player.platform') }}: {{ playerData.attributes?.shardId }}</span>
            <span class="badge badge-level">{{ t('player.survival') }}: Lv.{{ survival?.level !== undefined && survival?.level !== null ? survival.level : "?" }}</span>
            <span class="badge badge-level" style="background: rgba(147, 51, 234, 0.15); color: #a855f7;">武器专精: Lv.{{ weaponTotalLevel }}</span>
            <span class="badge badge-clan">{{ t('player.clan') }}: {{ clan?.attributes?.clanName || t('player.no_clan') }}</span>
            <span class="badge badge-secondary">{{ playerData.attributes?.createdAt ? new Date(playerData.attributes.createdAt).toLocaleDateString() : '' }}</span>
          </div>
        </div>
        <div class="ban-status">
          <div class="ban-badge" :class="banBadgeClass(banType)">
            PUBG: {{ banLabel(banType) }}
          </div>
          <div v-if="steamBan" class="ban-badge" :class="steamBanClass" style="margin-top:4px;">
            Steam: {{ steamBanLabel }}
          </div>
          <div v-if="steamBan?.DaysSinceLastBan > 0" style="margin-top:4px;font-size:10px;color:#ff6b6b;">
            {{ t('ban.recent') }}: {{ steamBan.DaysSinceLastBan }}{{ t('ban.steam.days') }}
          </div>
        </div>
      </div>

      <div class="tabs">
        <button :class="['tab-btn', { active: currentTab === 'overview' }]" @click="currentTab = 'overview'">{{ t('tab.overview') }}</button>
        <button :class="['tab-btn', { active: currentTab === 'season' }]" @click="currentTab = 'season'">{{ t('tab.season') }}</button>
        <button :class="['tab-btn', { active: currentTab === 'matches' }]" @click="currentTab = 'matches'">{{ t('tab.matches') }}</button>
      </div>

      <!-- Steam 封禁信息 -->
      <div v-if="steamBan" class="ban-info-bar glass">
        <div class="ban-summary" :class="steamBanClass">
          <div class="ban-indicator">
            <span v-if="steamBan.VACBanned" class="ban-icon" style="color:#ff6b6b">⛔ 永久封禁</span>
            <span v-else-if="steamBan.NumberOfGameBans > 0" class="ban-icon" style="color:#fb923c">⚠️ 临时封禁</span>
            <span v-else class="ban-icon">✅ {{ t('ban.steam.clean') }}</span>
          </div>
          <div class="ban-text">
            <p v-if="steamBan.NumberOfGameBans > 0" class="ban-game">{{ steamBan.NumberOfGameBans }} 个游戏封禁</p>
            <p v-if="steamBan.DaysSinceLastBan > 0" class="ban-days">{{ t('ban.recent') }}: {{ steamBan.DaysSinceLastBan }} {{ t('ban.steam.days') }}</p>
          </div>
        </div>
        <div v-if="steamUser" class="steam-info">
          <img :src="steamUser.avatarmedium" class="steam-avatar-sm" alt="steam" />
          <span>{{ steamUser.personaname }}</span>
        </div>
      </div>

      <div v-if="currentTab === 'overview'" class="tab-content">
        <div v-if="seasonStats && seasonStats.length > 0" class="overview-grid">
          <div v-for="s in seasonStats" :key="s.mode" class="mode-card glass">
            <h3 class="mode-title">{{ s.mode }}</h3>
            <div class="big-stat"><span class="big-value">{{ s.roundsPlayed }}</span><span class="big-label">{{ t('stat.matches') }}</span></div>
            <div class="stats-row">
              <div class="stat"><span class="stat-val gold">{{ s.wins }}</span><span class="stat-lbl">{{ t('stat.wins') }}</span></div>
              <div class="stat"><span class="stat-val">{{ s.kills }}</span><span class="stat-lbl">{{ t('stat.kills') }}</span></div>
              <div class="stat"><span class="stat-val">{{ s.kd }}</span><span class="stat-lbl">KD</span></div>
              <div class="stat"><span class="stat-val">{{ s.avgDamage }}</span><span class="stat-lbl">{{ t('stat.damage') }}</span></div>
            </div>
          </div>
        </div>
        <div v-else class="no-data">{{ t('stat.no_data') }}</div>
      </div>

      <div v-if="currentTab === 'season'" class="tab-content">
        <div v-if="seasonStats && seasonStats.length > 0">
          <div v-for="s in seasonStats" :key="s.mode" class="details-card glass">
            <h3 class="mode-title">{{ s.mode }}</h3>
            <div class="detail-grid">
              <div class="detail-item"><span class="dl">{{ t('stat.matches') }}</span><span class="dv">{{ s.roundsPlayed }}</span></div>
              <div class="detail-item"><span class="dl">{{ t('stat.wins') }}</span><span class="dv gold">{{ s.wins }}</span></div>
              <div class="detail-item"><span class="dl">{{ t('stat.win_rate') }}</span><span class="dv">{{ s.winRate }}%</span></div>
              <div class="detail-item"><span class="dl">{{ t('stat.top10') }}</span><span class="dv">{{ s.top10Rate }}%</span></div>
              <div class="detail-item"><span class="dl">{{ t('stat.kills') }}</span><span class="dv">{{ s.kills }}</span></div>
              <div class="detail-item"><span class="dl">{{ t('stat.deaths') }}</span><span class="dv">{{ s.deaths }}</span></div>
              <div class="detail-item"><span class="dl">KD</span><span class="dv">{{ s.kd }}</span></div>
              <div class="detail-item"><span class="dl">{{ t('stat.damage') }}</span><span class="dv">{{ s.avgDamage }}</span></div>
            </div>
          </div>
        </div>
        <div v-else class="no-data">暂无{{ t('tab.season') }}</div>
      </div>

      <div v-if="currentTab === 'matches'" class="tab-content">
        <div v-if="matchIds.length > 0">
          <div class="match-list">
            <div v-for="(mid, i) in matchIds" :key="mid" class="match-item glass">
              <div class="match-index">#{{ i + 1 }}</div>
              <div class="match-id">{{ mid.slice(0, 16) }}...</div>
              <router-link :to="'/match/' + mid" class="match-btn">查看</router-link>
            </div>
          </div>
        </div>
        <div v-else class="no-data">{{ t('stat.no_matches') }}</div>
      </div>
    </div>
  </div>

  <!-- {{ t('search.history') }}弹窗 -->
  <div v-if="showHistory" class="modal-overlay" @click.self="showHistory = false">
    <div class="modal glass">
      <div class="modal-header">
        <h3 class="modal-title">{{ t('search.history') }}</h3>
        <button class="modal-close" @click="showHistory = false">✕</button>
      </div>
      <div class="modal-body">
        <div v-if="searchHistory.length === 0" class="history-empty">{{ t('search.empty') }}</div>
        <div v-else class="history-list">
          <div
            v-for="(name, i) in searchHistory"
            :key="i"
            class="history-item"
          >
            <span class="history-name" @click="searchQuery = name; showHistory = false; doSearch()">{{ name }}</span>
            <button class="history-fav" @click="toggleFavorite(name)">{{ isFavorite(name) ? '⭐' : '☆' }}</button>
            <button class="history-del" @click="removeHistory(i)">✕</button>
          </div>
        </div>
        <div v-if="searchHistory.length > 0" class="history-actions">
          <button class="clear-btn" @click="clearHistory">{{ t('search.clear') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container { max-width: 900px; margin: 0 auto; padding: 0 20px 60px; }
.hero-section { position: relative; text-align: center; padding: 60px 20px 40px; }
.hero-content { position: relative; z-index: 1; }
.hero-title { font-size: 48px; font-weight: 900; color: var(--text-primary); letter-spacing: 3px; }
.accent { color: var(--brand); }
.hero-subtitle { color: var(--text-muted); margin-top: 12px; font-size: 16px; }
.search-section { margin-bottom: 30px; }
.search-wrapper { display: flex; align-items: center; max-width: 560px; margin: 0 auto; padding: 4px; position: relative; background: var(--bg-glass); border: 1px solid rgba(255,255,255,.12); border-radius: var(--radius-lg); transition: border-color var(--transition-normal); }
.search-wrapper:focus-within { border-color: var(--brand-glow); }
.search-icon { padding: 0 0 0 14px; color: var(--text-dim); display: flex; }
.search-input { flex: 1; padding: 14px 12px; background: transparent; border: none; color: var(--text-primary); font-size: 15px; outline: none; }
.search-input::placeholder { color: var(--text-dark); }
.search-btn { padding: 10px 24px; background: linear-gradient(135deg, var(--brand), var(--brand-hover)); border: none; border-radius: var(--radius-md); color: var(--text-primary); font-weight: 600; cursor: pointer; font-size: 14px; white-space: nowrap; }
.search-btn:hover { opacity: .9; }
.search-btn:disabled { opacity: .6; cursor: not-allowed; }
.glass { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-light); border-radius: var(--radius-lg); }
.loading-section { text-align: center; padding: 40px; }
.loader { width:44px; height:44px; position:relative; margin:0 auto 16px; }
.loader svg { width:100%; height:100%; }
.loader svg rect { fill:none; stroke:var(--brand); stroke-width:3; stroke-dasharray:192 64 192 64; animation:3s infinite pathRect; }
.loader .letter { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:18px; color:var(--brand); }
@keyframes pathRect { 25%{stroke-dashoffset:64} 50%{stroke-dashoffset:128} 75%{stroke-dashoffset:192} 100%{stroke-dashoffset:256} }
.loading-text { color: var(--text-muted); font-size:14px; }
.error-card { display:flex; align-items:center; gap:10px; padding:16px 20px; margin-bottom:20px; color:var(--error); border-color:var(--error-border); font-size:14px; }
.player-card { padding:24px; margin-bottom:20px; }
.player-header { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.player-avatar { width:56px; height:56px; background:var(--bg-hover); border-radius:var(--radius-full); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.player-avatar img { width:70%; height:70%; object-fit:contain; opacity:.7; }
.player-info { flex: 1; min-width: 0; }
.player-name-row { display: flex; align-items: center; gap: 8px; }
.player-name { font-size:22px; font-weight:700; color:var(--text-primary); }
.fav-btn { width: 32px; height: 32px; border: none; background: var(--bg-hover); border-radius: var(--radius-sm); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all var(--transition-normal); }
.fav-btn:hover { background: var(--bg-hover-strong); transform: scale(1.1); }
.refresh-btn { width: 32px; height: 32px; border: none; background: var(--bg-hover); border-radius: var(--radius-sm); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: all var(--transition-normal); }
.refresh-btn:hover { background: var(--bg-hover-strong); color: var(--brand); }
.refresh-btn svg.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.player-meta { display:flex; gap:8px; margin-top:6px; flex-wrap: wrap; }
.badge { font-size:11px; padding:3px 10px; background: var(--brand-light); color: var(--brand); border-radius: 20px; text-transform: uppercase; }
.badge-level { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.badge-clan { background: rgba(234, 179, 8, 0.15); color: #eab308; }
.badge-secondary { background: var(--bg-hover); color: var(--text-muted); }
.ban-status { flex-shrink: 0; }
.ban-badge { padding: 8px 16px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; white-space: nowrap; }
.ban-badge-banned { background: var(--error-bg); color: var(--error); border: var(--error-border); }
.ban-badge-clean { background: var(--success-bg); color: var(--success); border: var(--success-border); }
.ban-badge-temp { background: var(--warning-bg); color: var(--warning); border: var(--warning-border); }
.tabs { display:flex; gap:2px; background: var(--bg-tertiary); border-radius: var(--radius-md); padding:3px; margin-bottom:20px; }
.tab-btn { flex:1; padding:10px; border:none; background:transparent; color:var(--text-secondary); border-radius:var(--radius-sm); cursor:pointer; font-size:14px; transition:all var(--transition-normal); }
.tab-btn.active { background:linear-gradient(135deg, var(--brand), var(--brand-hover)); color:var(--text-primary); font-weight:500; }
.overview-grid { display:flex; flex-direction:column; gap:16px; }
.mode-card { padding:20px; }
.mode-title { font-size:14px; font-weight:600; color:var(--brand); text-transform:capitalize; margin-bottom:16px; }
.big-stat { text-align:center; margin-bottom:16px; }
.big-value { font-size:36px; font-weight:800; color:var(--text-primary); display:block; }
.big-label { font-size:12px; color:var(--text-muted); }
.stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.stat { text-align:center; }
.stat-val { display:block; font-size:20px; font-weight:700; color:var(--text-primary); }
.stat-lbl { display:block; font-size:11px; color:var(--text-muted); margin-top:2px; }
.gold { color:var(--gold); }
.details-card { padding:20px; margin-bottom:16px; }
.detail-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
.detail-item { display:flex; flex-direction:column; gap:4px; }
.dl { font-size:11px; color:var(--text-muted); text-transform:uppercase; }
.dv { font-size:18px; font-weight:700; color:var(--text-primary); }
.match-list { display:flex; flex-direction:column; gap:8px; }
.match-item { display:flex; align-items:center; gap:12px; padding:12px 16px; }
.match-index { color:var(--text-dim); font-weight:600; min-width:28px; }
.match-id { flex:1; font-family:var(--font-mono); color:var(--text-muted); font-size:13px; }
.match-btn { padding:6px 14px; background: var(--bg-accent); border: var(--border-accent); border-radius: var(--radius-sm); color: var(--brand); cursor:pointer; font-size:12px; }
.no-data { text-align:center; color:var(--text-dim); padding:40px 0; }
.ban-info-bar { padding: 14px 20px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
.ban-summary { display: flex; align-items: center; gap: 12px; }
.ban-indicator { width: 40px; height: 40px; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; background: var(--success-bg); }
.ban-summary.banned .ban-indicator { background: var(--error-bg); }
.ban-icon { font-size: 20px; }
.ban-vac { color: var(--error); font-weight: 600; font-size: 14px; }
.ban-game { color: #ff9800; font-size: 13px; }
.ban-clean { color: var(--success); font-size: 14px; font-weight: 600; }
.ban-days { color: var(--text-muted); font-size: 12px; margin-top: 2px; }
.steam-info { display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 13px; }
.steam-avatar-sm { width: 28px; height: 28px; border-radius: var(--radius-full); }
/* Status bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  max-width: 560px;
  margin: 0 auto 24px;
  padding: 10px 20px 0;
  flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,.08);
}
.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--text-dim);
}
.status-dot.online {
  background: var(--success);
  box-shadow: var(--shadow-glow-green);
}
.status-icon {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
}
.status-label {
  font-size: 12px;
  color: var(--text-muted);
}
.status-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.status-value.online {
  color: var(--success);
}
.status-refresh {
  font-size: 11px;
  color: var(--text-dark);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

/* Search btn group */
.search-btn-group {
  display: flex;
  gap: 4px;
}

/* 搜索建议下拉 */
.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  margin-top: 4px;
  padding: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.suggestion-item:hover {
  background: var(--bg-hover);
}
.suggestion-icon {
  font-size: 12px;
  flex-shrink: 0;
}
.suggestion-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}
.suggestion-fav {
  font-size: 12px;
  flex-shrink: 0;
}
.history-btn {
  padding: 10px 12px;
  background: var(--bg-hover);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
}
.history-btn:hover {
  color: #d4a853;
  border-color: rgba(212,168,83,.3);
  background: rgba(212,168,83,.08);
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  width: 100%;
  max-width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  border: var(--border-light);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: var(--border-subtle);
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-close:hover { color: var(--text-primary); background: var(--bg-hover-strong); }
.modal-body {
  padding: 14px 20px 20px;
  overflow-y: auto;
  flex: 1;
}
.history-empty {
  text-align: center;
  color: var(--text-dim);
  padding: 40px 0;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}
.history-item:hover {
  background: var(--bg-hover);
}
.history-name {
  flex: 1;
  font-size: 14px;
  color: #d0d0d0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-name:hover { color: var(--text-primary); }
.history-fav, .history-del {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.history-fav:hover { background: var(--bg-hover); }
.history-del { color: var(--text-dim); }
.history-del:hover { color: var(--error); background: var(--error-bg); }
.history-actions {
  margin-top: 12px;
  text-align: center;
}
.clear-btn {
  padding: 8px 20px;
  background: transparent;
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}
.clear-btn:hover {
  color: var(--error);
  border-color: var(--error-border);
}

@media (max-width:640px) {
  .hero-title { font-size:32px; }
  .hero-section { padding:40px 20px 20px; }
  .stats-row { grid-template-columns:repeat(2,1fr); }
  .detail-grid { grid-template-columns:repeat(2,1fr); }
  .search-input { font-size:16px; }
  .player-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .player-meta { gap: 6px; }
  .badge { font-size: 10px; padding: 2px 8px; }
  .ban-status { align-self: flex-start; }
  .ban-badge { font-size: 12px; padding: 6px 12px; }
  .tabs { overflow-x: auto; }
  .tab-btn { font-size: 13px; padding: 8px 6px; white-space: nowrap; }
  .ban-info-bar { flex-direction: column; gap: 10px; align-items: flex-start; }
  .page-container { padding: 0 12px 40px; }
  .status-bar { gap: 12px; justify-content: flex-start; }
  .status-refresh { margin-left: 0; }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .stats-row { grid-template-columns:repeat(3,1fr); }
  .detail-grid { grid-template-columns:repeat(3,1fr); }
  .hero-title { font-size: 40px; }
  .player-header { gap: 14px; }
}
</style>
