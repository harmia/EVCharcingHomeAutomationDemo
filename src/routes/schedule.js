const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/schedule
router.get('/', (req, res) => {
  const selectedHours = db.prepare('SELECT day, hour FROM schedule WHERE selected = 1 ORDER BY day, hour').all();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ selectedHours, settings });
});

// POST /api/schedule  { selectedHours: [{day, hour}, ...], settings: {key: value} }
router.post('/', (req, res) => {
  const { selectedHours, settings } = req.body;

  db.prepare('DELETE FROM schedule').run();

  if (Array.isArray(selectedHours)) {
    const insert = db.prepare('INSERT OR REPLACE INTO schedule (day, hour, selected) VALUES (?, ?, 1)');
    for (const { day, hour } of selectedHours) {
      insert.run(day, hour);
    }
  }

  if (settings && typeof settings === 'object') {
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }
  }

  res.json({ success: true });
});

module.exports = router;
