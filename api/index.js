const express = require('express');
const cors = require('cors');
const { validateConfig } = require('../src/utils/config');
const crawlerRoutes = require('./routes/crawler');
const creditRoutes = require('./routes/credits');
const recheckRoutes = require('./routes/recheck');
const healthRoutes = require('./routes/health');
const rateLimiterMiddleware = require('../src/middleware/rateLimiter');
const monitoringMiddleware = require('../src/middleware/monitoring');

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Validate environment variables
console.log('Environment variables:', {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? '***' : undefined
});

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
// Temporarily disable middleware for testing
// app.use(monitoringMiddleware);
// app.use(rateLimiterMiddleware);

// API Documentation route
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Site Aura Crawler API',
    version: '1.0.0'
  });
});

// Routes
app.use('/api/crawler', crawlerRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/recheck', recheckRoutes);
app.use('/api/health', healthRoutes);

// Error handling
app.use((err, req, res, next) => {
  const errorId = Math.random().toString(36).substring(7);
  console.error(`Error ID ${errorId}:`, {
    error: err,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      REDIS_URL: process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not set',
      REDIS_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Not set'
    }
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      errorId
    });
  }

  if (err.name === 'ConfigurationError') {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'Server configuration issue. Please try again later.',
      errorId
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    errorId,
    requestId: req.id
  });
});

module.exports = app;