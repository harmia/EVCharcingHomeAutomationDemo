const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const demoPricesPath = path.join(__dirname, '..', 'data', 'demo-prices.json');

// In-memory price cache for live mode
let _cache = { today: null, tomorrow: null, fetchedAt: null };

function isDemoMode() {
  return (process.env.PRICE_MODE || 'demo') !== 'live';
}

function getDemoPrices(day) {
  const data = JSON.parse(fs.readFileSync(demoPricesPath, 'utf-8'));
  return data[day] || [];
}

async function fetchLivePrices() {
  const url = process.env.PRICE_API_URL || 'https://api.spot-hinta.fi/TodayAndDayForward';
  const response = await axios.get(url, { timeout: 10000 });
  return response.data;
}

/**
 * Normalises the spot-hinta.fi JSON array into { today: [...], tomorrow: [...] }.
 * Each entry: { hour: 0-23, price: snt/kWh }
 */
function normalizeLivePrices(rawData) {
  const now = new Date();
  const opts = { timeZone: 'Europe/Helsinki' };

  const todayStr = now.toLocaleDateString('fi-FI', opts);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('fi-FI', opts);

  const todayArr = new Array(24).fill(null);
  const tomorrowArr = new Array(24).fill(null);

  for (const entry of rawData) {
    const dt = new Date(entry.DateTime);
    const dateStr = dt.toLocaleDateString('fi-FI', opts);
    const hour = dt.toLocaleTimeString('fi-FI', { ...opts, hour: '2-digit', hour12: false });
    const h = parseInt(hour, 10);
    // PriceWithTax is EUR/kWh; convert to snt/kWh
    const price = parseFloat((entry.PriceWithTax * 100).toFixed(4));

    if (dateStr === todayStr && h >= 0 && h < 24) {
      todayArr[h] = { hour: h, price };
    } else if (dateStr === tomorrowStr && h >= 0 && h < 24) {
      tomorrowArr[h] = { hour: h, price };
    }
  }

  return {
    today: todayArr.filter(Boolean),
    tomorrow: tomorrowArr.filter(Boolean),
  };
}

async function getPrices(day) {
  if (!['today', 'tomorrow'].includes(day)) {
    throw new Error('day must be "today" or "tomorrow"');
  }

  if (isDemoMode()) {
    return getDemoPrices(day);
  }

  // Serve from in-memory cache if still fresh
  if (_cache.fetchedAt && Date.now() - _cache.fetchedAt < CACHE_TTL_MS && _cache[day]) {
    return _cache[day];
  }

  const rawData = await fetchLivePrices();
  const normalized = normalizeLivePrices(rawData);
  _cache = { ...normalized, fetchedAt: Date.now() };

  return _cache[day] || [];
}

module.exports = { getPrices, isDemoMode };
