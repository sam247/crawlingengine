const express = require('express');
const cors = require('cors');
const crawlerRoutes = require('./routes/crawler');
const creditRoutes = require('./routes/credits');
const recheckRoutes = require('./routes/recheck');
const rateLimiterMiddleware = require('../src/middleware/rateLimiter');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Be more restrictive in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
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

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

module.exports = app;