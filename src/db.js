const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ev-scheduler.db');

// Ensure the data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS schedule (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    day     TEXT    NOT NULL,
    hour    INTEGER NOT NULL,
    selected INTEGER NOT NULL DEFAULT 0,
    UNIQUE(day, hour)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_cache (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    day        TEXT    NOT NULL,
    hour       INTEGER NOT NULL,
    price      REAL    NOT NULL,
    fetched_at INTEGER NOT NULL,
    UNIQUE(day, hour)
  );
`);

// Seed default settings (ignored if already present)
const defaultSettings = {
  charging_power: '11',
  energy_needed: '22',
  window_start: '22',
  window_end: '7',
  target_ready_by: '7',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, value);
}

module.exports = db;
