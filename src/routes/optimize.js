const express = require('express');
const router = express.Router();
const { getPrices } = require('../priceProvider');
const { optimize } = require('../optimize');

// POST /api/optimize
router.post('/', async (req, res) => {
  const {
    day = 'today',
    hoursNeeded,
    energyNeeded,
    chargingPower = 11,
    windowStart = 22,
    windowEnd = 7,
    targetReadyBy,
  } = req.body;

  try {
    const prices = await getPrices(day);
    if (!prices || prices.length === 0) {
      return res.status(404).json({ error: 'No price data available for the specified day.' });
    }

    const selectedHours = optimize({
      prices,
      hoursNeeded: hoursNeeded !== undefined ? parseInt(hoursNeeded, 10) : undefined,
      energyNeeded: energyNeeded !== undefined ? parseFloat(energyNeeded) : undefined,
      chargingPower: parseFloat(chargingPower),
      windowStart: parseInt(windowStart, 10),
      windowEnd: parseInt(windowEnd, 10),
      targetReadyBy: targetReadyBy !== undefined ? parseInt(targetReadyBy, 10) : undefined,
    });

    // Estimated cost in EUR
    const selectedPrices = prices.filter(p => selectedHours.includes(p.hour));
    const totalCostEur = selectedPrices.reduce((sum, p) => sum + p.price * parseFloat(chargingPower), 0) / 100;

    res.json({ day, selectedHours, totalCostEur: parseFloat(totalCostEur.toFixed(2)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
