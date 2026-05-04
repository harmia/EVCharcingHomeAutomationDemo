const express = require('express');
const router = express.Router();
const { getPrices } = require('../priceProvider');

// GET /api/prices?day=today|tomorrow
router.get('/', async (req, res) => {
  const day = req.query.day || 'today';
  if (!['today', 'tomorrow'].includes(day)) {
    return res.status(400).json({ error: 'Invalid day. Use "today" or "tomorrow".' });
  }
  try {
    const prices = await getPrices(day);
    res.json({ day, prices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
