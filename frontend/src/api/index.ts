const API_BASE = '/api'

async function fetchJSON(url: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Request failed')
  return data.data
}

// 玩家完整查询（一次返回所有数据）
export async function searchPlayerFull(name: string, platform = 'steam') {
  const res = await fetch(`${API_BASE}/player/${encodeURIComponent(name)}/full?platform=${platform}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Request failed')
  return data.data
}

// 玩家基础信息
export async function searchPlayer(name: string, platform = 'steam') {
  return fetchJSON(`${API_BASE}/player/${encodeURIComponent(name)}?platform=${platform}`)
}

// 玩家赛季统计
export async function getPlayerSeason(name: string, platform = 'steam') {
  return fetchJSON(`${API_BASE}/player/${encodeURIComponent(name)}/season?platform=${platform}`)
}

// 赛季列表
export async function getSeasons(platform = 'steam') {
  return fetchJSON(`${API_BASE}/seasons?platform=${platform}`)
}

// 排行榜
export async function getLeaderboard(platform: string, season: string, gameMode: string) {
  return fetchJSON(`${API_BASE}/leaderboard/${platform}/${season}/${gameMode}`)
}

// 对局详情
export async function getMatch(matchId: string, platform = 'steam') {
  return fetchJSON(`${API_BASE}/match/${matchId}?platform=${platform}`)
}

// 玩家最近对局
export async function getPlayerMatches(name: string, platform = 'steam') {
  return fetchJSON(`${API_BASE}/player/${encodeURIComponent(name)}/matches?platform=${platform}`)
}
