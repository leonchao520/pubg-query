# PUBG API 对接方案

## PUBG 官方 API 概览

- **基础 URL**: `https://api.pubg.com`
- **认证方式**: API Key 通过 `Authorization: Bearer <API_KEY>` 请求头传递
- **限流**: 每个 API Key 每 **60 秒 10 次请求**
- **数据格式**: JSON
- **Shard（分片）**: 不同平台/地区使用不同 shard

### Shard 映射

| 平台 | Shard ID | 说明 |
|------|----------|------|
| Steam (PC) | `steam` | PC 国际服 |
| Kakao | `kakao` | 韩服 |
| Console (PSN) | `psn` | PS |
| Console (Xbox) | `xbox` | Xbox |
| Stadia | `stadia` | 已停服 |

> 每个平台还有地区子 shard：如 `steam-na`、`steam-eu`、`steam-as`、`steam-kakao`。

---

## Authentication 认证流程

### 请求头格式

```typescript
// pubg-api.service.ts
const headers = {
  'Authorization': `Bearer ${this.apiKey}`,
  'Accept': 'application/vnd.api+json',
  'Content-Type': 'application/json; charset=utf-8',
};
```

### 多 Key 管理策略

```typescript
// API Key 池管理
interface PubgApiKey {
  key: string;
  name: string;
  isPrimary: boolean;
  currentUsage: number;  // 当前窗口内已用请求数
  windowStart: number;   // 窗口开始时间戳
  isAvailable: boolean;  // 是否可用
}

class PubgApiKeyManager {
  private keys: PubgApiKey[];
  
  getAvailableKey(): PubgApiKey | null {
    // 1. 遍历 key 池，检查是否有限流窗口内的
    // 2. 返回当前窗口请求数量 < 10 的第一个 key
    // 3. 如果所有 key 均已用完，返回 null → 触发 429 响应
  }
  
  recordUsage(apiKey: string): void {
    // 记录请求到 Redis 滑动窗口
  }
}
```

---

## API 端点映射表

### 核心端点对应

| 我们的端点 | PUBG API 端点 | 请求方法 | Shard 需求 |
|-----------|---------------|----------|-----------|
| `GET /api/v1/players/search?q=` | `/shards/{shard}/players?filter[playerNames]={name}` | GET | ✅ |
| `GET /api/v1/players/:id` | `/shards/{shard}/players/{id}` | GET | ✅ |
| `GET /api/v1/players/:id/seasons/:season` | `/shards/{shard}/players/{id}/seasons/{season}` | GET | ✅ |
| `GET /api/v1/players/:id/lifetime` | 组合多赛季数据 | - | ✅ |
| `GET /api/v1/players/:id/weapons` | 从 Telemetry 聚合计算 | - | ❌ |
| `GET /api/v1/players/:id/matches` | 从 player 响应中提取 match IDs，再查每个 match | GET | ✅ |
| `GET /api/v1/matches/:id` | `/shards/{shard}/matches/{id}` | GET | ✅ |
| `GET /api/v1/matches/:id/telemetry` | 从 match 响应中的 `data.relationships.assets` 获取 Telemetry URL | GET | ❌ (直接 URL) |
| `GET /api/v1/leaderboard` | `/shards/{shard}/leaderboards/{season}/{gameMode}` | GET | ✅ |
| `GET /api/v1/seasons` | `/shards/{shard}/seasons` | GET | ✅ |

---

## PUBG API 客户端实现

### 核心服务类

