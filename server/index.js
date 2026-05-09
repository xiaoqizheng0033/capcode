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

const projectsRouter = require('./routes/projects');
app.use('/api/projects', projectsRouter);

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
