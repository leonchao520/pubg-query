/**
 * 排行榜封禁监控模块
 * 定期轮询排行榜快照，对比检测掉榜事件
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.join(__dirname, '..', 'snapshots');

// 确保快照目录存在
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

/**
 * 保存排行榜快照
 */
function saveSnapshot(platform, season, gameMode, players) {
  const key = `${platform}_${season}_${gameMode}`;
  const file = path.join(SNAPSHOT_DIR, `${key}.json`);
  const snapshot = {
    key,
    platform,
    season,
    gameMode,
    timestamp: Date.now(),
    players: players.map((p, i) => ({
      rank: i + 1,
      playerId: p.playerId,
      name: p.name,
      rp: p.stats?.rankPoints || 0,
    })),
  };
  fs.writeFileSync(file, JSON.stringify(snapshot));
  return snapshot;
}

/**
 * 加载上一个快照
 */
function loadSnapshot(platform, season, gameMode) {
  const key = `${platform}_${season}_${gameMode}`;
  const file = path.join(SNAPSHOT_DIR, `${key}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * 对比快照，找出变动
 */
function compareSnapshots(oldSnapshot, newSnapshot) {
  const oldPlayers = new Map(oldSnapshot.players.map(p => [p.playerId, p]));
  const newPlayers = new Map(newSnapshot.players.map(p => [p.playerId, p]));

  const dropped = []; // 掉榜（在旧榜但不在新榜）
  const risen = [];   // 新上榜（在新榜但不在旧榜）
  const changes = []; // 排名变化

  for (const p of oldSnapshot.players) {
    if (!newPlayers.has(p.playerId)) {
      dropped.push({
        ...p,
        oldRank: p.rank,
        oldRp: p.rp,
      });
    }
  }

  for (const p of newSnapshot.players) {
    if (!oldPlayers.has(p.playerId)) {
      risen.push({
        ...p,
      });
    } else {
      const old = oldPlayers.get(p.playerId);
      if (old.rank !== p.rank) {
        changes.push({
          ...p,
          oldRank: old.rank,
          rankDelta: old.rank - p.rank,
          rpDelta: (p.rp || 0) - (old.rp || 0),
        });
      }
    }
  }

  return {
    dropped,
    risen,
    rankChanges: changes,
    oldTimestamp: oldSnapshot.timestamp,
    newTimestamp: newSnapshot.timestamp,
  };
}

module.exports = { saveSnapshot, loadSnapshot, compareSnapshots };
