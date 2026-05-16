const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');

const db = require('../db');
const { translateEnToZh } = require('./translate');
const { generateSummary, classifyProjects } = require('./ai-service');

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

async function getRepoInfo(dirPath) {
  const git = simpleGit(dirPath);
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;
  } catch {
    return null;
  }

  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');
  const remoteUrl = origin ? origin.refs.fetch : null;

  let defaultBranch = 'main';
  try {
    const branchSummary = await git.branch();
    defaultBranch = branchSummary.current;
  } catch {}

  const log = await git.log({ maxCount: 1 });
  const lastCommit = log.latest;
  const lastCommitHash = lastCommit ? lastCommit.hash : null;
  const lastCommitDate = lastCommit ? lastCommit.date : null;
  const lastCommitMsg = lastCommit ? lastCommit.message : null;

  // Try to extract README first paragraph AND full content
  let autoDescription = '';
  let readmeContent = '';
  const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README'];
  for (const f of readmeFiles) {
    const readmePath = path.join(dirPath, f);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      readmeContent = content;
      // Extract first meaningful paragraph for autoDescription
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 30 && !trimmed.startsWith('#') && !trimmed.startsWith('![') && !trimmed.startsWith('[!')) {
          autoDescription = trimmed.substring(0, 300);
          break;
        }
      }
      break;
    }
  }

  // Translate English description to Chinese
  if (autoDescription) {
    autoDescription = await translateEnToZh(autoDescription);
  }

  return { remoteUrl, defaultBranch, lastCommitHash, lastCommitDate, lastCommitMsg, autoDescription, readmeContent };
}

async function scanDirectory() {
  const basePath = getConfig('repo_base_path');
  if (!basePath || !fs.existsSync(basePath)) {
    console.error(`Base path not found: ${basePath}`);
    return { added: [], removed: [], updated: [] };
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const existingProjects = db.prepare('SELECT id, name, path FROM projects WHERE is_active = 1').all();
  const existingPaths = new Set(existingProjects.map(p => path.normalize(p.path)));

  const scannedNames = new Set();
  const added = [];
  const updated = [];

  const insertStmt = db.prepare(`
    INSERT INTO projects (name, path, remote_url, default_branch, auto_description, readme_content, ai_summary, category, last_commit_hash, last_commit_date, last_commit_msg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE projects SET remote_url = ?, default_branch = ?, auto_description = ?, readme_content = ?, last_commit_hash = ?, last_commit_date = ?, last_commit_msg = ?, updated_at = datetime('now', 'localtime'), is_active = 1
    WHERE path = ?
  `);

  for (const dirName of dirs) {
    const dirPath = path.join(basePath, dirName);
    const normalPath = path.normalize(dirPath);
    scannedNames.add(dirName);

    const info = await getRepoInfo(dirPath);
    if (!info) continue; // Skip non-git directories

    if (existingPaths.has(normalPath)) {
      updateStmt.run(info.remoteUrl, info.defaultBranch, info.autoDescription, info.readmeContent, info.lastCommitHash, info.lastCommitDate, info.lastCommitMsg, normalPath);
      updated.push(dirName);
    } else {
      insertStmt.run(dirName, normalPath, info.remoteUrl, info.defaultBranch, info.autoDescription, info.readmeContent, '', '', info.lastCommitHash, info.lastCommitDate, info.lastCommitMsg);
      added.push(dirName);
    }
  }

  // Mark removed projects as inactive
  const removedProjects = existingProjects.filter(p => !scannedNames.has(p.name));
  const deactivateStmt = db.prepare("UPDATE projects SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE name = ?");
  for (const p of removedProjects) {
    deactivateStmt.run(p.name);
  }

  // AI processing for projects without summaries
  const projectsWithoutSummary = db.prepare(
    "SELECT * FROM projects WHERE is_active = 1 AND ai_summary = ''"
  ).all();

  if (projectsWithoutSummary.length > 0) {
    console.log(`[AI] Processing ${projectsWithoutSummary.length} projects without summaries...`);
    for (const proj of projectsWithoutSummary) {
      try {
        const summary = await generateSummary(proj);
        db.prepare("UPDATE projects SET ai_summary = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
          .run(summary, proj.id);
        console.log(`[AI] Summary generated for: ${proj.name}`);
      } catch (err) {
        console.error(`[AI] Summary failed for ${proj.name}: ${err.message}`);
      }
    }

    // Run classification (for projects without tags)
    try {
      const allProjects = db.prepare("SELECT id, name, auto_description, description, remote_url FROM projects WHERE is_active = 1 AND (tags IS NULL OR tags = '[]' OR tags = '')").all();
      if (allProjects.length > 0) {
        const classifications = await classifyProjects(allProjects);
        for (const c of classifications) {
          db.prepare("UPDATE projects SET tags = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .run(JSON.stringify(c.tags || []), c.id);
        }
        console.log(`[AI] Classification complete for ${classifications.length} projects`);
      }
    } catch (err) {
      console.error(`[AI] Classification failed: ${err.message}`);
    }
  }

  return { added, removed: removedProjects.map(p => p.name), updated };
}

module.exports = { scanDirectory };