```typescript
// pubg-api.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PubgApiService {
  private readonly baseUrl = 'https://api.pubg.com';
  
  constructor(
    private readonly httpService: HttpService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async request<T>(options: {
    shard: string;
    endpoint: string;
    method?: 'GET' | 'POST';
    retryCount?: number;
    userApiKey?: string;  // 用户自带的 API Key
  }): Promise<PubgApiResponse<T>> {
    const { shard, endpoint, method = 'GET', retryCount = 0, userApiKey } = options;
    const maxRetries = 3;
    
    try {
      // 1. 获取可用 API Key
      const apiKey = userApiKey || this.keyManager.getAvailableKey()?.key;
      if (!apiKey) {
        throw new RateLimitException('All API keys are rate limited');
      }
      
      // 2. 检查限流
      await this.rateLimiter.checkAndIncrement(apiKey);
      
      // 3. 发起请求
      const url = `${this.baseUrl}/shards/${shard}${endpoint}`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/vnd.api+json',
          },
          timeout: 15_000,  // 15 秒超时
        })
      );
      
      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      return this.handleError(error, options, retryCount, maxRetries);
    }
  }
  
  private async handleError(
    error: any,
    options: RequestOptions,
    retryCount: number,
    maxRetries: number,
  ): Promise<never> {
    const status = error?.response?.status;
    
    if (status === 429) {
      // 限流 — 等待后重试
      if (retryCount < maxRetries) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '6', 10);
        await this.sleep(retryAfter * 1000);
        return this.request({ ...options, retryCount: retryCount + 1 });
      }
      throw new PubgRateLimitedException('PUBG API rate limit exceeded');
    }
    
    if (status === 404) {
      throw new PubgNotFoundException(error.response?.data || 'Resource not found');
    }
    
    if (status >= 500) {
      // 服务端错误 — 指数退避重试
      if (retryCount < maxRetries) {
        const backoff = Math.pow(2, retryCount) * 1000;  // 1s, 2s, 4s
        await this.sleep(backoff);
        return this.request({ ...options, retryCount: retryCount + 1 });
      }
      throw new PubgServerErrorException('PUBG API server error');
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      // 超时 — 重试
      if (retryCount < maxRetries) {
        return this.request({ ...options, retryCount: retryCount + 1 });
      }
      throw new GatewayTimeoutException('PUBG API timeout');
    }
    
    throw new PubgApiException(`Unexpected error: ${error.message}`);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 限流控制方案

### 限流架构图

```
[客户端请求]
     │
     ▼
[NestJS RateLimiter Guard] ← 全局守卫（限制用户请求频率）
     │
     ▼
[PubgApiKeyManager] ← Key 池管理（多 Key 轮换）
     │
     ▼
[Redis 滑动窗口] ← 每个 API Key 独立计数，窗口 = 60 秒，限额 = 10
     │
     ▼
[PUBG API 请求]
```

### Redis 滑动窗口实现

```typescript
// rate-limiter.service.ts
@Injectable()
export class RateLimiterService {
  private readonly WINDOW_MS = 60_000;  // 60 秒
  private readonly MAX_REQUESTS = 10;    // 每分钟 10 次
  
  constructor(@InjectRedis() private readonly redis: Redis) {}
  
  async checkAndIncrement(apiKey: string): Promise<void> {
    const key = `pubg:rate_limit:${this.hashKey(apiKey)}`;
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    
    // 使用 Redis MULTI 事务保证原子性
    const multi = this.redis.multi();
    
    // 1. 移除窗口外的旧记录
    multi.zremrangebyscore(key, 0, windowStart);
    
    // 2. 获取当前窗口内计数
    multi.zcard(key);
    
    // 3. 添加当前请求
    multi.zadd(key, now, `${now}:${randomUUID()}`);
    
    // 4. 设置过期
    multi.expire(key, Math.ceil(this.WINDOW_MS / 1000));
    
    const results = await multi.exec();
    const currentCount = results[1] as number;
    
    if (currentCount >= this.MAX_REQUESTS) {
      // 限流触发
      const oldestInWindow = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter = oldestInWindow
        ? Math.ceil((parseInt(oldestInWindow[1]) + this.WINDOW_MS - now) / 1000)
        : 6;
      
      throw new RateLimitException({
        message: 'PUBG API rate limit exceeded',
        retryAfter,
        limit: this.MAX_REQUESTS,
        windowMs: this.WINDOW_MS,
      });
    }
  }
  
  private hashKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
  }
}
```

### 请求队列 / 缓冲

当限流触及时，不直接返回 429，可启用内部请求队列：

```typescript
class PubgApiQueue {
  private queue: PubgApiRequest[] = [];
  private processing = false;
  
