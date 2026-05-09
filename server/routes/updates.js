const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET /:projectId/updates - get update history for a project
router.get('/:projectId/updates', (req, res) => {
  try {
    const updates = db.prepare(`
      SELECT * FROM update_logs WHERE project_id = ?
      ORDER BY pull_time DESC LIMIT 50
    `).all(req.params.projectId);
    res.json(updates.map(u => ({ ...u, commit_log: JSON.parse(u.commit_log || '[]') })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
