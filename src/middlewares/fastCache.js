/**
 * High-Throughput In-Memory Micro-Cache Middleware
 * 
 * Specifically designed to absorb high traffic peaks (up to 5,000+ RPS)
 * without hitting MongoDB for hot read queries (Mess Menu, System Config, Maintenance, Health).
 */

const cluster = require('cluster');

class FastMemoryCache {
  constructor() {
    this.cache = new Map();
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

  set(key, data, ttlSeconds = 10) {
    // Prevent memory leaks: auto-prune oldest 10% if map exceeds 2,000 entries
    if (this.cache.size > 2000) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 200);
      keysToDelete.forEach((k) => this.cache.delete(k));
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  clear() {
    this.cache.clear();
  }
}

const memoryCache = new FastMemoryCache();

/**
 * Express middleware generator for route-level micro-caching
 * @param {number} ttlSeconds - Duration to cache in RAM (default: 10s)
 */
function fastCache(ttlSeconds = 10) {
  return (req, res, next) => {
    // Only cache safe GET requests without authorization (public endpoints)
    if (req.method !== 'GET' || req.headers.authorization) {
      return next();
    }

    const cacheKey = `${req.originalUrl || req.url}`;
    const cachedResponse = memoryCache.get(cacheKey);

    const workerId = cluster.worker ? cluster.worker.id : 'standalone';
    res.setHeader('X-Cluster-Worker', String(workerId));

    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', cachedResponse.contentType || 'application/json');
      return res.status(cachedResponse.statusCode || 200).send(cachedResponse.body);
    }

    // Intercept response to store in cache
    const originalSend = res.send.bind(res);

    res.send = (body) => {
      // Only cache successful 200 responses
      if (res.statusCode === 200) {
        memoryCache.set(
          cacheKey,
          {
            body,
            statusCode: res.statusCode,
            contentType: res.getHeader('Content-Type'),
          },
          ttlSeconds
        );
      }
      res.setHeader('X-Cache', 'MISS');
      return originalSend(body);
    };

    next();
  };
}

module.exports = {
  fastCache,
  memoryCache,
};