  async enqueue(request: PubgApiRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...request, resolve, reject });
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      const waitTime = this.calculateWaitTime();
      await this.sleep(waitTime);
      
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
    
    this.processing = false;
  }
  
  private calculateWaitTime(): number {
    // 基于当前窗口使用率计算
    // 10 req / 60s = 1 req / 6s → 至少间隔 6 秒
    return 6000 + Math.random() * 2000;
  }
}
```

---

## 错误处理与重试策略

### 重试策略矩阵

| 错误类型 | HTTP 状态 | 是否重试 | 重试策略 | 等待时间 |
|----------|-----------|----------|----------|----------|
| 限流(429) | 429 | ✅ 最多 3 次 | 固定间隔 | Retry-After 头 |
| 未找到(404) | 404 | ❌ | - | - |
| 服务端错误 | 500/502/503 | ✅ 最多 3 次 | 指数退避 | 1s → 2s → 4s |
| 请求超时 | - | ✅ 最多 3 次 | 立即重试 | 0s |
| 网络错误 | - | ✅ 最多 3 次 | 立即重试 | 0s |
| 认证失败(401) | 401 | ❌ | - | - |

### 断路器模式

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly THRESHOLD = 5;          // 5 次失败后断开
  private readonly RESET_TIMEOUT = 60_000; // 60s 后尝试恢复
  
  isOpen(): boolean {
    if (this.failures >= this.THRESHOLD) {
      if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
        this.halfOpen();  // 进入半开状态
        return false;
      }
      return true;
    }
    return false;
  }
  
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
  
  recordSuccess(): void {
    this.failures = 0;  // 成功后重置
  }
  
  private halfOpen(): void {
    // 半开状态 — 允许一次试探请求
    this.failures = 0;
  }
}
```

---

## 数据格式转换

### PUBG API JSON:API 格式 → 我们的扁平格式

