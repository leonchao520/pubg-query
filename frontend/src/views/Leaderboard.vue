<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { t } from '@/i18n'
import { RouterLink } from 'vue-router'

// ── Types ──
interface PlayerStats {
  rankPoints: number
  wins: number
  games: number
  winRatio: number
  averageDamage: number
  averageKill: number
  kills: number
  kda: number
  averageRank: number
  tier: string
  subTier: string
}

interface PlayerEntry {
  id: string
  rank: number
  name: string
  stats: PlayerStats
}

interface Season {
  id: string
  attributes: {
    isCurrentSeason: boolean
  }
}

// ── Constants ──
const SHARDS = [
  { key: 'pc-na', label: '北美' },
  { key: 'pc-eu', label: '欧洲' },
  { key: 'pc-as', label: '亚洲' },
  { key: 'pc-krjp', label: '韩日' },
  { key: 'pc-sea', label: '东南亚' },
  { key: 'pc-sa', label: '南美' },
  { key: 'pc-oc', label: '大洋洲' },
  { key: 'pc-ru', label: '俄罗斯' },
]

const GAME_MODE = { key: 'squad', label: '四排-TPP' }

const TIER_COLORS: Record<string, string> = {
  Survivor: '#ff4444',
  Master: '#ffc328',
  Diamond: '#5cd6ff',
  Crystal: '#ff69b4',
  Platinum: '#5cb4ff',
  Gold: '#ffa500',
  Silver: '#c0c0c0',
  Bronze: '#cd7f32',
}

const TIER_CN: Record<string, string> = {
  Survivor: '生存者',
  Master: '宗师',
  Diamond: '钻石',
  Crystal: '水晶',
  Platinum: '铂金',
  Gold: '黄金',
  Silver: '白银',
  Bronze: '青铜',
}

const TIER_ORDER = ['Survivor', 'Master', 'Diamond', 'Crystal', 'Platinum', 'Gold', 'Silver', 'Bronze']

// ── State ──
const shard = ref('pc-as')
const seasonId = ref('')
const searchQuery = ref('')
const seasonList = ref<{ id: string; label: string; isCurrent: boolean }[]>([])
const players = ref<PlayerEntry[]>([])
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const sortField = ref<string>('rankPoints')
const sortDir = ref<string>('desc')

const seasonListLoaded = ref(false)

// ── Fetch season list (once, cached) ──
async function loadSeasonList() {
  if (seasonListLoaded.value) return
  try {
    const res = await fetch('/api/seasons')
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '获取赛季列表失败')
    const data: Season[] = json.data?.data || []
    seasonList.value = data.map((s: Season) => {
      const num = s.id.split('-').pop() || ''
      return { id: s.id, label: `S${num}`, isCurrent: s.attributes?.isCurrentSeason ?? false }
    })
    seasonListLoaded.value = true

    // Default to current season
    const cur = seasonList.value.find(s => s.isCurrent)
    if (cur) {
      seasonId.value = cur.id
    } else if (seasonList.value.length > 0) {
      const last = seasonList.value[seasonList.value.length - 1]
      if (last) seasonId.value = last.id
    }
  } catch (e: any) {
    error.value = e.message || '获取赛季列表失败'
  }
}

