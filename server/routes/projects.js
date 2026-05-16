const express = require('express');
const router = express.Router();
const db = require('../db');
const { scanDirectory } = require('../services/scanner');
const { pullRepo, cloneRepo } = require('../services/git-service');
const { generateSummary, classifyProjects } = require('../services/ai-service');

// GET /api/projects/tags - get all distinct tags (must be before /:id)
router.get('/tags', (req, res) => {
  try {
    const projects = db.prepare("SELECT tags FROM projects WHERE is_active = 1 AND tags != '[]' AND tags != ''").all();
    const tagSet = new Set();
    for (const p of projects) {
      try {
        const arr = JSON.parse(p.tags || '[]');
        arr.forEach(t => { if (t) tagSet.add(t); });
      } catch {}
    }
    const tagCounts = {};
    for (const p of projects) {
      try {
        const arr = JSON.parse(p.tags || '[]');
        arr.forEach(t => { if (t) tagCounts[t] = (tagCounts[t] || 0) + 1; });
      } catch {}
    }
    const allTags = db.prepare('SELECT COUNT(*) as cnt FROM projects WHERE is_active = 1').get().cnt;
    res.json(Array.from(tagSet).sort().map(name => ({ name, count: tagCounts[name] || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects - list all projects (without heavy readme_content)
router.get('/', (req, res) => {
  try {
    const search = req.query.search || '';
    const cols = 'id, name, path, remote_url, default_branch, description, auto_description, ai_summary, category, tags, last_commit_hash, last_commit_date, last_commit_msg, has_updates, last_pull_at, is_active, created_at, updated_at';
    let projects;
    if (search) {
      projects = db.prepare(`
        SELECT ${cols} FROM projects WHERE is_active = 1 AND (name LIKE ? OR description LIKE ? OR auto_description LIKE ?)
        ORDER BY name ASC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      projects = db.prepare(`SELECT ${cols} FROM projects WHERE is_active = 1 ORDER BY name ASC`).all();
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

    // Extract GitHub owner from remote_url
    let author = '';
    if (project.remote_url) {
      const match = project.remote_url.match(/(?:github\.com|gitee\.com)[/:]([\w.-]+)\/[\w.-]+/);
      if (match) author = match[1];
    }
    // Fallback: get last commit author from git
    if (!author) {
      try {
        const { execSync } = require('child_process');
        author = execSync('git log -1 --format=%an', {
          cwd: project.path, encoding: 'utf-8', stdio: 'pipe',
        }).trim();
      } catch {}
    }

    res.json({ ...project, author });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/clone - clone new project from GitHub URL (SSE)
router.post('/clone', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  function send(type, data) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const project = await cloneRepo(url, (msg) => {
      send('progress', { message: msg });
    });
    send('done', { project });
  } catch (err) {
    send('error', { message: err.message });
  }
  res.end();
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

// POST /api/projects/:id/pull - manual pull single project (SSE)
router.post('/:id/pull', async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  function send(type, data) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const result = await pullRepo(parseInt(req.params.id), (msg) => {
      send('progress', { message: msg });
    });
    send('done', { result });
  } catch (err) {
    send('error', { message: err.message });
  }
  res.end();
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

// POST /api/projects/regenerate-all-summaries
router.post('/regenerate-all-summaries', async (req, res) => {
  try {
    const projects = db.prepare("SELECT * FROM projects WHERE is_active = 1 AND (ai_summary IS NULL OR ai_summary = '')").all();
    if (projects.length === 0) return res.json({ message: '所有项目已有摘要', results: [] });
    const results = [];
    for (const proj of projects) {
      try {
        const summary = await generateSummary(proj);
        db.prepare("UPDATE projects SET ai_summary = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
          .run(summary, proj.id);
        results.push({ id: proj.id, name: proj.name, status: 'success' });
      } catch (err) {
        results.push({ id: proj.id, name: proj.name, status: 'failed', error: err.message });
      }
    }
    res.json({ message: '摘要生成完成', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/auto-classify
router.post('/auto-classify', async (req, res) => {
  try {
    const projects = db.prepare("SELECT id, name, auto_description, description, remote_url FROM projects WHERE is_active = 1 AND (tags IS NULL OR tags = '[]' OR tags = '')").all();
    if (projects.length === 0) return res.json({ message: '所有项目已分类' });
    const classifications = await classifyProjects(projects);
    for (const c of classifications) {
      db.prepare("UPDATE projects SET tags = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(JSON.stringify(c.tags || []), c.id);
    }
    res.json({ message: 'Classification complete', classifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/regenerate-summary
router.post('/:id/regenerate-summary', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const summary = await generateSummary(project);
    db.prepare("UPDATE projects SET ai_summary = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(summary, project.id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/tags - manual tags update
router.put('/:id/tags', (req, res) => {
  try {
    const { tags } = req.body;
    if (tags === undefined) return res.status(400).json({ error: 'tags is required' });
    db.prepare("UPDATE projects SET tags = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(JSON.stringify(tags), req.params.id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/release - get GitHub release info for current version
router.get('/:id/release', async (req, res) => {
  try {
    const project = db.prepare('SELECT remote_url, path FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.remote_url) return res.json(null);

    // Extract owner/repo from remote URL
    const match = project.remote_url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (!match) return res.json(null);
    const [, owner, repo] = match;

    // Get the latest tag (across all branches, not just HEAD)
    const { execSync } = require('child_process');
    let tag;
    try {
      // Use taggerdate to find the most recent tag available locally
      tag = execSync('git tag --sort=-taggerdate', {
        cwd: project.path, encoding: 'utf-8', stdio: 'pipe',
      }).split('\n')[0]?.trim();
    } catch {}
    if (!tag) return res.json(null);

    // Fetch release from GitHub API
    const release = await new Promise((resolve, reject) => {
      const https = require('https');
      const token = db.prepare("SELECT value FROM config WHERE key = 'github_token'").get()?.value;
      const headers = { 'User-Agent': 'repo-manager' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const opts = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
        headers,
      };
      https.get(opts, (resp) => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          if (resp.statusCode === 404) return resolve(null);
          if (resp.statusCode !== 200) return reject(new Error(`GitHub API ${resp.statusCode}`));
          try {
            const r = JSON.parse(data);
            resolve({
              tag_name: r.tag_name,
              name: r.name || r.tag_name,
              published_at: r.published_at,
              body: r.body || '',
              html_url: r.html_url,
            });
          } catch { resolve(null); }
        });
      }).on('error', reject);
    });

    res.json(release);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
