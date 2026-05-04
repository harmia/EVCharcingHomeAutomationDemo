# ⚡ EV Charging Scheduler

A simple home-automation web app that schedules EV charging on an hourly basis using spot electricity prices.

![EV Charging Scheduler UI](https://github.com/user-attachments/assets/35824d73-6214-481e-ad60-6c4e833c4b48)

---

## Quick Start

```bash
# 1 – Install dependencies
npm install

# 2 – Start the server (demo mode, no external API needed)
npm start
# → http://localhost:3000
```

That's it. The app runs entirely with local demo data by default.

---

## How to Use the App

| Action | How |
|---|---|
| **Browse prices** | Click *Today* / *Tomorrow* tabs |
| **Select hours manually** | Click any hour row to toggle it |
| **Auto-pick cheapest hours** | Fill in the Settings panel → click **⚡ Auto-pick cheapest** |
| **Save your schedule** | Click **💾 Save schedule** (persisted to SQLite) |
| **Clear selection** | Click **✕ Clear** |

### Settings explained

| Field | Meaning |
|---|---|
| Charging power (kW) | Your charger's max power (default 11 kW) |
| Energy needed (kWh) | How much to charge — auto-calculates required hours |
| Window start / end | Earliest and latest hours the charger is allowed to run |
| Ready by | Must finish charging before this hour |

The **"In window"** blue-highlighted rows show which hours fall inside your allowed charging window.

---

## Switching Between Demo and Live Mode

### Demo mode (default)
Reads prices from `data/demo-prices.json`. Works offline, no configuration needed.

```bash
npm start
# or explicitly:
PRICE_MODE=demo npm start
```

### Live mode
Fetches real hourly spot prices from a public JSON API (cached for 10 minutes).

```bash
PRICE_MODE=live npm start
```

The default live endpoint is the Finnish [spot-hinta.fi](https://spot-hinta.fi) API. You can point it at any compatible endpoint:

```bash
PRICE_MODE=live PRICE_API_URL=https://your-price-api.example/endpoint npm start
```

The API response is expected to be a JSON array of objects with `DateTime` (ISO-8601) and `PriceWithTax` (EUR/kWh) fields — the same format as spot-hinta.fi's `/TodayAndDayForward`.

All prices are normalised to **snt/kWh** and displayed in **Europe/Helsinki** local time.

---

## Running Tests

```bash
npm test
```

14 unit tests cover the core optimisation engine (`src/optimize.js`): window logic, energy-to-hours conversion, midnight-crossing windows, `targetReadyBy` filtering, and error cases.

---

## Architecture

```
├── src/
│   ├── server.js          Entry point — starts Express on PORT (default 3000)
│   ├── app.js             Express app + static-file serving
│   ├── db.js              SQLite setup (better-sqlite3), seeds default settings
│   ├── priceProvider.js   PriceProvider abstraction (demo JSON ↔ live HTTP)
│   ├── optimize.js        Pure optimisation logic — picks cheapest N hours
│   └── routes/
│       ├── prices.js      GET  /api/prices?day=today|tomorrow
│       ├── schedule.js    GET  /api/schedule  |  POST /api/schedule
│       └── optimize.js    POST /api/optimize
│
├── data/
│   ├── demo-prices.json   Static 24-hour price sets for today & tomorrow
│   └── ev-scheduler.db    SQLite database (auto-created, git-ignored)
│
├── public/
│   ├── index.html         Single-page app shell
│   ├── css/styles.css     Dark-theme CSS (CSS custom properties, responsive)
│   └── js/app.js          Vanilla JS — state, rendering, API calls
│
└── tests/
    └── optimize.test.js   Jest unit tests for optimisation logic
```

### Key design decisions

- **No build step** — plain HTML/CSS/JS frontend, zero bundler required.
- **SQLite via `better-sqlite3`** — synchronous, zero-config, single-file database.
- **Demo mode is the default** — the app works immediately without any external API key or internet access.
- **Optimisation is a pure function** — easy to test and reason about in isolation.

---

## REST API Reference

### `GET /api/prices?day=today|tomorrow`
Returns the 24 hourly prices for the requested day.

```jsonc
// Response
{ "day": "today", "prices": [{ "hour": 0, "price": 4.82 }, ...] }
// price unit: snt/kWh
```

### `GET /api/schedule`
Returns the currently saved schedule and settings.

```jsonc
{
  "selectedHours": [{ "day": "today", "hour": 3 }, ...],
  "settings": { "charging_power": "11", "energy_needed": "22", ... }
}
```

### `POST /api/schedule`
Saves the schedule and settings.

```jsonc
// Request body
{
  "selectedHours": [{ "day": "today", "hour": 3 }, { "day": "today", "hour": 4 }],
  "settings": { "charging_power": "11", "energy_needed": "22" }
}
```

### `POST /api/optimize`
Returns the cheapest hours within the specified window.

```jsonc
// Request body
{
  "day": "today",
  "energyNeeded": 22,
  "chargingPower": 11,
  "windowStart": 22,
  "windowEnd": 7,
  "targetReadyBy": 7
}

// Response
{ "day": "today", "selectedHours": [3, 4], "totalCostEur": 0.80 }
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `PRICE_MODE` | `demo` | `demo` or `live` |
| `PRICE_API_URL` | spot-hinta.fi endpoint | Live price API URL |
| `DB_PATH` | `data/ev-scheduler.db` | Path to SQLite file |
