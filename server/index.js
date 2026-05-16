const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

// Disable ETag to prevent any browser-side caching of API responses
app.set('etag', false);

app.use(cors());
app.use(express.json());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Expires', '0');
  res.set('Pragma', 'no-cache');
  next();
});

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

const projectsRouter = require('./routes/projects');
app.use('/api/projects', projectsRouter);

const updatesRouter = require('./routes/updates');
const configRouter = require('./routes/config');
const callChainRouter = require('./routes/call-chain');
const learnRouter = require('./routes/learn');
app.use('/api/projects', updatesRouter);
app.use('/api/config', configRouter);
app.use('/api/projects', callChainRouter);
app.use('/api/projects', learnRouter);

// Serve uploaded images
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

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