PUBG API 使用 [JSON:API](https://jsonapi.org/) 格式，数据结构较为复杂。需要做大量转换。

### Player 响应转换

```typescript
// RAW PUBG API → 扁平化的 Player 对象
interface RawPubgPlayerResponse {
  data: {
    type: 'player';
    id: string;
    attributes: {
      name: string;
      patchVersion: string;
      shardId: string;
      stats: null;
      titleId: string;
      createdAt: string;  // ISO 8601
      updatedAt: string;
    };
    relationships: {
      matches: {
        data: Array<{ type: 'match'; id: string }>;
      };
    };
  };
  included?: Array<{
    type: string;
    id: string;
    attributes: Record<string, unknown>;
  }>;
}

// 转换函数
function transformPlayer(raw: RawPubgPlayerResponse): PlayerDTO {
  return {
    id: raw.data.id,
    name: raw.data.attributes.name,
    platform: raw.data.attributes.shardId,
    patchVersion: raw.data.attributes.patchVersion,
    createdAt: raw.data.attributes.createdAt,
    matches: raw.data.relationships.matches.data.map(m => m.id),
    matchIds: raw.data.relationships.matches.data.map(m => m.id),
  };
}
```

### 赛季统计转换

```typescript
interface RawSeasonStats {
  data: {
    type: 'playerSeason';
    id: string;
    attributes: {
      bestRankPoint: number;
      currentSeason: boolean;
      seasonId: string;
      [gameMode]: {
        assists: number;
        boosts: number;
        dBNOs: number;
        dailyKills: number;
        damageDealt: number;
        days: number;
        headshotKills: number;
        heals: number;
        kills: number;
        longestKill: number;
        revives: number;
        roundsPlayed: number;
        suicides: number;
        teamKills: number;
        timeSurvived: number;
        top10s: number;
        vehicleDestroys: number;
        weaponsAcquired: number;
        weeklyKills: number;
        winPoints: number;
        wins: number;
      };
    };
  };
}

// 认证转换 + 计算衍生指标
function transformSeasonStats(raw: RawSeasonStats): SeasonStatsDTO {
  const gameModes = ['solo', 'duo', 'squad', 'solo-fpp', 'duo-fpp', 'squad-fpp'];
  const stats: Record<string, GameModeStatsDTO> = {};
  
  for (const mode of gameModes) {
    const rawStats = raw.data.attributes[mode];
    if (!rawStats) continue;
    
    stats[mode] = {
      ...rawStats,
      kdRatio: rawStats.roundsPlayed - rawStats.wins > 0
        ? rawStats.kills / (rawStats.roundsPlayed - rawStats.wins)
        : 0,
      winRatio: rawStats.roundsPlayed > 0
        ? rawStats.wins / rawStats.roundsPlayed
        : 0,
      avgDamage: rawStats.roundsPlayed > 0
        ? round(rawStats.damageDealt / rawStats.roundsPlayed, 2)
        : 0,
      headshotRatio: rawStats.kills > 0
        ? round(rawStats.headshotKills / rawStats.kills, 4)
        : 0,
      top10Ratio: rawStats.roundsPlayed > 0
        ? round(rawStats.top10s / rawStats.roundsPlayed, 4)
        : 0,
    };
  }
  
  return { playerId: raw.data.id, seasonId: raw.data.attributes.seasonId, gameModeStats: stats };
}
```

### Match 响应转换

```typescript
interface RawMatchResponse {
  data: {
    type: 'match';
    id: string;
    attributes: {
      createdAt: string;
      duration: number;
      gameMode: string;
      mapName: string;
      isCustomMatch: boolean;
      seasonState: string;
      matchType: string;
      titleId: string;
      patchVersion: string;
    };
    relationships: {
      assets: { data: Array<{ type: 'asset'; id: string }> };
      rosters: { data: Array<{ type: 'roster'; id: string }> };
    };
  };
  included: Array<RawIncluded>;
}

function transformMatch(raw: RawMatchResponse, participants: ParticipantDTO[]): MatchDTO {
  // 获取 Telemetry URL
  const telemetryAsset = raw.included.find(
    i => i.type === 'asset' && i.attributes?.URL?.includes('telemetry')
  );
  
  // 解析 Roster 信息
  const rosters = raw.included
    .filter(i => i.type === 'roster')
    .map(roster => ({
      rank: roster.attributes?.stats?.rank || 0,
      teamId: roster.attributes?.stats?.teamId || 0,
      won: roster.attributes?.won || false,
      participants: roster.relationships?.participants?.data?.map(
        (p: any) => p.id
      ) || [],
    }));
  
  return {
    id: raw.data.id,
    createdAt: raw.data.attributes.createdAt,
    duration: raw.data.attributes.duration,
    gameMode: raw.data.attributes.gameMode,
    mapName: raw.data.attributes.mapName,
    isCustom: raw.data.attributes.isCustomMatch,
    seasonState: raw.data.attributes.seasonState,
    telemetryLink: telemetryAsset
      ? `/api/v1/matches/${raw.data.id}/telemetry`
      : null,
    participants,
    rosters,
  };
}
```

### Telemetry 简化

```typescript
// Telemetry 响应有 ~30 种事件类型，核心事件：
const TELEMETRY_EVENT_TYPES = {
  LogPlayerKill: true,
  LogPlayerTakeDamage: true,
  LogPlayerAttack: true,
  LogItemPickup: true,
  LogItemDrop: true,
  LogItemEquip: true,
  LogItemUnequip: true,
  LogVehicleRide: true,
  LogVehicleLeave: true,
  LogParachuteLanding: true,
  LogMatchStart: true,
  LogMatchEnd: true,
  LogPhaseChange: true,
  LogCarePackageSpawn: true,
  LogPlayerPosition: true,
  LogPlayerCreate: true,
  LogPlayerLogin: true,
  LogPlayerLogout: true,
};

// 精简 Telemetry：只保留前端 2D 回放需要的事件
function simplifyTelemetry(rawTelemetry: any[]): TelemetryDTO {
  const keepFields = [
    '_T',       // 事件类型
    '_D',       // 时间戳
    'common',   // 通用信息
    'character',// 角色信息（位置、血量等）
    'killer',   // 击杀者
    'victim',   // 受害者
    'damageCauserName',  // 武器名
    'damageTypeCategory', // 伤害类型
    'distance', // 距离
    'item',     // 物品
    'vehicle',  // 载具
    'attackId', // 攻击 ID
  ];
  
  return {
    matchId: rawTelemetry[0]?.matchId || '',
    events: rawTelemetry
      .filter(e => TELEMETRY_EVENT_TYPES[e._T])
      .map(event => {
        const simplified: any = { type: event._T, timestamp: event._D };
        for (const [key, value] of Object.entries(event)) {
          if (keepFields.includes(key) && !key.startsWith('_')) {
            simplified[key] = value;
          }
        }
        return simplified;
      }),
  };
}
```

---

## 模块化架构

### PUBG API 模块组织

```
src/modules/pubg-api/
├── pubg-api.module.ts          # 模块定义
├── pubg-api.service.ts         # 核心 HTTP 客户端
├── pubg-api.interface.ts       # 类型定义
├── pubg-api.constants.ts       # 常量
├── transformers/               # 数据转换器
│   ├── player.transformer.ts
│   ├── season-stats.transformer.ts
│   ├── match.transformer.ts
│   └── telemetry.transformer.ts
├── rate-limiter/               # 限流
│   ├── rate-limiter.service.ts
│   └── rate-limiter.guard.ts
└── circuit-breaker/
    └── circuit-breaker.service.ts
```

### 各 Service 的职责

| Service | 职责 |
|---------|------|
| `PubgApiService` | 低层级 HTTP 封装 → 重试 → 限流 → 断路器 |
| `PlayersService` | 玩家相关业务逻辑 → 调用 PubgApiService → 缓存处理 |
| `MatchesService` | 比赛相关 → 调用 PubgApiService → Telemetry 处理 |
| `LeaderboardService` | 排行榜 → 调用 PubgApiService → 缓存 |
| `WeaponStatsService` | 武器统计 → 后台 Telemetry 分析 |
| `CacheService` | 统一的 Redis + PostgreSQL 缓存层 |
| `DataCleanupService` | 定时清理过期数据 |

---

## 配置示例

```typescript
// config/pubg-api.config.ts
export default () => ({
  pubgApi: {
    baseUrl: process.env.PUBG_API_BASE_URL || 'https://api.pubg.com',
    apiKeys: process.env.PUBG_API_KEYS?.split(',') || [
      process.env.PUBG_API_KEY,
    ].filter(Boolean),
    fallbackApiKey: process.env.PUBG_API_KEY_FALLBACK,
    timeout: parseInt(process.env.PUBG_API_TIMEOUT || '15000', 10),
    rateLimit: {
      maxRequests: parseInt(process.env.PUBG_API_RATE_LIMIT || '10', 10),
      windowMs: parseInt(process.env.PUBG_API_RATE_WINDOW || '60000', 10),
    },
    retry: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    },
    telemetry: {
      batchSize: 100,       // 分批处理 Telemetry
      maxSizeMb: 50,        // 丢弃超过 50MB 的 Telemetry
      cleanupDays: 7,       // 7 天后自动清理
      enableProcessing: true, // 是否后台处理 Telemetry
    },
  },
});
```

```typescript
// .env 示例
PUBG_API_KEY=your_primary_key_here
PUBG_API_KEY_FALLBACK=your_fallback_key_here
PUBG_API_BASE_URL=https://api.pubg.com
PUBG_API_TIMEOUT=15000

REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL_PLAYER=600
REDIS_CACHE_TTL_SEASON=600
REDIS_CACHE_TTL_MATCH=1800
REDIS_CACHE_TTL_LEADERBOARD=300
REDIS_CACHE_TTL_SEASONS=21600

POSTGRES_URL=postgres://user:password@localhost:5432/pubg_tool
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=20
```

---

## 启动顺序

```
1. PostgreSQL 连接池初始化
2. Redis 连接池初始化
3. PUBG API Key Manager 初始化（校验 key 有效性）
4. Rate Limiter Service 初始化
5. 各业务 Service 初始化
6. 断路器预热
7. 注册定时任务
8. HTTP 服务启动（端口 3000）
```

---

## 生产环境注意事项

1. **API Key 轮换**：主 Key 限流时自动切换备用 Key
2. **请求合并**：同一批玩家的多条查询合并为一次 PUBG API 调用
3. **Telemetry 异步处理**：Telemetry 拉取和武器统计计算放到后台队列（Bull/BullMQ）
4. **健康检查**：`GET /health` 检测 PUBG API 连通性、Redis/PG 状态
5. **监控指标**：每个 API Key 的剩余配额、缓存命中率、平均响应时间
