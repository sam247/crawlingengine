const redis = require('../utils/redis');

class RateLimiter {
  constructor() {
    this.redis = redis;

    // Default limits
    this.limits = {
      user: {
        requests: 100,    // requests per window
        window: 3600,     // 1 hour in seconds
      },
      domain: {
        requests: 60,     // requests per window
        window: 3600,     // 1 hour in seconds
        concurrent: 3     // max concurrent requests
      }
    };
  }

  async isAllowed(userId, domain) {
    const now = Math.floor(Date.now() / 1000);
    const userKey = \`ratelimit:user:\${userId}\`;
    const domainKey = \`ratelimit:domain:\${domain}\`;
    const concurrentKey = \`ratelimit:concurrent:\${domain}\`;

    const pipeline = this.redis.pipeline();

    // Clean up old records
    pipeline.zremrangebyscore(userKey, 0, now - this.limits.user.window);
    pipeline.zremrangebyscore(domainKey, 0, now - this.limits.domain.window);

    // Get current counts
    pipeline.zcard(userKey);
    pipeline.zcard(domainKey);
    pipeline.scard(concurrentKey);

    const [, , userCount, domainCount, concurrentCount] = await pipeline.exec();

    // Check limits
    if (userCount >= this.limits.user.requests) {
      throw new Error('User rate limit exceeded');
    }

    if (domainCount >= this.limits.domain.requests) {
      throw new Error('Domain rate limit exceeded');
    }

    if (concurrentCount >= this.limits.domain.concurrent) {
      throw new Error('Too many concurrent requests for this domain');
    }

    return true;
  }

  async trackRequest(userId, domain) {
    const now = Math.floor(Date.now() / 1000);
    const userKey = \`ratelimit:user:\${userId}\`;
    const domainKey = \`ratelimit:domain:\${domain}\`;
    const concurrentKey = \`ratelimit:concurrent:\${domain}\`;
    const requestId = \`\${userId}:\${now}:\${Math.random()}\`;

    const pipeline = this.redis.pipeline();

    // Track request timing
    pipeline.zadd(userKey, now, requestId);
    pipeline.zadd(domainKey, now, requestId);
    
    // Track concurrent request
    pipeline.sadd(concurrentKey, requestId);
    
    // Set expiration for cleanup
    pipeline.expire(userKey, this.limits.user.window);
    pipeline.expire(domainKey, this.limits.domain.window);
    pipeline.expire(concurrentKey, 300); // 5 minutes max for concurrent tracking

    await pipeline.exec();
    return requestId;
  }

  async completeRequest(domain, requestId) {
    const concurrentKey = \`ratelimit:concurrent:\${domain}\`;
    await this.redis.srem(concurrentKey, requestId);
  }

  async getUserMetrics(userId) {
    const now = Math.floor(Date.now() / 1000);
    const userKey = \`ratelimit:user:\${userId}\`;
    
    // Clean up old records first
    await this.redis.zremrangebyscore(userKey, 0, now - this.limits.user.window);
    
    // Get current usage
    const count = await this.redis.zcard(userKey);
    
    return {
      limit: this.limits.user.requests,
      remaining: Math.max(0, this.limits.user.requests - count),
      resetIn: this.limits.user.window - (now % this.limits.user.window)
    };
  }

  async getDomainMetrics(domain) {
    const now = Math.floor(Date.now() / 1000);
    const domainKey = \`ratelimit:domain:\${domain}\`;
    const concurrentKey = \`ratelimit:concurrent:\${domain}\`;
    
    // Clean up old records
    await this.redis.zremrangebyscore(domainKey, 0, now - this.limits.domain.window);
    
    // Get current usage
    const [count, concurrentCount] = await Promise.all([
      this.redis.zcard(domainKey),
      this.redis.scard(concurrentKey)
    ]);
    
    return {
      limit: this.limits.domain.requests,
      remaining: Math.max(0, this.limits.domain.requests - count),
      resetIn: this.limits.domain.window - (now % this.limits.domain.window),
      concurrent: {
        current: concurrentCount,
        limit: this.limits.domain.concurrent
      }
    };
  }

  async setLimits(newLimits) {
    // Validate and update limits
    if (newLimits.user) {
      if (newLimits.user.requests > 0) {
        this.limits.user.requests = newLimits.user.requests;
      }
      if (newLimits.user.window > 0) {
        this.limits.user.window = newLimits.user.window;
      }
    }

    if (newLimits.domain) {
      if (newLimits.domain.requests > 0) {
        this.limits.domain.requests = newLimits.domain.requests;
      }
      if (newLimits.domain.window > 0) {
        this.limits.domain.window = newLimits.domain.window;
      }
      if (newLimits.domain.concurrent > 0) {
        this.limits.domain.concurrent = newLimits.domain.concurrent;
      }
    }
  }
}

module.exports = RateLimiter;
