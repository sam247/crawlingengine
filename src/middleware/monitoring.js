const MonitoringService = require('../services/monitoring');

const monitor = new MonitoringService();

function monitoringMiddleware(req, res, next) {
  const start = Date.now();
  const route = \`\${req.method} \${req.route?.path || req.path}\`;
  const userId = req.body.userId || req.query.userId;

  // Add response listener
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitor.trackRequest(route, duration, res.statusCode, userId);
  });

  // Track any errors
  res.on('error', (error) => {
    monitor.trackError(error, {
      route,
      userId,
      method: req.method,
      severity: 'critical'
    });
  });

  next();
}

module.exports = monitoringMiddleware;
