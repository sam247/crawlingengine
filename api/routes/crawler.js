const express = require('express');

const router = express.Router();

// Initialize crawler
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Crawler service is running'
  });
});

// Start a crawl (lazy-load Puppeteer/CrawlerService to avoid cold-start crashes)
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

    // Lazy import to avoid importing Puppeteer at cold start
    const CrawlerService = require('../../src/services/crawler');
    const crawler = new CrawlerService();

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
