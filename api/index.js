const express = require('express');
const cors = require('cors');
const { validateConfig } = require('../src/utils/config');
const crawlerRoutes = require('./routes/crawler');
const creditRoutes = require('./routes/credits');
const recheckRoutes = require('./routes/recheck');
const healthRoutes = require('./routes/health');
const rateLimiterMiddleware = require('../src/middleware/rateLimiter');
const monitoringMiddleware = require('../src/middleware/monitoring');

// Validate environment variables
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Be more restrictive in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(monitoringMiddleware);
app.use(rateLimiterMiddleware);

// API Documentation route
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Site Aura Crawler API',
    version: '1.0.0',
    endpoints: {
      status: '/api/crawler/status',
      crawl: '/api/crawler/crawl'
    }
  });
});

// Routes
app.use('/api/crawler', crawlerRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/recheck', recheckRoutes);
app.use('/api/health', healthRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  if (err.name === 'ConfigurationError') {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'Server configuration issue. Please try again later.'
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    requestId: req.id
  });
});

module.exports = app;