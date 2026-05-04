/**
 * Optimization logic for EV charging scheduling.
 * Selects the cheapest N hours within a given time window.
 */

/**
 * Checks whether an hour (0-23) falls within a time window.
 * Supports midnight-crossing windows (e.g. windowStart=22, windowEnd=7).
 * @param {number} hour - Hour to test (0-23)
 * @param {number} windowStart - Window start hour (inclusive)
 * @param {number} windowEnd - Window end hour (exclusive)
 * @returns {boolean}
 */
function isHourInWindow(hour, windowStart, windowEnd) {
  if (windowStart < windowEnd) {
    return hour >= windowStart && hour < windowEnd;
  }
  // Midnight-crossing window (e.g. 22:00 – 07:00)
  return hour >= windowStart || hour < windowEnd;
}

/**
 * Picks the cheapest hours within the allowed window.
 * @param {object} opts
 * @param {Array<{hour:number, price:number}>} opts.prices - All hourly prices for the day
 * @param {number} [opts.hoursNeeded] - Number of hours to charge
 * @param {number} [opts.energyNeeded] - kWh to charge (converted using chargingPower)
 * @param {number} [opts.chargingPower=11] - Charging power in kW
 * @param {number} [opts.windowStart=0] - Earliest allowed hour (inclusive)
 * @param {number} [opts.windowEnd=24] - Latest allowed hour (exclusive; use 24 for end-of-day)
 * @param {number} [opts.targetReadyBy] - If set, exclude hours >= this value
 * @returns {number[]} Sorted list of selected hours
 */
function optimize({ prices, hoursNeeded, energyNeeded, chargingPower = 11, windowStart = 0, windowEnd = 24, targetReadyBy }) {
  let hours = hoursNeeded;
  if (!hours && energyNeeded) {
    hours = Math.ceil(energyNeeded / chargingPower);
  }
  if (!hours || hours <= 0) {
    throw new Error('hoursNeeded or energyNeeded must be provided and positive');
  }

  // Filter to allowed window
  let windowPrices = prices.filter(p => isHourInWindow(p.hour, windowStart, windowEnd));

  // Apply targetReadyBy (exclude hours at or after this time)
  if (targetReadyBy !== undefined && targetReadyBy !== null) {
    windowPrices = windowPrices.filter(p => p.hour < targetReadyBy);
  }

  if (windowPrices.length === 0) {
    throw new Error('No hours available in the specified window');
  }
  if (windowPrices.length < hours) {
    throw new Error(`Not enough hours in window. Need ${hours}, available ${windowPrices.length}`);
  }

  // Sort by price ascending, pick cheapest N
  const sorted = [...windowPrices].sort((a, b) => a.price - b.price);
  const selected = sorted.slice(0, hours);

  return selected.map(p => p.hour).sort((a, b) => a - b);
}

module.exports = { optimize, isHourInWindow };
