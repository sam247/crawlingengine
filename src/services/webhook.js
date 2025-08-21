const crypto = require('crypto');

class WebhookService {
  constructor() {
    this.webhookSecret = process.env.LOVABLE_WEBHOOK_SECRET || '479b4af3bdd441c7ccb0e7bfec794e2c585148c3295041409e82cb44f0be8669';
    this.webhookUrl = process.env.LOVABLE_WEBHOOK_URL || 'https://xyscwvumxxxadchraqys.supabase.co/functions/v1/crawler-webhook';
    this.maxRetries = 3;
    this.timeout = 10000;
  }

  generateSignature(payload) {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async sendWebhook(payload, retryCount = 0) {
    try {
      const signature = this.generateSignature(payload);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: JSON.stringify(payload),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (retryCount < this.maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendWebhook(payload, retryCount + 1);
      }
      throw error;
    }
  }

  async notifyCrawlComplete(crawlResult) {
    const payload = {
      jobId: crawlResult.jobId,
      status: crawlResult.status,
      url: crawlResult.url,
      healthScore: this.calculateHealthScore(crawlResult.issues),
      issues: this.categorizeIssues(crawlResult.issues),
      categories: this.aggregateCategories(crawlResult.issues),
      creditsUsed: crawlResult.creditsUsed,
      timestamp: new Date().toISOString()
    };

    return this.sendWebhook(payload);
  }

  calculateHealthScore(issues) {
    // Calculate health score based on issue severity
    const weights = { low: 1, medium: 2, high: 3, critical: 5 };
    const totalIssues = issues.length;
    if (totalIssues === 0) return 100;

    const weightedSum = issues.reduce((sum, issue) => {
      return sum + (weights[issue.severity] || 1);
    }, 0);

    return Math.max(0, Math.min(100, 100 - (weightedSum / totalIssues) * 10));
  }

  categorizeIssues(issues) {
    return issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});
  }

  aggregateCategories(issues) {
    return issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});
  }
}

module.exports = WebhookService;
