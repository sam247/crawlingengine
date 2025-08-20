const puppeteer = require('puppeteer');
const robotsParser = require('robots-parser');

class CrawlerService {
  constructor() {
    this.browser = null;
    this.visitedUrls = new Set();
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async crawl(request) {
    if (!this.browser) {
      await this.initialize();
    }

    const startTime = new Date();
    const issues = [];
    let pagesChecked = 0;

    try {
      const robotsTxt = await this.fetchRobotsTxt(request.url);
      const page = await this.browser.newPage();
      
      await page.setUserAgent('LovableCrawler/1.0');
      
      await this.crawlPage(page, request.url, {
        depth: request.depth || 1,
        issues,
        robotsTxt,
        pagesChecked,
        request,
        startTime: startTime.getTime()
      });

      await page.close();

      return {
        url: request.url,
        status: 'completed',
        startTime,
        endTime: new Date(),
        pagesChecked,
        issues,
        creditsUsed: Math.ceil(pagesChecked / 10)
      };

    } catch (error) {
      console.error('Crawl failed:', error);
      return {
        url: request.url,
        status: 'failed',
        startTime,
        endTime: new Date(),
        error: error.message,
        pagesChecked,
        creditsUsed: Math.ceil(pagesChecked / 10)
      };
    }
  }

  async crawlPage(page, url, context) {
    if (context.depth <= 0 || this.visitedUrls.has(url)) {
      return;
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      this.visitedUrls.add(url);
      context.pagesChecked++;

      // Basic SEO checks
      const title = await page.title();
      const description = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
      
      if (!title || title.length < 10) {
        context.issues.push({
          type: 'seo',
          severity: 'medium',
          message: 'Title tag is missing or too short',
          url
        });
      }

      if (!description) {
        context.issues.push({
          type: 'seo',
          severity: 'medium',
          message: 'Meta description is missing',
          url
        });
      }

      // Find and follow links if depth allows
      if (context.depth > 1) {
        const links = await page.$$eval('a', elements =>
          elements.map(el => el.href)
            .filter(href => href && href.startsWith('http'))
        );

        for (const link of links) {
          if (!this.visitedUrls.has(link)) {
            await this.crawlPage(page, link, {
              ...context,
              depth: context.depth - 1
            });
          }
        }
      }
    } catch (error) {
      context.issues.push({
        type: 'error',
        severity: 'high',
        message: `Failed to crawl: ${error.message}`,
        url
      });
    }
  }

  async fetchRobotsTxt(url) {
    try {
      const robotsUrl = new URL('/robots.txt', url).toString();
      const response = await fetch(robotsUrl);
      const robotsTxt = await response.text();
      return robotsParser(robotsUrl, robotsTxt);
    } catch (error) {
      console.warn(`Failed to fetch robots.txt for ${url}:`, error);
      return null;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = CrawlerService;
