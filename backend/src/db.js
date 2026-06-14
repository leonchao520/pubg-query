// SQLite 历史数据追踪
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'pubg_history.db');

// 确保 data 目录存在
const fs = require('fs');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// 启用 WAL 模式，提升并发性能
db.pragma('journal_mode = WAL');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS player_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'steam',
    player_id TEXT,
    rp REAL,
    tier TEXT,
    rank INTEGER,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0,
    kd REAL DEFAULT 0,
    ban_type TEXT DEFAULT 'Innocent',
    ban_status TEXT DEFAULT 'normal',
    steam_vac_banned INTEGER DEFAULT 0,
    steam_game_bans INTEGER DEFAULT 0,
    snapshot_time INTEGER NOT NULL,
    UNIQUE(name, platform, snapshot_time)
  );

  CREATE TABLE IF NOT EXISTS player_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'steam',
    player_id TEXT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    total_snapshots INTEGER DEFAULT 0,
    UNIQUE(name, platform)
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_name ON player_snapshots(name, platform);
  CREATE INDEX IF NOT EXISTS idx_snapshots_time ON player_snapshots(snapshot_time);
`);

// 保存玩家快照
function saveSnapshot(name, platform, data) {
  const now = Date.now();
  
  const seasonStats = data?.season?.data?.attributes?.gameModeStats;
  let kills = 0, deaths = 0, wins = 0, matchesPlayed = 0;
  if (seasonStats) {
    for (const mode of Object.values(seasonStats)) {
      const s = mode;
      kills += s.kills || 0;
      deaths += s.deaths || 0;
      wins += s.wins || 0;
      matchesPlayed += s.roundsPlayed || 0;
    }
  }

  const steamBans = data?.steam?.bans;
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO player_snapshots
      (name, platform, player_id, kills, deaths, wins, matches_played, kd, ban_type, steam_vac_banned, steam_game_bans, snapshot_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    name.toLowerCase(),
    platform,
    data?.player?.id || '',
    kills,
    deaths,
    wins,
    matchesPlayed,
    deaths > 0 ? +(kills / deaths).toFixed(2) : kills,
    data?.banType || 'Innocent',
    steamBans?.VACBanned ? 1 : 0,
    steamBans?.NumberOfGameBans || 0,
    now
  );

  // 更新/插入 player_history
  const hist = db.prepare(`
    INSERT INTO player_history (name, platform, player_id, first_seen, last_seen, total_snapshots)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(name, platform) DO UPDATE SET
      last_seen = ?,
      total_snapshots = total_snapshots + 1
  `);
  hist.run(name.toLowerCase(), platform, data?.player?.id || '', now, now, now);

  return true;
}

// 获取玩家历史数据（趋势数据）
function getPlayerHistory(name, platform = 'steam', limit = 30) {
  const stmt = db.prepare(`
    SELECT * FROM player_snapshots
    WHERE name = ? AND platform = ?
    ORDER BY snapshot_time ASC
    LIMIT ?
  `);
  return stmt.all(name.toLowerCase(), platform, limit);
}

// 获取最近收藏的玩家最新快照
function getLatestForTracked(names) {
  if (names.length === 0) return [];
  const placeholders = names.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT s1.* FROM player_snapshots s1
    INNER JOIN (
      SELECT name, MAX(snapshot_time) as max_time
      FROM player_snapshots
      WHERE name IN (${placeholders})
      GROUP BY name
    ) s2 ON s1.name = s2.name AND s1.snapshot_time = s2.max_time
  `);
  return stmt.all(...names.map(n => n.toLowerCase()));
}

module.exports = { saveSnapshot, getPlayerHistory, getLatestForTracked };
