const express = require('express');
const CreditService = require('../../src/services/credits');

const router = express.Router();
const creditService = new CreditService();

// Recheck specific issue
router.post('/issues/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { url, type, userId } = req.body;

    if (!url || !type || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Calculate and reserve credits
    const recheckCost = creditService.calculateRecheckCost(1); // 1 issue
    await creditService.reserveCredits(userId, recheckCost, issueId);

    try {
      // Lazy-load to avoid importing Puppeteer on cold start
      const RecheckService = require('../../src/services/recheckService');
      const recheckService = new RecheckService();
      const result = await recheckService.recheckIssue(url, issueId, type);
      
      // Deduct credits only if recheck was successful
      await creditService.releaseReservation(issueId, true);
      await creditService.deductCredits(userId, recheckCost, 'Recheck: ' + type);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      // Release reserved credits on failure
      await creditService.releaseReservation(issueId, false);
      throw error;
    }
  } catch (error) {
    console.error('Recheck error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Recheck all issues for a URL
router.post('/url', async (req, res) => {
  try {
    const { url, issues, userId } = req.body;

    if (!url || !Array.isArray(issues) || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Calculate and reserve credits
    const recheckCost = creditService.calculateRecheckCost(issues.length);
    await creditService.reserveCredits(userId, recheckCost, url);

    try {
      const RecheckService = require('../../src/services/recheckService');
      const recheckService = new RecheckService();
      const results = await Promise.all(
        issues.map(issue => recheckService.recheckIssue(url, issue.id, issue.type))
      );

      // Deduct credits after successful recheck
      await creditService.releaseReservation(url, true);
      await creditService.deductCredits(
        userId, 
        recheckCost, 
        \`Bulk recheck: \${url}\`
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      // Release reserved credits on failure
      await creditService.releaseReservation(url, false);
      throw error;
    }
  } catch (error) {
    console.error('Bulk recheck error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get verification history
router.get('/issues/:issueId/history', async (req, res) => {
  try {
    const { issueId } = req.params;
    const history = await recheckService.getVerificationHistory(issueId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
