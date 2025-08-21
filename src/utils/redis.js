const { Redis } = require('@upstash/redis');

let redisClient = null;

function createRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Redis configuration not found, using mock implementation');
    return {
      get: async () => null,
      set: async () => true,
      incrby: async () => 0,
      decrby: async () => 0,
      hset: async () => true,
      hgetall: async () => ({}),
      lpush: async () => 1,
      lrange: async () => [],
      pipeline: () => ({
        exec: async () => []
      }),
      zadd: async () => 1,
      zcard: async () => 0,
      zremrangebyscore: async () => 0,
      scard: async () => 0,
      sadd: async () => 1,
      srem: async () => 1,
      expire: async () => true,
      del: async () => 1,
      ping: async () => 'PONG'
    };
  }

  try {
    redisClient = new Redis({
      url,
      token,
      retry: {
        retries: 3,
        backoff: {
          min: 1000,
          max: 3000
        }
      }
    });

    // Test the connection
    redisClient.ping().catch(error => {
      console.error('Redis connection test failed:', error);
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    return null;
  }
}

// Export a singleton instance
module.exports = createRedisClient();