const redis = require('../utils/redis');

class CreditService {
  constructor() {
    this.redis = redis;

    this.packages = {
      starter: {
        credits: 100,
        price: 29,
        features: ['Basic SEO checks', 'Technical validation', 'Single domain']
      },
      professional: {
        credits: 500,
        price: 99,
        features: ['Advanced SEO analysis', 'Content quality checks', 'Multiple domains', 'Priority support']
      },
      enterprise: {
        credits: 2000,
        price: 299,
        features: ['Custom validation rules', 'API access', 'Dedicated support', 'White-label reports']
      }
    };
  }

  // Credit balance management
  async getBalance(userId) {
    const balance = await this.redis.get(`credits:${userId}`);
    return parseInt(balance) || 0;
  }

  async addCredits(userId, amount, reason) {
    const pipeline = this.redis.pipeline();
    
    // Add credits
    pipeline.incrby(`credits:${userId}`, amount);
    
    // Log transaction
    const txId = Date.now().toString();
    pipeline.hset(`credit_tx:${txId}`, {
      userId,
      amount,
      type: 'add',
      reason,
      timestamp: new Date().toISOString()
    });
    
    // Add to user's transaction history
    pipeline.lpush(`credit_history:${userId}`, txId);
    
    await pipeline.exec();
    return txId;
  }

  async deductCredits(userId, amount, reason) {
    const balance = await this.getBalance(userId);
    if (balance < amount) {
      throw new Error('Insufficient credits');
    }

    const pipeline = this.redis.pipeline();
    
    // Deduct credits
    pipeline.decrby(`credits:${userId}`, amount);
    
    // Log transaction
    const txId = Date.now().toString();
    pipeline.hset(`credit_tx:${txId}`, {
      userId,
      amount: -amount,
      type: 'deduct',
      reason,
      timestamp: new Date().toISOString()
    });
    
    // Add to user's transaction history
    pipeline.lpush(`credit_history:${userId}`, txId);
    
    await pipeline.exec();
    return txId;
  }

  // Transaction history
  async getTransactionHistory(userId, limit = 10) {
    const txIds = await this.redis.lrange(`credit_history:${userId}`, 0, limit - 1);
    if (!txIds.length) return [];

    const pipeline = this.redis.pipeline();
    txIds.forEach(txId => {
      pipeline.hgetall(`credit_tx:${txId}`);
    });

    const transactions = await pipeline.exec();
    return transactions.map((tx, i) => ({
      id: txIds[i],
      ...tx
    }));
  }

  // Cost calculation
  calculateCrawlCost(pages, depth = 1, customChecks = 0) {
    // Base cost: 1 credit per page
    let cost = pages;
    
    // Deep crawl: 2x cost for each level beyond 1
    if (depth > 1) {
      cost *= (1 + (depth - 1) * 0.5);
    }
    
    // Custom checks: 2 credits per rule
    cost += customChecks * 2;
    
    return Math.ceil(cost);
  }

  calculateRecheckCost(issueCount) {
    // 0.5 credits per issue for rechecks
    return Math.ceil(issueCount * 0.5);
  }

  // Package information
  getPackages() {
    return this.packages;
  }

  // Credit reservation system for long-running operations
  async reserveCredits(userId, amount, operationId) {
    const balance = await this.getBalance(userId);
    if (balance < amount) {
      throw new Error('Insufficient credits');
    }

    const pipeline = this.redis.pipeline();
    
    // Deduct credits
    pipeline.decrby(`credits:${userId}`, amount);
    
    // Store reservation
    pipeline.hset(`credit_reservation:${operationId}`, {
      userId,
      amount,
      timestamp: Date.now()
    });
    
    await pipeline.exec();
  }

  async releaseReservation(operationId, success) {
    const reservation = await this.redis.hgetall(`credit_reservation:${operationId}`);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const pipeline = this.redis.pipeline();
    
    // If operation failed, return credits
    if (!success) {
      pipeline.incrby(`credits:${reservation.userId}`, reservation.amount);
    }
    
    // Clear reservation
    pipeline.del(`credit_reservation:${operationId}`);
    
    await pipeline.exec();
  }
}

module.exports = CreditService;
