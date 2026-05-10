const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json());

const db = require('./db');
const { startScheduler } = require('./services/scheduler');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  try {
    const db = require('./db');
    const totalProjects = db.prepare('SELECT COUNT(*) as count FROM projects WHERE is_active = 1').get();
    const updatedProjects = db.prepare('SELECT COUNT(*) as count FROM projects WHERE is_active = 1 AND has_updates = 1').get();
    const todayUpdates = db.prepare(`
      SELECT COUNT(*) as count FROM update_logs
      WHERE status = 'success' AND date(pull_time) = date('now', 'localtime')
    `).get();
    const lastCheck = db.prepare(`
      SELECT pull_time FROM update_logs ORDER BY pull_time DESC LIMIT 1
    `).get();
    res.json({
      totalProjects: totalProjects.count,
      updatedProjects: updatedProjects.count,
      todayUpdates: todayUpdates.count,
      lastCheckAt: lastCheck ? lastCheck.pull_time : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone route uses SSE — needs raw response control before router middleware interferes
app.post('/api/projects/clone', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  let cancelled = false;
  req.on('close', () => { cancelled = true; });

  function send(type, data) {
    if (!cancelled) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const { cloneRepo } = require('./services/git-service');
  try {
    send('progress', { message: 'Cloning into...\n' });
    const project = await cloneRepo(url, (msg) => {
      send('progress', { message: msg });
    });
    if (!cancelled) send('done', { project });
  } catch (err) {
    if (!cancelled) send('error', { message: err.message });
  }
  if (!cancelled) res.end();
});

const projectsRouter = require('./routes/projects');
app.use('/api/projects', projectsRouter);

const updatesRouter = require('./routes/updates');
const configRouter = require('./routes/config');
app.use('/api/projects', updatesRouter);
app.use('/api/config', configRouter);

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Wait for DB initialisation before starting the server
db.ready().then(() => {
  console.log('Database initialized at:', db.name);
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Repo Manager running at http://localhost:${PORT}`);
  });
});