// ── Fetch leaderboard ──
async function fetchLeaderboard() {
  if (!seasonId.value) return
  loading.value = true
  error.value = ''
  players.value = []
  currentPage.value = 1
  searchQuery.value = ''

  try {
    const res = await fetch(`/api/leaderboard/${shard.value}/${seasonId.value}/${GAME_MODE.key}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '加载排行榜失败')

    const included: any[] = json.data?.included || []
    players.value = included
      .map((entry: any) => {
        const attr = entry.attributes
        if (!attr) return null
        const stats: PlayerStats = {
          rankPoints: attr.stats?.rankPoints ?? 0,
          wins: attr.stats?.wins ?? 0,
          games: attr.stats?.games ?? 0,
          winRatio: attr.stats?.winRatio ?? 0,
          averageDamage: attr.stats?.averageDamage ?? 0,
          averageKill: attr.stats?.averageKill ?? 0,
          kills: attr.stats?.kills ?? 0,
          kda: attr.stats?.kda ?? 0,
          averageRank: attr.stats?.averageRank ?? 0,
          tier: attr.stats?.tier ?? '',
          subTier: attr.stats?.subTier ?? '',
        }
        return {
          id: entry.id,
          rank: attr.rank ?? 0,
          name: attr.name ?? 'Unknown',
          stats,
        } as PlayerEntry
      })
      .filter(Boolean) as PlayerEntry[]
  } catch (e: any) {
    error.value = e.message || '加载排行榜失败'
  } finally {
    loading.value = false
  }
}

// ── Watchers ──
watch(shard, () => {
  fetchLeaderboard()
})

watch(seasonId, () => {
  fetchLeaderboard()
})

// ── Mount ──
onMounted(async () => {
  await loadSeasonList()
  if (seasonId.value) {
    fetchLeaderboard()
  }
})

// ── Search filter (client-side) ──
const filteredPlayers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return players.value
  return players.value.filter(p => p.name.toLowerCase().includes(q))
})

// ── Sorting ──
const sortedPlayers = computed(() => {
  const list = [...filteredPlayers.value]
  const field = sortField.value
  const dir = sortDir.value
  const isAvgRank = field === 'averageRank'
  list.sort((a, b) => {
    let aVal: number
    let bVal: number
    switch (field) {
      case 'rankPoints':
        aVal = a.stats.rankPoints
        bVal = b.stats.rankPoints
        break
      case 'games':
        aVal = a.stats.games
        bVal = b.stats.games
        break
      case 'wins':
        aVal = a.stats.wins
        bVal = b.stats.wins
        break
      case 'averageDamage':
        aVal = a.stats.averageDamage
        bVal = b.stats.averageDamage
        break
      case 'winRatio':
        aVal = a.stats.winRatio
        bVal = b.stats.winRatio
        break
      case 'averageRank':
        aVal = a.stats.averageRank
        bVal = b.stats.averageRank
        break
      case 'averageKill':
        aVal = a.stats.averageKill
        bVal = b.stats.averageKill
        break
      default:
        return 0
    }
    // For avgRank, lower is better (asc = 1 is best, desc = 10 is best)
    if (isAvgRank) {
      return dir === 'asc' ? aVal - bVal : bVal - aVal
    }
    // For all other columns, higher is better
    return dir === 'desc' ? bVal - aVal : aVal - bVal
  })
  // Re-number ranks after sorting
  return list.map((p, i) => ({ ...p, rank: i + 1 }))
})

// ── Sort toggle ──
function toggleSort(field: string) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    // avgRank: lower is better, so initial asc puts 1 first
    sortDir.value = field === 'averageRank' ? 'asc' : 'desc'
  }
  currentPage.value = 1
}

// ── Pagination ──
const totalPages = computed(() => Math.max(1, Math.ceil(sortedPlayers.value.length / pageSize.value)))

const pagedPlayers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return sortedPlayers.value.slice(start, start + pageSize.value)
})

function goPage(p: number) {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p
  }
}

function setPageSize(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

// Pagination visible range (max ~7 buttons, current centered)
const visiblePages = computed(() => {
  const t = totalPages.value
  const c = currentPage.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  if (c <= 3) return [1, 2, 3, 4, 5, -1, t]
  if (c >= t - 2) return [1, -1, t - 4, t - 3, t - 2, t - 1, t]
  return [1, -1, c - 1, c, c + 1, -1, t]
})

// ── Top cards ──
const topRP = computed(() => {
  const list = [...players.value].sort((a, b) => (b.stats.rankPoints || 0) - (a.stats.rankPoints || 0))
  return list[0] || null
})

const topAK = computed(() => {
  const list = [...players.value].sort((a, b) => (b.stats.averageKill || 0) - (a.stats.averageKill || 0))
  return list[0] || null
})

const topWR = computed(() => {
  const list = [...players.value].sort((a, b) => (b.stats.winRatio || 0) - (a.stats.winRatio || 0))
  return list[0] || null
})

// 计算段位分布
const tierDistribution = computed(() => {
  const dist: Record<string, number> = {}
  for (const p of players.value) {
    const t = p.stats.tier || 'Unknown'
    dist[t] = (dist[t] || 0) + 1
  }
  const total = players.value.length
  return TIER_ORDER.map(t => {
    const count = dist[t] || 0
    return {
      tier: t,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
    }
  }).filter(d => d.count > 0)
})

// ── Tier helpers ──
function insigniaUrl(tier: string): string {
  if (!tier) return ''
  const t = tier.charAt(0).toUpperCase() + tier.slice(1)
  return `/images/rank/${t}.webp`
}

function tierColorHex(tier: string): string {
  return TIER_COLORS[tier?.toLowerCase()] || '#888'
}

function tierLabel(tier: string): string {
  if (!tier) return '?'
  const key = tier.charAt(0).toUpperCase() + tier.slice(1)
  return TIER_CN[key] || key
}

// ── Format helpers ──
function tierRP(tier: string): string {
  const map: Record<string, string> = {
    Bronze: '0 - 1,499',
    Silver: '1,500 - 1,999',
    Gold: '2,000 - 2,499',
    Platinum: '2,500 - 3,199',
    Crystal: '3,200 - 3,899',
    Diamond: '3,900 - 4,999',
    Master: '5,000 - 5,999',
    Survivor: '6,000+',
  }
  return map[tier] || ''
}

function avgKill(k: number | undefined): string {
  return k != null ? k.toFixed(2) : '-'
}

function avgDmg(d: number | undefined): string {
  return d != null ? Math.round(d).toString() : '-'
}

function wrPct(r: number | undefined): string {
  return r != null ? (r * 100).toFixed(1) + '%' : '-'
}

function avgRank(r: number | undefined): string {
  return r != null ? r.toFixed(1) : '-'
}
</script>

<template>
  <div class="lb-page">
    <!-- ════════════════ Page Header ════════════════ -->
    <div class="lb-page-header">
      <h1 class="lb-page-title">{{ t('nav.leaderboard') }}</h1>
      <p class="lb-page-subtitle">{{ t('monitoring.region') }}...</p>
    </div>
    <!-- ════════════════ Filters Card ════════════════ -->
    <div class="lb-filters-card">
      <div class="lb-filters-row">
        <div class="lb-filter-group">
          <label class="lb-filter-label">{{ t('monitoring.region') }}</label>
          <div class="lb-select-wrapper">
            <select v-model="shard" class="lb-select">
              <option v-for="s in SHARDS" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
            <span class="lb-select-arrow">▾</span>
          </div>
        </div>

        <div class="lb-filter-group">
          <label class="lb-filter-label">{{ t('monitoring.season') }}</label>
          <div class="lb-select-wrapper">
            <select v-model="seasonId" class="lb-select">
              <option v-for="s in seasonList" :key="s.id" :value="s.id">
                {{ s.label }}<template v-if="s.isCurrent"> (当前)</template>
              </option>
            </select>
            <span class="lb-select-arrow">▾</span>
          </div>
        </div>

        <div class="lb-filter-group">
          <label class="lb-filter-label">模式</label>
          <div class="lb-select-wrapper">
            <select class="lb-select" disabled>
              <option>{{ GAME_MODE.label }}</option>
            </select>
            <span class="lb-select-arrow lb-select-arrow--disabled">▾</span>
          </div>
        </div>

        <div class="lb-filter-group lb-filter-group--search">
          <label class="lb-filter-label">搜索玩家</label>
          <div class="lb-search-wrapper">
            <svg class="lb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              class="lb-search-input"
              placeholder="输入玩家名筛选..."
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════ Top Player Cards ════════════════ -->
    <div v-if="players.length > 0 && !loading" class="lb-top-cards">
      <!-- Card 1: RP Highest -->
      <div class="lb-top-card">
        <div class="lb-top-card-main">
          <div class="lb-top-card-left">
            <img
              class="lb-top-card-badge"
              :src="insigniaUrl(topRP?.stats.tier ?? '')"
              alt="段位徽章"
            />
            <div class="lb-top-card-rp">{{ topRP?.stats.rankPoints?.toLocaleString() ?? '-' }} RP</div>
          </div>
          <div class="lb-top-card-right-side">
            <div class="lb-top-card-header-row">
              <div class="lb-top-card-info">
                <div class="lb-top-card-name">{{ topRP?.name ?? '-' }}</div>
                <div class="lb-top-card-tier-label">{{ tierLabel(topRP?.stats.tier || '') }}</div>
              </div>
              <div class="lb-top-card-rank">
                <div class="lb-top-card-right-label">RP 1st</div>
                <span class="lb-top-card-rank-badge">1st</span>
              </div>
            </div>
            <div class="lb-top-card-divider"></div>
            <div class="lb-top-card-stats">
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">场伤</span>
                <span class="lb-top-card-stat-value">{{ avgDmg(topRP?.stats.averageDamage) }}</span>
              </div>
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">胜率</span>
                <span class="lb-top-card-stat-value">{{ wrPct(topRP?.stats.winRatio) }}</span>
              </div>
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">均杀</span>
                <span class="lb-top-card-stat-value">{{ avgKill(topRP?.stats.averageKill) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 2: Avg Kill Highest -->
      <div class="lb-top-card">
        <div class="lb-top-card-main">
          <div class="lb-top-card-left">
            <img
              class="lb-top-card-badge"
              :src="insigniaUrl(topAK?.stats.tier ?? '')"
              alt="段位徽章"
            />
            <div class="lb-top-card-rp">{{ topAK?.stats.rankPoints?.toLocaleString() ?? '-' }} RP</div>
          </div>
          <div class="lb-top-card-right-side">
            <div class="lb-top-card-header-row">
              <div class="lb-top-card-info">
                <div class="lb-top-card-name">{{ topAK?.name ?? '-' }}</div>
                <div class="lb-top-card-tier-label">{{ tierLabel(topAK?.stats.tier || '') }}</div>
              </div>
              <div class="lb-top-card-rank">
                <div class="lb-top-card-right-label">场杀 1st</div>
                <span class="lb-top-card-rank-badge">1st</span>
              </div>
            </div>
            <div class="lb-top-card-divider"></div>
            <div class="lb-top-card-stats">
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">场伤</span>
                <span class="lb-top-card-stat-value">{{ avgDmg(topAK?.stats.averageDamage) }}</span>
              </div>
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">胜率</span>
                <span class="lb-top-card-stat-value">{{ wrPct(topAK?.stats.winRatio) }}</span>
              </div>
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">均杀</span>
                <span class="lb-top-card-stat-value">{{ avgKill(topAK?.stats.averageKill) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Win Ratio Highest -->
      <div class="lb-top-card">
        <div class="lb-top-card-main">
          <div class="lb-top-card-left">
            <img
              class="lb-top-card-badge"
              :src="insigniaUrl(topWR?.stats.tier ?? '')"
              alt="段位徽章"
            />
            <div class="lb-top-card-rp">{{ topWR?.stats.rankPoints?.toLocaleString() ?? '-' }} RP</div>
          </div>
          <div class="lb-top-card-right-side">
            <div class="lb-top-card-header-row">
              <div class="lb-top-card-info">
                <div class="lb-top-card-name">{{ topWR?.name ?? '-' }}</div>
                <div class="lb-top-card-tier-label">{{ tierLabel(topWR?.stats.tier || '') }}</div>
              </div>
              <div class="lb-top-card-rank">
                <div class="lb-top-card-right-label">胜率 1st</div>
                <span class="lb-top-card-rank-badge">1st</span>
              </div>
            </div>
            <div class="lb-top-card-divider"></div>
            <div class="lb-top-card-stats">
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">场伤</span>
                <span class="lb-top-card-stat-value">{{ avgDmg(topWR?.stats.averageDamage) }}</span>
              </div>
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">胜率</span>
                <span class="lb-top-card-stat-value">{{ wrPct(topWR?.stats.winRatio) }}</span>
              </div>
              <div class="lb-top-card-stat">
                <span class="lb-top-card-stat-label">均杀</span>
                <span class="lb-top-card-stat-value">{{ avgKill(topWR?.stats.averageKill) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════ Loading ─═══════════════ -->
    <div v-if="loading" class="lb-card lb-card--loading">
      <div class="lb-spinner"></div>
      <p class="lb-loading-text">正在加载排行榜...</p>
    </div>

    <!-- ════════════════ Error ─═══════════════ -->
    <div v-else-if="error" class="lb-card lb-card--error">
      <span class="lb-error-icon">⚠️</span>
      <p class="lb-error-text">{{ error }}</p>
      <button class="lb-btn" @click="fetchLeaderboard">重新加载</button>
    </div>

    <!-- ════════════════ Empty ─═══════════════ -->
    <div v-else-if="players.length === 0 && !loading" class="lb-card lb-card--empty">
      <span class="lb-empty-icon">🏆</span>
      <p class="lb-empty-text">暂无排行榜数据</p>
      <p class="lb-empty-hint">请尝试切换{{ t('monitoring.region') }}或{{ t('monitoring.season') }}</p>
    </div>

    <!-- ════════════════ Table ─═══════════════ -->
    <div v-else class="lb-card">
      <div class="lb-table-wrap">
        <table class="lb-table">
          <thead>
            <tr>
              <th class="lb-th-rank">#</th>
              <th class="lb-th-name">玩家名</th>
              <th class="lb-th-stat lb-th-rp lb-th-sortable" @click="toggleSort('rankPoints')">
                RP
                <span v-if="sortField === 'rankPoints'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="lb-th-stat lb-th-sortable" @click="toggleSort('games')">
                场次
                <span v-if="sortField === 'games'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="lb-th-stat lb-th-sortable" @click="toggleSort('wins')">
                胜场
                <span v-if="sortField === 'wins'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="lb-th-stat lb-th-sortable" @click="toggleSort('averageDamage')">
                场伤
                <span v-if="sortField === 'averageDamage'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="lb-th-stat lb-th-sortable" @click="toggleSort('winRatio')">
                胜率
                <span v-if="sortField === 'winRatio'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="lb-th-stat lb-th-sortable" @click="toggleSort('averageRank')">
                均排
                <span v-if="sortField === 'averageRank'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="lb-th-stat lb-th-sortable" @click="toggleSort('averageKill')">
                均杀
                <span v-if="sortField === 'averageKill'" class="lb-sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, idx) in pagedPlayers"
              :key="p.id"
              class="lb-row"
            >
              <!-- Rank -->
              <td class="lb-td-rank">
                <template v-if="p.rank === 1">
                  <span class="lb-rank-medal lb-rank-medal--gold">🥇</span>
                </template>
                <template v-else-if="p.rank === 2">
                  <span class="lb-rank-medal lb-rank-medal--silver">🥈</span>
                </template>
                <template v-else-if="p.rank === 3">
                  <span class="lb-rank-medal lb-rank-medal--bronze">🥉</span>
                </template>
                <template v-else>
                  <span class="lb-rank-num">{{ p.rank }}</span>
                </template>
              </td>

              <!-- Player name -->
              <td class="lb-td-name">
                <img
                  class="lb-tier-icon"
                  :src="insigniaUrl(p.stats.tier)"
                  alt="段位"
                />
                <RouterLink :to="{ path: '/', query: { q: p.name } }" class="lb-player-link">{{ p.name }}</RouterLink>
              </td>

              <!-- RP -->
              <td class="lb-td-stat lb-td-rp">{{ (p.stats.rankPoints || 0).toLocaleString() }}</td>

              <!-- Games -->
              <td class="lb-td-stat">{{ (p.stats.games || 0).toLocaleString() }}</td>

              <!-- Wins -->
              <td class="lb-td-stat">{{ (p.stats.wins || 0).toLocaleString() }}</td>

              <!-- Avg damage -->
              <td class="lb-td-stat">{{ avgDmg(p.stats.averageDamage) }}</td>

              <!-- Win rate -->
              <td class="lb-td-stat">{{ wrPct(p.stats.winRatio) }}</td>

              <!-- Avg rank -->
              <td class="lb-td-stat">{{ avgRank(p.stats.averageRank) }}</td>

              <!-- Avg kill -->
              <td class="lb-td-stat">{{ avgKill(p.stats.averageKill) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- No search results -->
      <div v-if="filteredPlayers.length === 0 && searchQuery" class="lb-no-results">
        <p>未找到匹配 "{{ searchQuery }}" 的玩家</p>
      </div>

      <!-- ═══ Pagination ═══ -->
      <div class="lb-pagination" v-if="sortedPlayers.length > 0">
        <div class="lb-pagination-left">
          <div class="lb-select-wrapper lb-page-size-select">
            <select class="lb-select lb-select--sm" :value="pageSize" @change="setPageSize(Number(($event.target as HTMLSelectElement).value))">
              <option :value="50">50 条/页</option>
              <option :value="100">100 条/页</option>
            </select>
            <span class="lb-select-arrow">▾</span>
          </div>
        </div>

        <div class="lb-pagination-center">
          <button
            class="lb-page-btn"
            :disabled="currentPage <= 1"
            @click="goPage(currentPage - 1)"
          >上一页</button>

          <template v-for="(p, i) in visiblePages" :key="i">
            <span v-if="p === -1" class="lb-page-ellipsis">...</span>
            <button
              v-else
              :class="['lb-page-btn', { 'lb-page-btn--active': p === currentPage }]"
              @click="goPage(p)"
            >{{ p }}</button>
          </template>

          <button
            class="lb-page-btn"
            :disabled="currentPage >= totalPages"
            @click="goPage(currentPage + 1)"
          >下一页</button>
        </div>

        <span class="lb-page-info">{{ sortedPlayers.length }} 名玩家 / {{ totalPages }} 页</span>
      </div>
    </div>

    <!-- ════════════════ Data Dashboard ════════════════ -->
    <div class="lb-dashboard">
      <!-- Tier Distribution Chart -->
      <section v-if="tierDistribution.length > 0 && !loading" class="lb-dash-section lb-dash-tiers" style="margin-bottom: 24px;">
        <h3 class="lb-dash-heading">
          <svg class="lb-dash-heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          段位人数分布 (Top 500)
        </h3>
        <div class="lb-tiers-dist-card glass" style="padding: 24px;">
          <div class="dist-bars" style="display: flex; flex-direction: column; gap: 16px;">
            <div v-for="d in tierDistribution" :key="d.tier" class="dist-item" style="display: flex; align-items: center; gap: 12px;">
              <img :src="insigniaUrl(d.tier)" :alt="d.tier" style="width: 32px; height: 32px; object-fit: contain;" />
              <div class="dist-info" style="width: 120px; font-weight: 600; color: #fff;">
                {{ tierLabel(d.tier) }}
              </div>
              <div class="dist-progress-wrap" style="flex: 1; background: rgba(255,255,255,0.05); height: 10px; border-radius: 5px; overflow: hidden; position: relative;">
                <div class="dist-progress-bar" :style="{ width: d.percentage + '%', background: tierColorHex(d.tier) }" style="height: 100%; border-radius: 5px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);"></div>
              </div>
              <div class="dist-value" style="width: 100px; text-align: right; color: var(--text-muted); font-size: 13px;">
                <span style="color: #fff; font-weight: 600; margin-right: 4px;">{{ d.count }}</span> 占 {{ d.percentage }}%
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Tier Showcase -->
      <section class="lb-dash-section lb-dash-tiers">
        <h3 class="lb-dash-heading">
          <svg class="lb-dash-heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7s0-3 2.5-3a2.5 2.5 0 0 1 0 5H8"/><path d="M12 9V2l3 4h-3"/><circle cx="12" cy="15" r="3"/><path d="M12 18v4"/></svg>
          排位等级体系
        </h3>
        <div class="lb-tiers-grid">
          <div
            v-for="t in ['Bronze','Silver','Gold','Platinum','Crystal','Diamond','Master','Survivor']"
            :key="t"
            class="lb-tier-hex"
            :style="{ '--tier-color': tierColorHex(t) }"
          >
            <div class="lb-tier-hex-bg"></div>
            <img :src="`/images/rank/${t}.webp`" :alt="t" class="lb-tier-hex-img" />
            <div class="lb-tier-hex-label">{{ TIER_CN[t] || t }}</div>
            <div class="lb-tier-hex-rp">{{ tierRP(t) }}</div>
          </div>
        </div>
      </section>

      <!-- Info Cards -->
      <section class="lb-dash-cards">
        <div class="lb-dash-card">
          <div class="lb-dash-card-icon">📊</div>
          <h4>评分标准</h4>
          <p>竞技排名分（RP）是衡量玩家在 Ranked 模式中竞技水平的核心指标。系统根据每局比赛的击杀数、助攻数、生存排名及对手水平综合计算 RP 加减。</p>
          <ul>
            <li><strong>击杀与助攻</strong> — 击倒/淘汰高段位对手获得更多 RP；低段位则较少</li>
            <li><strong>生存排名</strong> — 名次越靠前，RP 奖励越丰厚</li>
            <li><strong>队伍贡献</strong> — 团队协作、救援等行为也纳入评估</li>
            <li><strong>定分赛</strong> — 新{{ t('monitoring.season') }}前 5 局为定分赛，RP 变动幅度较大</li>
          </ul>
        </div>

        <div class="lb-dash-card">
          <div class="lb-dash-card-icon">⏳</div>
          <h4>段位衰减</h4>
          <p>达到钻石及以上段位后，若连续 7 天未进行任何排位比赛，RP 将开始每日自动衰减。</p>
          <ul>
            <li><strong>钻石</strong> — 7 天不活跃后，每天衰减约 50 RP</li>
            <li><strong>大师及以上</strong> — 衰减速度更快，每天约 100 RP</li>
            <li><strong>衰减下限</strong> — 最低降至钻石 V（不会跌出钻石段位）</li>
            <li><strong>恢复方式</strong> — 完成一场排位比赛即可暂停衰减</li>
          </ul>
        </div>

        <div class="lb-dash-card">
          <div class="lb-dash-card-icon">🏆</div>
          <h4>排行榜说明</h4>
          <p>{{ t('nav.leaderboard') }}由 PUBG 官方维护，展示各服务器排名前 500 的玩家。</p>
          <ul>
            <li><strong>更新频率</strong> — 官方每小时更新一次，本站同步缓存</li>
            <li><strong>分区独立</strong> — 北美/欧洲/亚洲等 8 个服务器各自独立排名</li>
            <li><strong>模式划分</strong> — 当前仅展示四排 TPP 模式排行榜</li>
            <li><strong>数据来源</strong> — 基于 PUBG 官方 Open API 拉取，与游戏内一致</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ════════════════ Root ════════════════ */
.lb-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px 60px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #e5e5e5;
}

/* ════════════════ Filters Card ════════════════ */
.lb-page-header {
  text-align: center;
  margin-bottom: 20px;
}

.page-container {
  font-family: var(--font-sans);
}
.lb-page-title {
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 1px;
}

.lb-page-subtitle {
  font-size: 14px;
  color: #888;
  margin-top: 6px;
}

.lb-filters-card {
  background: rgba(31, 31, 31, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 24px;
}

.lb-filters-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.lb-filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 120px;
}

.lb-filter-group--search {
  flex: 1;
  min-width: 200px;
}

.lb-filter-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Select ── */
.lb-select-wrapper {
  position: relative;
}

.lb-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  padding: 10px 36px 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  outline: none;
}

.lb-select:hover {
  border-color: rgba(123, 104, 238, 0.4);
  background: rgba(255, 255, 255, 0.07);
}

.lb-select:focus {
  border-color: #7b68ee;
  box-shadow: 0 0 0 3px rgba(123, 104, 238, 0.15);
}

.lb-select:disabled {
  opacity: 0.5;
  cursor: default;
}

.lb-select option {
  background: #1a1a1a;
  color: #e0e0e0;
}

.lb-select-arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #777;
  pointer-events: none;
}

.lb-select-arrow--disabled {
  opacity: 0.3;
}

/* ── Search ── */
.lb-search-wrapper {
  position: relative;
}

.lb-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #666;
  pointer-events: none;
}

.lb-search-input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;
}

.lb-search-input::placeholder {
  color: #555;
}

.lb-search-input:hover {
  border-color: rgba(123, 104, 238, 0.4);
  background: rgba(255, 255, 255, 0.07);
}

.lb-search-input:focus {
  border-color: #7b68ee;
  box-shadow: 0 0 0 3px rgba(123, 104, 238, 0.15);
}

/* ════════════════ Top Cards ════════════════ */
.lb-top-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.lb-top-card {
  background: linear-gradient(135deg, #1e1e22, #16161a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, border-color 0.2s;
}

.lb-top-card:hover {
  transform: translateY(-2px);
  border-color: rgba(123, 104, 238, 0.3);
}

/* Main row: left big badge + right side all content */
.lb-top-card-main {
  display: flex;
  align-items: stretch;
  gap: 20px;
}

/* ── Left: tier badge (large) + RP ── */
.lb-top-card-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 80px;
}

.lb-top-card-badge {
  width: 72px;
  height: 72px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,.5));
}

.lb-top-card-badge-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  line-height: 1.2;
}

.lb-top-card-rp {
  font-size: 14px;
  font-weight: 800;
  color: #d4a853;
  white-space: nowrap;
}

/* ── Right side: header row + divider + stats ── */
.lb-top-card-right-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lb-top-card-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.lb-top-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── Middle: name + tier subtitle ── */
.lb-top-card-middle {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lb-top-card-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-top-card-tier-label {
  font-size: 12px;
  color: #888;
}

/* ── Right: rank badge ── */
.lb-top-card-rank {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.lb-top-card-right {
  flex-shrink: 0;
}

.lb-top-card-right-label {
  font-size: 11px;
  font-weight: 600;
  color: #d4a853;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.lb-top-card-rank-badge {
  font-size: 28px;
  font-weight: 900;
  font-style: italic;
  background: linear-gradient(135deg, #f97316, #ef4444, #d4a853);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Divider ── */
.lb-top-card-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 16px 0 14px;
}

/* ── Stats row (grid-3) ── */
.lb-top-card-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.lb-top-card-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.lb-top-card-stat-label {
  font-size: 11px;
  font-weight: 500;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.lb-top-card-stat-value {
  font-size: 17px;
  font-weight: 700;
  color: #e0e0e0;
  font-variant-numeric: tabular-nums;
}

/* ════════════════ Card ════════════════ */
.lb-card {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  overflow: hidden;
}

.lb-card--loading,
.lb-card--error,
.lb-card--empty {
  padding: 80px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* ── Spinner ── */
.lb-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(123, 104, 238, 0.2);
  border-top-color: #7b68ee;
  border-radius: 50%;
  animation: lb-spin 0.8s linear infinite;
}

@keyframes lb-spin {
  to { transform: rotate(360deg); }
}

.lb-loading-text {
  color: #777;
  font-size: 14px;
}

/* ── Error / Empty ── */
.lb-error-icon,
.lb-empty-icon {
  font-size: 40px;
}

.lb-error-text {
  color: #ff6b6b;
  font-size: 15px;
  font-weight: 500;
}

.lb-empty-text {
  color: #888;
  font-size: 15px;
}

.lb-empty-hint {
  font-size: 13px;
  color: #555;
}

.lb-btn {
  padding: 10px 24px;
  background: rgba(123, 104, 238, 0.15);
  border: 1px solid rgba(123, 104, 238, 0.25);
  border-radius: 8px;
  color: #7b68ee;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.lb-btn:hover {
  background: rgba(123, 104, 238, 0.25);
  border-color: rgba(123, 104, 238, 0.4);
}

/* ════════════════ Table ════════════════ */
.lb-table-wrap {
  overflow-x: auto;
}

.lb-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 880px;
}

.lb-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.lb-table th {
  padding: 14px 10px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #1a1a1a;
  border-bottom: 2px solid #7b68ee;
  white-space: nowrap;
}

.lb-th-rank { width: 50px; text-align: center; }
.lb-th-name { min-width: 140px; }
.lb-th-tier-col { width: 100px; }
.lb-th-stat { width: 72px; text-align: center; }
.lb-th-rp { width: 80px; color: #7b68ee; }

/* ── Sortable column header ── */
.lb-th-sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.lb-th-sortable:hover {
  color: #7b68ee;
}

.lb-sort-arrow {
  display: inline-block;
  margin-left: 3px;
  font-size: 10px;
  color: #7b68ee;
  vertical-align: middle;
}

/* ── Rows ── */
.lb-table td {
  padding: 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 14px;
}

.lb-row {
  transition: background 0.12s ease;
}

.lb-row:hover {
  background: rgba(123, 104, 238, 0.08);
}

/* ── Rank ── */
.lb-td-rank {
  text-align: center;
}

.lb-rank-medal {
  font-size: 18px;
  line-height: 1;
}

.lb-rank-num {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

/* ── Player name ── */
.lb-td-name {
  font-weight: 600;
  color: #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lb-tier-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.lb-tier-dot-fallback {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lb-player-link {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e0e0e0;
  text-decoration: none;
  transition: color 0.15s;
}

.lb-player-link:hover {
  color: #d4a853;
}

/* ── Tier badge ── */
.lb-tier-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 4px 12px 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.lb-tier-sub {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 8px;
  background: #1a1a1a;
  color: #ccc;
  font-size: 10px;
  font-weight: 700;
  border: 1.5px solid currentColor;
  line-height: 1;
}

/* ── Stat cells ── */
.lb-td-stat {
  text-align: center;
  color: #aaa;
  font-variant-numeric: tabular-nums;
}

.lb-td-rp {
  color: #d4a853;
  font-weight: 700;
  font-size: 14px;
}

/* ════════════════ No search results ════════════════ */
.lb-no-results {
  padding: 40px 20px;
  text-align: center;
}

.lb-no-results p {
  color: #666;
  font-size: 14px;
}

/* ════════════════ Pagination ════════════════ */
.lb-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  flex-wrap: wrap;
}

.lb-pagination-left {
  flex-shrink: 0;
}

.lb-page-size-select {
  width: 110px;
}

.lb-select--sm {
  padding: 6px 30px 6px 10px;
  font-size: 12px;
}

.lb-pagination-center {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.lb-page-btn {
  padding: 7px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #999;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.lb-page-btn:hover:not(:disabled) {
  background: rgba(123, 104, 238, 0.12);
  border-color: rgba(123, 104, 238, 0.3);
  color: #d0d0d0;
}

.lb-page-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.lb-page-btn--active {
  background: #7b68ee;
  border-color: #7b68ee;
  color: #fff;
  font-weight: 700;
}

.lb-page-ellipsis {
  padding: 7px 4px;
  color: #555;
  font-size: 13px;
}

.lb-page-info {
  margin-left: 12px;
  font-size: 12px;
  color: #555;
}

/* ════════════════ Responsive ════════════════ */
@media (max-width: 768px) {
  .lb-page {
    padding: 20px 12px 40px;
  }

  .lb-filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .lb-filter-group {
    min-width: unset;
  }

  .lb-top-cards {
    grid-template-columns: 1fr;
  }

  .lb-top-card {
    padding: 20px;
  }

  .lb-top-card-main {
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .lb-top-card-left {
    flex-direction: row;
    gap: 12px;
    min-width: 0;
  }

  .lb-top-card-left .lb-top-card-badge {
    width: 52px;
    height: 52px;
  }

  .lb-top-card-left .lb-top-card-rp {
    font-size: 13px;
  }

  .lb-top-card-right-side {
    width: 100%;
  }

  .lb-top-card-header-row {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .lb-top-card-rank {
    align-items: center;
    flex-direction: row;
    gap: 8px;
  }

  .lb-top-card-rank-badge {
    font-size: 24px;
  }

  .lb-top-card-stats {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .lb-top-card-stat-value {
    font-size: 18px;
  }

  .lb-table {
    min-width: 700px;
  }

  .lb-tiers-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .lb-dash-cards {
    grid-template-columns: 1fr;
  }
}

/* ════════════════ Data Dashboard ════════════════ */
.lb-dashboard {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.lb-dash-section {
  background: linear-gradient(145deg, #18181b, #111115);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 28px;
  overflow: hidden;
}

.lb-dash-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #d4a853;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 24px;
}

.lb-dash-heading-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* ── Tier Hex Grid ── */
.lb-tiers-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.lb-tier-hex {
  position: relative;
  background: linear-gradient(160deg, rgba(30,30,35,.9), rgba(20,20,24,.95));
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  padding: 20px 12px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
  overflow: hidden;
}

.lb-tier-hex:hover {
  transform: translateY(-4px);
  border-color: var(--tier-color, rgba(123,104,238,.4));
  box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 0 20px rgba(var(--tier-color, 123,104,238), .15);
}

.lb-tier-hex-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 20%, var(--tier-color, rgba(123,104,238,.08)) 0%, transparent 70%);
  opacity: 0.12;
  pointer-events: none;
}

.lb-tier-hex-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,.4));
  position: relative;
  z-index: 1;
}

.lb-tier-hex-label {
  font-size: 13px;
  font-weight: 700;
  color: #d4a853;
  letter-spacing: .5px;
  position: relative;
  z-index: 1;
}

.lb-tier-hex-rp {
  font-size: 11px;
  font-weight: 500;
  color: #666;
  letter-spacing: .3px;
  position: relative;
  z-index: 1;
}

/* ── Info Cards Grid ── */
.lb-dash-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.lb-dash-card {
  background: linear-gradient(160deg, rgba(30,30,35,.85), rgba(18,18,22,.9));
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 16px;
  padding: 24px;
  transition: border-color .25s ease, transform .2s ease;
}

.lb-dash-card:hover {
  border-color: rgba(212,168,83,.25);
  transform: translateY(-2px);
}

.lb-dash-card-icon {
  font-size: 28px;
  margin-bottom: 12px;
}

.lb-dash-card h4 {
  font-size: 14px;
  font-weight: 700;
  color: #d4a853;
  letter-spacing: .5px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.lb-dash-card p {
  font-size: 13px;
  color: #999;
  line-height: 1.65;
  margin-bottom: 14px;
}

.lb-dash-card ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lb-dash-card li {
  font-size: 12.5px;
  color: #888;
  line-height: 1.6;
  padding-left: 14px;
  position: relative;
}

.lb-dash-card li::before {
  content: '▸';
  position: absolute;
  left: 0;
  top: 0;
  color: #d4a853;
  font-size: 10px;
  line-height: inherit;
}

.lb-dash-card li strong {
  color: #b0b0b0;
  font-weight: 600;
}

@media (max-width: 768px) {
  .lb-tiers-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .lb-tier-hex {
    padding: 14px 8px 10px;
  }

  .lb-tier-hex-img {
    width: 36px;
    height: 36px;
  }

  .lb-tier-hex-label {
    font-size: 11px;
  }

  .lb-tier-hex-rp {
    font-size: 10px;
  }

  .lb-dash-cards {
    grid-template-columns: 1fr;
  }
}
</style>
