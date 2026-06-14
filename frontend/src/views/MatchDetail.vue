<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { t } from '@/i18n'
import { useRoute } from 'vue-router'
import { getMatch } from '@/api'

const route = useRoute()
const matchData = ref<any>(null)
const loading = ref(true)
const error = ref('')

const matchId = computed(() => route.params.matchId as string)

const mapNames: Record<string, string> = {
  'Baltic_Main': '艾伦格', 'Chimera_Main': '帕拉莫', 'Desert_Main': '米拉玛',
  'DihorOtok_Main': '维寒迪', 'Erangel_Main': '艾伦格', 'Heaven_Main': '天堂度假村',
  'Kiki_Main': '荣都', 'RANGE_Main': '训练场', 'Savage_Main': '萨诺',
  'Summerland_Main': '卡拉金', 'Tiger_Main': '泰戈',
}

const participants = computed(() => {
  if (!matchData.value?.included) return []
  return matchData.value.included
    .filter((i: any) => i.type === 'participant')
    .map((p: any) => ({
      name: p.attributes?.stats?.name || 'Unknown',
      kills: p.attributes?.stats?.kills || 0,
      damage: p.attributes?.stats?.damageDealt || 0,
      assists: p.attributes?.stats?.assists || 0,
      knocks: p.attributes?.stats?.DBNOs || 0,
      deathType: p.attributes?.stats?.deathType || '',
      surviveTime: p.attributes?.stats?.timeSurvived || 0,
      winPlace: p.attributes?.stats?.winPlace || 0,
    }))
    .sort((a: any, b: any) => a.winPlace - b.winPlace)
})

const rosters = computed(() => {
  if (!matchData.value?.included) return []
  return matchData.value.included
    .filter((i: any) => i.type === 'roster')
    .map((r: any) => ({
      rank: r.attributes?.stats?.rank || 0,
      teamId: r.attributes?.stats?.teamId || '',
      participants: r.relationships?.participants?.data?.map((p: any) => {
        const participant = matchData.value.included.find((i: any) => i.id === p.id)
        return {
          name: participant?.attributes?.stats?.name || 'Unknown',
          kills: participant?.attributes?.stats?.kills || 0,
        }
      }) || [],
    }))
    .sort((a: any, b: any) => a.rank - b.rank)
})

const matchInfo = computed(() => {
  if (!matchData.value?.data?.attributes) return null
  const attr = matchData.value.data.attributes
  return {
    mapName: mapNames[attr.mapName] || attr.mapName || '未知地图',
    duration: Math.round((attr.duration || 0) / 60),
    gameMode: attr.gameMode || '',
    createdAt: attr.createdAt ? new Date(attr.createdAt).toLocaleString() : '',
  }
})

onMounted(async () => {
  try {
    const data = await getMatch(matchId.value)
    matchData.value = data
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-container">
    <div v-if="loading" class="loading-section">
      <div class="loader"><svg viewBox="0 0 44 44"><rect x="1" y="1" width="42" height="42" /></svg><span class="letter">M</span></div>
      <p>{{ t('search.loading') }}</p>
    </div>

    <div v-if="error" class="error-card glass">{{ error }}</div>

    <div v-if="matchInfo && !loading" class="match-header glass">
      <div class="match-map">{{ matchInfo.mapName }}</div>
      <div class="match-meta">
        <span class="tag">{{ matchInfo.gameMode }}</span>
        <span class="tag">{{ matchInfo.duration }}  {{ t('stat.minutes') }}</span>
        <span class="tag">{{ matchInfo.createdAt }}</span>
      </div>
    </div>

    <!-- 队伍列表 -->
    <div v-if="rosters.length > 0 && !loading" class="rosters-section">
      <h2 class="section-title">{{ t('stat.team_ranking') }}</h2>
      <div v-for="roster in rosters" :key="roster.rank" class="roster-card glass">
        <div class="roster-header">
          <span :class="['roster-rank', { gold: roster.rank === 1, silver: roster.rank === 2, bronze: roster.rank === 3 }]">
            #{{ roster.rank }}
          </span>
          <span class="roster-team">队伍 {{ roster.teamId }}</span>
        </div>
        <div class="roster-players">
          <div v-for="p in roster.participants" :key="p.name" class="roster-player">
            <span class="rp-name">{{ p.name }}</span>
            <span class="rp-kills">{{ p.kills }} 杀</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container { max-width: 800px; margin: 0 auto; padding: 40px 20px 60px; }
.glass { background: linear-gradient(135deg,#2d2d2d,#1f1f1f); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; }
.loading-section { text-align: center; padding: 60px; color: #888; }
.loader { width:44px; height:44px; position:relative; margin:0 auto 16px; }
.loader svg { width:100%; height:100%; }
.loader svg rect { fill:none; stroke:#7b68ee; stroke-width:3; stroke-dasharray:192 64 192 64; animation:3s infinite pathRect; }
.loader .letter { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:18px; color:#7b68ee; }
@keyframes pathRect { 25%{stroke-dashoffset:64} 50%{stroke-dashoffset:128} 75%{stroke-dashoffset:192} 100%{stroke-dashoffset:256} }
.error-card { padding: 16px; margin-bottom: 20px; color: #ff6b6b; text-align: center; }
.match-header { padding: 24px; margin-bottom: 20px; text-align: center; }
.match-map { font-size: 28px; font-weight: 800; color: #fff; }
.match-meta { display: flex; gap: 8px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
.tag { font-size: 12px; padding: 4px 12px; background: rgba(255,255,255,.06); color: #a3a3a3; border-radius: 20px; }
.section-title { font-size: 16px; font-weight: 600; color: #ccc; margin-bottom: 12px; }
.rosters-section { margin-bottom: 20px; }
.roster-card { padding: 16px; margin-bottom: 8px; }
.roster-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.roster-rank { font-size: 18px; font-weight: 800; min-width: 40px; }
.roster-rank.gold { color: #ffc328; }
.roster-rank.silver { color: #e0e0e0; }
.roster-rank.bronze { color: #cd7f32; }
.roster-team { font-size: 13px; color: #888; }
.roster-players { display: flex; flex-direction: column; gap: 6px; }
.roster-player { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(255,255,255,.03); border-radius: 6px; }
.rp-name { font-size: 13px; color: #ccc; }
.rp-kills { font-size: 12px; color: #7b68ee; font-weight: 600; }
</style>
