// Minimal endpoint with no dependencies
module.exports = (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    env: {
      REDIS_URL: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'missing',
      REDIS_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'missing',
      NODE_ENV: process.env.NODE_ENV
    }
  });
};
