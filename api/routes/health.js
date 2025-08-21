const express = require('express');
const MonitoringService = require('../../src/services/monitoring');

const router = express.Router();
const monitor = new MonitoringService();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const health = await monitor.checkHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '24h';
    const [apiMetrics, crawlerMetrics] = await Promise.all([
      monitor.getApiMetrics(timeframe),
      monitor.getCrawlerMetrics()
    ]);

    res.json({
      api: apiMetrics,
      crawler: crawlerMetrics,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message: error.message
    });
  }
});

module.exports = router;
