const express = require('express');
const router = express.Router();
const db = require('../db');
const { restartScheduler } = require('../services/scheduler');

// GET /api/config - get all config
router.get('/', (req, res) => {
  try {
    const configs = db.prepare('SELECT * FROM config').all();
    const result = {};
    configs.forEach(c => { result[c.key] = c.value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config - update a config value
router.put('/', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value are required' });

    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));

    // Restart scheduler if interval changed
    if (key === 'scan_interval_hours') {
      restartScheduler();
    }

    const updated = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    res.json({ key, value: updated.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
