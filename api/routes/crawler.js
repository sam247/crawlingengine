const express = require('express');
const CrawlerService = require('../../src/services/crawler');

const router = express.Router();
const crawler = new CrawlerService();

// Initialize crawler
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Crawler service is running'
  });
});

// Start a crawl
router.post('/crawl', async (req, res) => {
  try {
    const { url, depth = 1 } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL'
      });
    }

    const result = await crawler.crawl({
      url,
      depth,
      options: req.body.options
    });

    res.json(result);
  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({
      error: 'Crawl failed',
      message: error.message
    });
  }
});

module.exports = router;
