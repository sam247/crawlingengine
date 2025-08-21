const puppeteer = require('puppeteer');
const robotsParser = require('robots-parser');
const WebhookService = require('./webhook');
const CreditService = require('./credits');
const SEOValidator = require('./seoValidator');
const { v4: uuidv4 } = require('uuid');

class CrawlerService {
  constructor() {
    this.browser = null;
    this.visitedUrls = new Set();
    this.webhookService = new WebhookService();
    this.creditService = new CreditService();
    this.seoValidator = new SEOValidator();
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async crawl(request) {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    // Check credit balance and reserve credits
    const estimatedCost = this.creditService.calculateCrawlCost(1, request.depth || 1, 
      (request.options?.customChecks || []).length);
    
    const operationId = uuidv4();
    await this.creditService.reserveCredits(request.userId, estimatedCost, operationId);

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

      const result = {
        jobId: uuidv4(),
        url: request.url,
        status: 'completed',
        startTime,
        endTime: new Date(),
        pagesChecked,
        issues,
        creditsUsed: Math.ceil(pagesChecked / 10)
      };

      // Calculate final credit cost and release reservation
      const finalCost = this.creditService.calculateCrawlCost(pagesChecked, request.depth || 1,
        (request.options?.customChecks || []).length);
      await this.creditService.releaseReservation(operationId, true);
      
      // Deduct actual credits used
      await this.creditService.deductCredits(request.userId, finalCost, `Crawl: ${request.url}`);
      
      // Add credit info to result
      result.creditsUsed = finalCost;
      
      // Notify Lovable about completion
      await this.webhookService.notifyCrawlComplete(result);
      
      return result;

    } catch (error) {
      console.error('Crawl failed:', error);
      
      // Release reserved credits on failure
      if (operationId) {
        await this.creditService.releaseReservation(operationId, false);
      }
      
      const result = {
        jobId: uuidv4(),
        url: request.url,
        status: 'failed',
        startTime,
        endTime: new Date(),
        error: error.message,
        pagesChecked,
        creditsUsed: 0 // No credits charged on failure
      };
      
      // Notify about failure
      await this.webhookService.notifyCrawlComplete(result);
      
      return result;
    }
  }

  async crawlPage(page, url, context) {
    if (context.depth <= 0 || this.visitedUrls.has(url)) {
      return;
    }

    try {
      await page.goto(url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });
      
      this.visitedUrls.add(url);
      context.pagesChecked++;

      // Run comprehensive SEO validation
      const { issues, metrics } = await this.seoValidator.validatePage(page, url);
      context.issues.push(...issues);
      
      // Store metrics for the page
      if (!context.metrics) {
        context.metrics = {
          performance: {},
          seo: {},
          accessibility: {},
          technical: {}
        };
      }
      
      // Merge metrics
      Object.keys(metrics).forEach(category => {
        context.metrics[category] = {
          ...context.metrics[category],
          ...metrics[category]
        };
      });

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
