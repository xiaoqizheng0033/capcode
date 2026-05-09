const cron = require('node-cron');
const db = require('../db');
const { pullRepo } = require('./git-service');

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

let task = null;

async function runPullAll() {
  console.log(`[Scheduler] Starting pull cycle at ${new Date().toLocaleString()}`);
  const projects = db.prepare('SELECT id, name FROM projects WHERE is_active = 1').all();

  for (const project of projects) {
    try {
      const result = await pullRepo(project.id);
      console.log(`[Scheduler] ${project.name}: ${result.status}${result.commitsCount ? ` (${result.commitsCount} commits)` : ''}`);
    } catch (err) {
      console.error(`[Scheduler] ${project.name}: failed - ${err.message}`);
    }
  }
  console.log(`[Scheduler] Pull cycle complete`);
}

function startScheduler() {
  if (task) task.stop();

  const intervalHours = parseInt(getConfig('scan_interval_hours')) || 6;
  const cronExpression = `0 */${intervalHours} * * *`;

  task = cron.schedule(cronExpression, runPullAll);
  console.log(`[Scheduler] Started with interval: ${intervalHours} hours (cron: ${cronExpression})`);

  // Also run an initial pull on startup after 10 seconds
  setTimeout(runPullAll, 10000);
}

function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
    console.log('[Scheduler] Stopped');
  }
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

function getStatus() {
  return {
    running: task !== null,
    intervalHours: parseInt(getConfig('scan_interval_hours')) || 6,
  };
}

module.exports = { startScheduler, stopScheduler, restartScheduler, getStatus, runPullAll };
