const redis = require('../utils/redis');
const winston = require('winston');
const { createLogger, format, transports } = winston;

class MonitoringService {
  constructor() {
    this.redis = redis;

    // Initialize logger
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: { service: 'crawler-api' },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });

    // Metric keys
    this.keys = {
      requests: 'metrics:requests',
      errors: 'metrics:errors',
      performance: 'metrics:performance',
      credits: 'metrics:credits',
      health: 'metrics:health'
    };

    // Alert thresholds
    this.thresholds = {
      errorRate: 0.05,        // 5% error rate
      responseTime: 5000,     // 5 seconds
      creditUsage: 0.8,       // 80% of quota
      healthScore: 0.9        // 90% health score
    };
  }

  // Performance Monitoring
  async trackRequest(route, duration, status, userId) {
    const timestamp = Date.now();
    const day = Math.floor(timestamp / 86400000);
    
    const pipeline = this.redis.pipeline();
    
    // Track request count
    pipeline.hincrby(\`\${this.keys.requests}:\${day}\`, route, 1);
    
    // Track response times
    pipeline.lpush(\`\${this.keys.performance}:\${route}\`, duration);
    pipeline.ltrim(\`\${this.keys.performance}:\${route}\`, 0, 999);
    
    // Track status codes
    if (status >= 400) {
      pipeline.hincrby(\`\${this.keys.errors}:\${day}\`, route, 1);
    }

    await pipeline.exec();

    // Log request
    this.logger.info('API Request', {
      route,
      duration,
      status,
      userId,
      timestamp
    });

    // Check for alerts
    await this.checkAlerts(route, duration, status);
  }

  // Error Tracking
  async trackError(error, context = {}) {
    const timestamp = Date.now();
    const errorKey = \`error:\${timestamp}\`;
    
    // Store error details
    await this.redis.hset(errorKey, {
      message: error.message,
      stack: error.stack,
      context: JSON.stringify(context),
      timestamp
    });

    // Log error
    this.logger.error('Application Error', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp
    });

    // Trigger alert for critical errors
    if (context.severity === 'critical') {
      await this.triggerAlert('critical_error', {
        message: error.message,
        context
      });
    }
  }

  // Usage Statistics
  async trackUsage(metric, value, tags = {}) {
    const timestamp = Date.now();
    const day = Math.floor(timestamp / 86400000);
    
    // Store metric
    await this.redis.zadd(
      \`usage:\${metric}:\${day}\`,
      timestamp,
      JSON.stringify({ value, tags })
    );

    // Log metric
    this.logger.info('Usage Metric', {
      metric,
      value,
      tags,
      timestamp
    });
  }

  // Health Checks
  async checkHealth() {
    const checks = {
      redis: await this.checkRedisHealth(),
      api: await this.checkApiHealth(),
      crawler: await this.checkCrawlerHealth()
    };

    const health = {
      status: Object.values(checks).every(check => check.status === 'healthy') 
        ? 'healthy' 
        : 'unhealthy',
      checks,
      timestamp: Date.now()
    };

    // Store health status
    await this.redis.set(this.keys.health, JSON.stringify(health));

    // Log health status
    this.logger.info('Health Check', health);

    return health;
  }

  async checkRedisHealth() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async checkApiHealth() {
    const metrics = await this.getApiMetrics();
    const errorRate = metrics.errors / (metrics.requests || 1);

    return {
      status: errorRate < this.thresholds.errorRate ? 'healthy' : 'degraded',
      errorRate,
      avgResponseTime: metrics.avgResponseTime,
      timestamp: Date.now()
    };
  }

  async checkCrawlerHealth() {
    // Check crawler instance health
    const metrics = await this.getCrawlerMetrics();
    
    return {
      status: metrics.activeInstances > 0 ? 'healthy' : 'unhealthy',
      activeInstances: metrics.activeInstances,
      pendingJobs: metrics.pendingJobs,
      timestamp: Date.now()
    };
  }

  // Alert System
  async triggerAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: Date.now()
    };

    // Store alert
    await this.redis.lpush('alerts', JSON.stringify(alert));

    // Log alert
    this.logger.warn('Alert Triggered', alert);

    // Here you would typically integrate with external alert systems
    // like email, Slack, PagerDuty, etc.
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(alert);
    }
  }

  // Metric Collection
  async getApiMetrics(timeframe = '24h') {
    const now = Date.now();
    const start = now - this.getTimeframeMs(timeframe);
    
    // Get metrics from Redis
    const metrics = await this.redis.zrangebyscore(
      this.keys.requests,
      start,
      now
    );

    return this.aggregateMetrics(metrics);
  }

  async getCrawlerMetrics() {
    // Get crawler-specific metrics
    const metrics = await this.redis.hgetall('crawler:metrics');
    
    return {
      activeInstances: parseInt(metrics.activeInstances || '0'),
      pendingJobs: parseInt(metrics.pendingJobs || '0'),
      completedJobs: parseInt(metrics.completedJobs || '0'),
      failedJobs: parseInt(metrics.failedJobs || '0'),
      avgProcessingTime: parseFloat(metrics.avgProcessingTime || '0')
    };
  }

  // Utility Methods
  getTimeframeMs(timeframe) {
    const units = {
      h: 3600000,
      d: 86400000,
      w: 604800000
    };
    const match = timeframe.match(/^(\\d+)([hdw])$/);
    if (!match) throw new Error('Invalid timeframe format');
    return parseInt(match[1]) * units[match[2]];
  }

  aggregateMetrics(metrics) {
    return metrics.reduce((acc, metric) => {
      const data = JSON.parse(metric);
      acc.requests += data.count || 0;
      acc.errors += data.errors || 0;
      acc.avgResponseTime = (acc.avgResponseTime + data.responseTime) / 2;
      return acc;
    }, {
      requests: 0,
      errors: 0,
      avgResponseTime: 0
    });
  }
}

module.exports = MonitoringService;
