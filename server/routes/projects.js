const express = require('express');
const router = express.Router();
const db = require('../db');
const { scanDirectory } = require('../services/scanner');
const { pullRepo, cloneRepo } = require('../services/git-service');

// GET /api/projects - list all projects
router.get('/', (req, res) => {
  try {
    const search = req.query.search || '';
    let projects;
    if (search) {
      projects = db.prepare(`
        SELECT * FROM projects WHERE is_active = 1 AND (name LIKE ? OR description LIKE ? OR auto_description LIKE ?)
        ORDER BY name ASC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      projects = db.prepare('SELECT * FROM projects WHERE is_active = 1 ORDER BY name ASC').all();
    }
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id - get single project
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/clone - clone new project from GitHub URL
router.post('/clone', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const project = await cloneRepo(url);
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/projects/scan - manual directory scan
router.post('/scan', async (req, res) => {
  try {
    const result = await scanDirectory();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/pull - manual pull single project
router.post('/:id/pull', async (req, res) => {
  try {
    const result = await pullRepo(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id - update project info (manual description edit)
router.put('/:id', (req, res) => {
  try {
    const { description } = req.body;
    if (description === undefined) return res.status(400).json({ error: 'description is required' });
    db.prepare(`
      UPDATE projects SET description = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `).run(description, req.params.id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
