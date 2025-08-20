const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route for testing
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Site Aura Crawler API',
    version: '1.0.0',
    endpoints: {
      crawler: '/api/crawler',
      recheck: '/api/recheck',
      credits: '/api/credits',
      webhooks: '/api/webhooks'
    }
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

module.exports = app;
