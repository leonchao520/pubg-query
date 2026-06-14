/**
 * 排行榜快照存储系统
 * - 每次获取排行榜数据时自动保存快照
 * - 快照存储为独立 JSON 文件到 snapshots/ 目录
 * - 文件名格式：{platform}_{season}_{gameMode}_{YYYYMMDD-HHmm}.json
 * - 保留最近 48 小时的快照，超过 48 小时自动清理
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.join(__dirname, '..', 'snapshots');
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 小时

// 确保快照目录存在
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

/**
 * 格式化时间为文件名友好格式 YYYYMMDD-HHmm
 */
function formatTimestamp(ts) {
  const d = new Date(ts);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}${M}${D}-${h}${m}`;
}

/**
 * 构建快照文件名
 */
function snapshotFileName(platform, season, gameMode, timestamp) {
  const ts = formatTimestamp(timestamp);
  return `${platform}_${season}_${gameMode}_${ts}.json`;
}

/**
 * 清理超过 48 小时的旧快照
 */
function cleanupOldSnapshots() {
  const now = Date.now();
  const cutoff = now - MAX_AGE_MS;
  try {
    const files = fs.readdirSync(SNAPSHOT_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(SNAPSHOT_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          console.log(`[snapshots] cleaned up old: ${file}`);
        }
      } catch (e) {
        // 忽略单文件错误
      }
    }
  } catch (e) {
    console.error(`[snapshots] cleanup error: ${e.message}`);
  }
}

/**
 * 保存排行榜快照
 * @param {string} platform - 平台，如 pc-na
 * @param {string} season - 赛季 ID
 * @param {string} gameMode - 游戏模式
 * @param {Array} included - PUBG API 返回的 included 数组（玩家数据）
 * @returns {object} 快照对象
 */
function saveSnapshot(platform, season, gameMode, included) {
  const now = Date.now();

  // 清理旧文件（非阻塞，每次保存时顺便清理）
  setImmediate(() => {
    try { cleanupOldSnapshots(); } catch (e) {}
  });

  const players = (included || []).map(p => ({
    id: p.id,
    name: p.attributes?.name || '',
    rankPoints: p.attributes?.stats?.rankPoints || p.attributes?.rankPoints || 0,
    tier: p.attributes?.rankedGameModeStats?.[gameMode]?.currentTier?.tier || p.attributes?.tier || '',
    subTier: p.attributes?.rankedGameModeStats?.[gameMode]?.currentTier?.subTier || p.attributes?.subTier || ''
  }));

  const snapshot = {
    platform,
    season,
    gameMode,
    timestamp: new Date().toISOString(),
    players
  };

  const fileName = snapshotFileName(platform, season, gameMode, now);
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`[snapshots] saved: ${fileName} (${players.length} players)`);

  return snapshot;
}

/**
 * 获取指定组合的所有快照时间戳列表
 * @param {string} platform
 * @param {string} season
 * @param {string} gameMode
 * @returns {Array<{file, timestamp, playerCount}>}
 */
function getSnapshots(platform, season, gameMode) {
  const prefix = `${platform}_${season}_${gameMode}_`;
  const results = [];

  try {
    const files = fs.readdirSync(SNAPSHOT_DIR);
    for (const file of files) {
      if (!file.startsWith(prefix) || !file.endsWith('.json')) continue;
      const filePath = path.join(SNAPSHOT_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        results.push({
          file,
          timestamp: data.timestamp,
          playerCount: data.players?.length || 0
        });
      } catch (e) {
        // 忽略损坏文件
      }
    }
  } catch (e) {
    console.error(`[snapshots] getSnapshots error: ${e.message}`);
  }

  // 按时间降序排列
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * 加载指定快照文件
 * @param {string} fileName - 文件名
 * @returns {object|null} 快照对象
 */
function loadSnapshotByFile(fileName) {
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * 比较两个快照，返回变动玩家列表
 * @param {object} snap1 - 旧快照
 * @param {object} snap2 - 新快照
 * @returns {object} { dropped, risen, rankChanges }
 */
function compareSnapshots(snap1, snap2) {
  const oldMap = new Map(snap1.players.map((p, i) => [p.id, { ...p, rank: i + 1 }]));
  const newMap = new Map(snap2.players.map((p, i) => [p.id, { ...p, rank: i + 1 }]));

  const dropped = [];
  const risen = [];
  const rankChanges = [];

  // 找出掉榜玩家（在旧榜但不在新榜）
  for (const [id, oldPlayer] of oldMap) {
    if (!newMap.has(id)) {
      dropped.push({
        id: oldPlayer.id,
        name: oldPlayer.name,
        previousRP: oldPlayer.rankPoints,
        currentRP: null,
        isDropped: true,
        previousTier: oldPlayer.tier,
        previousRank: oldPlayer.rank
      });
    }
  }

  // 找出新上榜玩家
  for (const [id, newPlayer] of newMap) {
    if (!oldMap.has(id)) {
      risen.push({
        id: newPlayer.id,
        name: newPlayer.name,
        currentRP: newPlayer.rankPoints,
        currentRank: newPlayer.rank,
        currentTier: newPlayer.tier
      });
    }
  }

  // 排名变化
  for (const [id, newPlayer] of newMap) {
    const oldPlayer = oldMap.get(id);
    if (oldPlayer && oldPlayer.rank !== newPlayer.rank) {
      rankChanges.push({
        id: newPlayer.id,
        name: newPlayer.name,
        oldRank: oldPlayer.rank,
        newRank: newPlayer.rank,
        rankDelta: oldPlayer.rank - newPlayer.rank,
        rpDelta: (newPlayer.rankPoints || 0) - (oldPlayer.rankPoints || 0),
        previousRP: oldPlayer.rankPoints,
        currentRP: newPlayer.rankPoints
      });
    }
  }

  return {
    dropped,
    risen,
    rankChanges,
    oldTimestamp: snap1.timestamp,
    newTimestamp: snap2.timestamp
  };
}

module.exports = {
  saveSnapshot,
  getSnapshots,
  loadSnapshotByFile,
  compareSnapshots,
  cleanupOldSnapshots
};
