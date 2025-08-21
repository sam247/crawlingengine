const puppeteer = require('puppeteer');
const SEOValidator = require('./seoValidator');

class RecheckService {
  constructor() {
    this.browser = null;
    this.seoValidator = new SEOValidator();
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async recheckIssue(url, issueId, issueType) {
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      // Configure specific checks based on issue type
      const checkConfig = this.getCheckConfig(issueType);
      
      // Run targeted validation
      const result = await this.runTargetedCheck(page, url, checkConfig);
      
      return {
        issueId,
        url,
        type: issueType,
        fixed: !result.issues.length, // If no issues found, it's fixed
        recheckedAt: new Date().toISOString(),
        details: result.issues.length ? result.issues[0] : { message: 'Issue resolved' }
      };
    } finally {
      await page.close();
    }
  }

  getCheckConfig(issueType) {
    // Map issue types to specific validation rules
    const checkMap = {
      // Technical SEO (85%)
      'missing-robots': ['robotsTxtCheck'],
      'missing-sitemap': ['sitemapCheck'],
      'broken-links': ['brokenLinksCheck'],
      'https-issues': ['httpsCheck'],
      'mixed-content': ['mixedContentCheck'],
      
      // On-Page SEO (72%)
      'missing-meta-descriptions': ['metaDescriptionCheck'],
      'title-tags': ['titleTagCheck'],
      'heading-structure': ['headingStructureCheck'],
      'keyword-optimization': ['keywordCheck'],
      
      // Content Quality (90%)
      'thin-content': ['contentLengthCheck'],
      'duplicate-content': ['duplicateContentCheck'],
      'content-structure': ['contentStructureCheck'],
      'readability': ['readabilityCheck'],
      
      // Performance (65%)
      'page-speed': ['pageSpeedCheck'],
      'image-optimization': ['imageOptimizationCheck'],
      'render-blocking': ['renderBlockingCheck'],
      'server-response': ['serverResponseCheck']
    };

    return checkMap[issueType] || ['generalCheck'];
  }

  async runTargetedCheck(page, url, checks) {
    await page.goto(url, { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    const content = await this.seoValidator.getPageContent(page);
    const issues = [];
    const metrics = {};

    // Run only the specific checks needed
    for (const check of checks) {
      const checkFunction = this.seoValidator.rules.critical.find(
        rule => rule.name === check
      ) || this.seoValidator.rules.high.find(
        rule => rule.name === check
      ) || this.seoValidator.rules.medium.find(
        rule => rule.name === check
      );

      if (checkFunction) {
        const checkIssues = await checkFunction(page, content, metrics);
        if (checkIssues && checkIssues.length > 0) {
          issues.push(...checkIssues);
        }
      }
    }

    return { issues, metrics };
  }

  async getVerificationHistory(issueId) {
    // This would typically fetch from a database
    // For now, returning mock data
    return [
      {
        issueId,
        checkedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'failed',
        details: 'Issue still present'
      },
      {
        issueId,
        checkedAt: new Date().toISOString(),
        status: 'fixed',
        details: 'Issue resolved'
      }
    ];
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = RecheckService;
