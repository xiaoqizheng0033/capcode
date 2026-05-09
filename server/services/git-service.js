const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const db = require('../db');

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

async function pullRepo(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project not found');
  if (!fs.existsSync(project.path)) throw new Error('Project directory not found');

  const git = simpleGit(project.path);

  // Record HEAD before pull
  const logBefore = await git.log({ maxCount: 1 });
  const hashBefore = logBefore.latest ? logBefore.latest.hash : null;

  try {
    await git.pull({ '--ff-only': null });
  } catch (pullErr) {
    // Try pull with merge strategy on failure
    try {
      await git.pull(['-X', 'theirs']);
    } catch (mergeErr) {
      // Record failure
      db.prepare(`
        INSERT INTO update_logs (project_id, status, error_msg)
        VALUES (?, 'failed', ?)
      `).run(projectId, mergeErr.message);

      db.prepare(`
        UPDATE projects SET last_pull_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(projectId);

      throw mergeErr;
    }
  }

  // Record HEAD after pull
  const logAfter = await git.log({ maxCount: 1 });
  const hashAfter = logAfter.latest ? logAfter.latest.hash : null;

  if (hashBefore === hashAfter) {
    // No changes
    db.prepare(`
      INSERT INTO update_logs (project_id, status)
      VALUES (?, 'no_change')
    `).run(projectId);

    db.prepare(`
      UPDATE projects SET has_updates = 0, last_pull_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(projectId);

    return { status: 'no_change' };
  }

  // Get new commits
  const newLog = await git.log({ from: hashBefore, to: hashAfter });
  const commits = newLog.all || [];
  const commitLog = commits.map(c => ({
    hash: c.hash,
    date: c.date,
    message: c.message,
    author: c.author_name,
  }));

  db.prepare(`
    INSERT INTO update_logs (project_id, commits_count, commit_log, status)
    VALUES (?, ?, ?, 'success')
  `).run(projectId, commits.length, JSON.stringify(commitLog));

  db.prepare(`
    UPDATE projects SET
      last_commit_hash = ?, last_commit_date = ?, last_commit_msg = ?,
      has_updates = 1, last_pull_at = datetime('now', 'localtime'),
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    commits[0]?.hash || hashAfter,
    commits[0]?.date || logAfter.latest?.date,
    commits[0]?.message || logAfter.latest?.message,
    projectId
  );

  return { status: 'success', commitsCount: commits.length };
}

async function cloneRepo(githubUrl) {
  // Validate URL format
  const urlPattern = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
  const sshPattern = /^git@github\.com:[\w.-]+\/[\w.-]+(\.git)?$/;
  if (!urlPattern.test(githubUrl) && !sshPattern.test(githubUrl)) {
    throw new Error('Invalid GitHub URL format');
  }

  // Parse repo name from URL
  let repoName = githubUrl.split('/').pop().replace(/\.git$/, '');

  const basePath = getConfig('repo_base_path');
  if (!basePath) throw new Error('repo_base_path not configured');

  const targetPath = path.join(basePath, repoName);
  if (fs.existsSync(targetPath)) {
    throw new Error(`Directory already exists: ${repoName}`);
  }

  const git = simpleGit(basePath);
  await git.clone(githubUrl, repoName, ['--depth', '1']);

  // After clone, scan README to get description
  let autoDescription = '';
  const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README'];
  for (const f of readmeFiles) {
    const readmePath = path.join(targetPath, f);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
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

  // Get git info
  const targetGit = simpleGit(targetPath);
  const remotes = await targetGit.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');
  const remoteUrl = origin ? origin.refs.fetch : githubUrl;

  let defaultBranch = 'main';
  try {
    const branchSummary = await targetGit.branch();
    defaultBranch = branchSummary.current;
  } catch {}

  const log = await targetGit.log({ maxCount: 1 });
  const lastCommit = log.latest;

  const result = db.prepare(`
    INSERT INTO projects (name, path, remote_url, default_branch, auto_description, last_commit_hash, last_commit_date, last_commit_msg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    repoName, path.normalize(targetPath), remoteUrl, defaultBranch, autoDescription,
    lastCommit?.hash || null, lastCommit?.date || null, lastCommit?.message || null
  );

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
}

module.exports = { pullRepo, cloneRepo };
