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

// POST /api/config/test-ai - test AI API connection
router.post('/test-ai', async (req, res) => {
  try {
    const https = require('https');
    const apiKey = db.prepare("SELECT value FROM config WHERE key = 'ai_api_key'").get()?.value;
    const apiUrl = db.prepare("SELECT value FROM config WHERE key = 'ai_api_url'").get()?.value;

    if (!apiKey) return res.json({ success: false, message: 'API Key 未配置' });
    if (!apiUrl) return res.json({ success: false, message: 'API URL 未配置' });

    const url = new URL(apiUrl);
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5,
    });

    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      }, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed);
          } catch { reject(new Error('Invalid response')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(body);
      req.end();
    });

    res.json({ success: true, message: '连接成功' });
  } catch (err) {
    res.json({ success: false, message: '连接失败: ' + err.message });
  }
});

module.exports = router;
