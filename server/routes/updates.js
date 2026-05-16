const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET /:projectId/updates - get update history for a project
router.get('/:projectId/updates', (req, res) => {
  try {
    const project = db.prepare('SELECT last_commit_hash, last_commit_msg FROM projects WHERE id = ?').get(req.params.projectId);
    const updates = db.prepare(`
      SELECT * FROM update_logs WHERE project_id = ?
      ORDER BY pull_time DESC LIMIT 50
    `).all(req.params.projectId);
    res.json(updates.map(u => ({
      ...u,
      commit_log: JSON.parse(u.commit_log || '[]'),
      release_info: JSON.parse(u.release_info || '[]'),
      last_commit_hash: project?.last_commit_hash || null,
      last_commit_msg: project?.last_commit_msg || null,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:projectId/updates/:id - delete an update log entry
router.delete('/:projectId/updates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM update_logs WHERE id = ? AND project_id = ?').run(req.params.id, req.params.projectId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
