/**
 * 简单的内存缓存（支持 stale-while-revalidate）
 */
class Cache {
  constructor(ttlSeconds = 300) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /** 获取缓存数据（包括已过期的），不过期返回 { data, expired: false }，已过期返回 { data, expired: true } */
  getWithStale(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const expired = Date.now() > entry.expiry;
    if (expired) {
      // 不删除，留着当降级数据
      return { data: entry.data, expired: true };
    }
    return { data: entry.data, expired: false };
  }

  /** 强制删除过期项（GC） */
  evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) this.cache.delete(key);
    }
  }

  set(key, data, ttlOverride) {
    const ttl = (ttlOverride || this.ttl);
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) this.cache.delete(key);
    }
  }

  stats() {
    return { size: this.cache.size };
  }
}

module.exports = new Cache(300); // 5 min default
