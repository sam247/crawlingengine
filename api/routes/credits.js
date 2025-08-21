const express = require('express');
const CreditService = require('../../src/services/credits');

const router = express.Router();
const creditService = new CreditService();

// Get available credit packages
router.get('/packages', (req, res) => {
  res.json({
    success: true,
    data: creditService.getPackages()
  });
});

// Get user's credit balance
router.get('/balance/:userId', async (req, res) => {
  try {
    const balance = await creditService.getBalance(req.params.userId);
    res.json({
      success: true,
      data: { balance }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get transaction history
router.get('/transactions/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const transactions = await creditService.getTransactionHistory(req.params.userId, limit);
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Calculate crawl cost
router.post('/calculate-cost', (req, res) => {
  try {
    const { pages, depth, customChecks } = req.body;
    const cost = creditService.calculateCrawlCost(pages, depth, customChecks);
    res.json({
      success: true,
      data: { cost }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Calculate recheck cost
router.post('/calculate-recheck-cost', (req, res) => {
  try {
    const { issueCount } = req.body;
    const cost = creditService.calculateRecheckCost(issueCount);
    res.json({
      success: true,
      data: { cost }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Add credits (after payment verification)
router.post('/add', async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters'
      });
    }

    const txId = await creditService.addCredits(userId, amount, reason);
    const newBalance = await creditService.getBalance(userId);

    res.json({
      success: true,
      data: {
        transactionId: txId,
        newBalance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
