const RateLimiter = require('../services/rateLimiter');
const { URL } = require('url');

const rateLimiter = new RateLimiter();

async function rateLimiterMiddleware(req, res, next) {
  try {
    const userId = req.body.userId || req.query.userId;
    let domain = null;

    // Extract domain if URL is provided
    if (req.body.url) {
      domain = new URL(req.body.url).hostname;
    }

    // Skip domain check for non-crawl operations
    const needsDomainCheck = req.path.includes('/crawl') || req.path.includes('/recheck');

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (needsDomainCheck && !domain) {
      return res.status(400).json({
        success: false,
        error: 'Valid URL is required'
      });
    }

    // Check rate limits
    if (needsDomainCheck) {
      await rateLimiter.isAllowed(userId, domain);
      const requestId = await rateLimiter.trackRequest(userId, domain);
      res.locals.rateLimit = { requestId, domain };
    } else {
      await rateLimiter.isAllowed(userId, 'api');
      const requestId = await rateLimiter.trackRequest(userId, 'api');
      res.locals.rateLimit = { requestId, domain: 'api' };
    }

    // Add rate limit info to response headers
    const userMetrics = await rateLimiter.getUserMetrics(userId);
    res.set({
      'X-RateLimit-Limit': userMetrics.limit,
      'X-RateLimit-Remaining': userMetrics.remaining,
      'X-RateLimit-Reset': userMetrics.resetIn
    });

    // Clean up after request is complete
    res.on('finish', async () => {
      const { requestId, domain } = res.locals.rateLimit;
      await rateLimiter.completeRequest(domain, requestId);
    });

    next();
  } catch (error) {
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: error.message,
        retryAfter: 3600 // 1 hour
      });
    }
    next(error);
  }
}

module.exports = rateLimiterMiddleware;
