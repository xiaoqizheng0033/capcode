const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { translateEnToZh } = require('./translate');

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

async function pullRepo(projectId, onProgress) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project not found');
  if (!fs.existsSync(project.path)) throw new Error('Project directory not found');

  const git = simpleGit(project.path);

  // Record HEAD before pull
  const logBefore = await git.log({ maxCount: 1 });
  const hashBefore = logBefore.latest ? logBefore.latest.hash : null;

  // Run git pull via child_process to capture raw output
  const { exec } = require('child_process');
  await new Promise((resolve, reject) => {
    const child = exec('git pull --progress', { cwd: project.path }, (err) => {
      if (err) reject(err);
      else resolve();
    });
    child.stderr.on('data', (data) => {
      const text = data.toString();
      const filtered = text.split('\n').filter(l => {
        const t = l.trim();
        return t && !t.startsWith('warning:');
      }).join('\n');
      if (onProgress && filtered.trim()) onProgress(filtered);
    });
    child.stdout.on('data', (data) => {
      const text = data.toString();
      if (onProgress && text.trim()) onProgress(text);
    });
  });

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

  // Detect new tags/releases pushed in this pull
  let releaseInfo = [];
  try {
    const { execSync } = require('child_process');
    const tagList = execSync('git tag --sort=-creatordate', { cwd: project.path, encoding: 'utf-8' });
    const tags = tagList.split('\n').map(t => t.trim()).filter(Boolean);
    for (const tag of tags) {
      // Check if tag points to a commit after hashBefore
      try {
        execSync(`git merge-base --is-ancestor ${hashBefore} ${tag}`, { cwd: project.path });
        // Tag is a descendant of hashBefore — it's a new release
        const tagMsg = execSync(`git log -1 --format=%s ${tag}`, { cwd: project.path, encoding: 'utf-8' }).trim();
        releaseInfo.push({ tag, message: tagMsg });
      } catch (e) {
        // Tag is before hashBefore — skip
        // console.log('[release] tag', tag, 'NOT in range, err:', e.message);
      }
    }
  } catch {}

  db.prepare(`
    INSERT INTO update_logs (project_id, commits_count, commit_log, release_info, status)
    VALUES (?, ?, ?, ?, 'success')
  `).run(projectId, commits.length, JSON.stringify(commitLog), JSON.stringify(releaseInfo));

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

  return { status: 'success', commitsCount: commits.length, commits: commitLog };
}

/**
 * Pull all active projects sequentially and aggregate results.
 * onProgress receives stage events: { stage: 'pulling'|'pulled'|'pull-failed', project, ... }
 * Returned results feed into AI update report generation.
 */
async function pullAllProjects(onProgress) {
  const projects = db.prepare(
    'SELECT id, name FROM projects WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
  ).all();

  const results = [];
  for (const project of projects) {
    if (onProgress) onProgress({ stage: 'pulling', project });
    try {
      const r = await pullRepo(project.id, (msg) => {
        if (onProgress) onProgress({ stage: 'pulling', project, message: msg });
      });
      const item = {
        id: project.id,
        name: project.name,
        status: r.status, // 'success' | 'no_change'
        commitsCount: r.commitsCount || 0,
        commits: r.commits || [],
      };
      results.push(item);
      if (onProgress) onProgress({ stage: 'pulled', project, result: item });
    } catch (err) {
      const item = {
        id: project.id,
        name: project.name,
        status: 'failed',
        error: err.message,
        commitsCount: 0,
        commits: [],
      };
      results.push(item);
      if (onProgress) onProgress({ stage: 'pull-failed', project, error: err.message });
    }
  }
  return results;
}

function validateRemoteUrl(githubUrl) {
  const urlPattern = /^https?:\/\/(?:github\.com|gitee\.com)\/[\w.-]+\/[\w.-]+(\.git)?$/;
  const sshPattern = /^git@(?:github\.com|gitee\.com):[\w.-]+\/[\w.-]+(\.git)?$/;
  if (!urlPattern.test(githubUrl) && !sshPattern.test(githubUrl)) {
    throw new Error('无效的仓库地址，仅支持 GitHub 和 Gitee');
  }
}

function assertPathUnderRepoBase(projectPath) {
  const resolved = path.resolve(projectPath);
  const basePath = getConfig('repo_base_path');
  if (!basePath) throw new Error('repo_base_path not configured');
  const baseResolved = path.resolve(basePath);
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const target = norm(resolved);
  const base = norm(baseResolved);
  if (target === base || !target.startsWith(base + path.sep)) {
    throw new Error('Project path is outside configured repo base path');
  }
  const relative = path.relative(baseResolved, resolved);
  if (!relative || relative === '.' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Cannot operate on repo base path');
  }
  return resolved;
}

function readReadmeInfo(dirPath) {
  let autoDescription = '';
  let readmeContent = '';
  const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README'];
  for (const f of readmeFiles) {
    const readmePath = path.join(dirPath, f);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      readmeContent = content;
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
  return { autoDescription, readmeContent };
}

const activeClones = new Map();

function parseRepoNameFromUrl(url) {
  validateRemoteUrl(url);
  return url.split('/').pop().replace(/\.git$/, '');
}

function killProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec(`taskkill /pid ${child.pid} /T /F`, () => {});
    return;
  }
  child.kill('SIGKILL');
}

function cleanupCloneDirectory(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return false;
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function cancelActiveClone(repoName) {
  const basePath = getConfig('repo_base_path');
  if (!basePath) throw new Error('repo_base_path not configured');
  const targetPath = path.join(path.resolve(basePath), repoName);
  assertPathUnderRepoBase(targetPath);

  const entry = activeClones.get(repoName);
  if (entry) {
    killProcessTree(entry.child);
    const err = Object.assign(new Error('克隆已终止'), { code: 'CLONE_CANCELLED' });
    entry.reject(err);
    activeClones.delete(repoName);
  }

  const deletedFromDisk = cleanupCloneDirectory(targetPath);
  return { ok: true, repoName, deletedFromDisk, hadActiveProcess: !!entry };
}

async function runGitClone(remoteUrl, parentDir, dirName, onProgress) {
  const { exec } = require('child_process');
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      activeClones.delete(dirName);
      fn(value);
    };

    const child = exec(
      `git clone "${remoteUrl}" "${dirName}" --progress`,
      { cwd: parentDir },
      (err) => {
        if (err) {
          if (err.killed) {
            finish(reject, Object.assign(new Error('克隆已终止'), { code: 'CLONE_CANCELLED' }));
            return;
          }
          finish(reject, err);
          return;
        }
        finish(resolve);
      }
    );

    activeClones.set(dirName, {
      child,
      targetPath: path.join(parentDir, dirName),
      reject: (err) => finish(reject, err),
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      const filtered = text.split('\n').filter(l => {
        const t = l.trim();
        return t && !t.startsWith('warning:') && !t.startsWith("'");
      }).join('\n');
      if (onProgress && filtered.trim()) onProgress(filtered);
    });
    child.stdout.on('data', (data) => {
      const text = data.toString();
      if (onProgress && text.trim()) onProgress(text);
    });
  });
}

async function collectGitMeta(dirPath, fallbackRemoteUrl) {
  const targetGit = simpleGit(dirPath);
  const remotes = await targetGit.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');
  const remoteUrl = origin ? origin.refs.fetch : fallbackRemoteUrl;

  let defaultBranch = 'main';
  try {
    const branchSummary = await targetGit.branch();
    defaultBranch = branchSummary.current;
  } catch {}

  const log = await targetGit.log({ maxCount: 1 });
  const lastCommit = log.latest;

  return { remoteUrl, defaultBranch, lastCommit };
}

async function cloneRepo(githubUrl, onProgress) {
  validateRemoteUrl(githubUrl);

  const repoName = parseRepoNameFromUrl(githubUrl);

  const basePath = getConfig('repo_base_path');
  if (!basePath) throw new Error('repo_base_path not configured');

  const targetPath = path.join(basePath, repoName);
  if (fs.existsSync(targetPath)) {
    throw new Error(`Directory already exists: ${repoName}`);
  }

  try {
    await runGitClone(githubUrl, basePath, repoName, onProgress);
  } catch (err) {
    if (err.code !== 'CLONE_CANCELLED') {
      cleanupCloneDirectory(targetPath);
    }
    throw err;
  }

  let { autoDescription, readmeContent } = readReadmeInfo(targetPath);
  if (autoDescription) {
    autoDescription = await translateEnToZh(autoDescription);
  }

  const { remoteUrl, defaultBranch, lastCommit } = await collectGitMeta(targetPath, githubUrl);
  const normalizedPath = path.normalize(targetPath);

  const existing = db.prepare('SELECT id FROM projects WHERE path = ?').get(normalizedPath);
  if (existing) {
    db.prepare(`
      UPDATE projects SET remote_url = ?, default_branch = ?, auto_description = ?, readme_content = ?,
        last_commit_hash = ?, last_commit_date = ?, last_commit_msg = ?
      WHERE id = ?
    `).run(
      remoteUrl, defaultBranch, autoDescription, readmeContent,
      lastCommit?.hash || null, lastCommit?.date || null, lastCommit?.message || null,
      existing.id
    );
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(existing.id);
  }

  const result = db.prepare(`
    INSERT INTO projects (name, path, remote_url, default_branch, auto_description, readme_content, last_commit_hash, last_commit_date, last_commit_msg, ai_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '')
  `).run(
    repoName, normalizedPath, remoteUrl, defaultBranch, autoDescription, readmeContent,
    lastCommit?.hash || null, lastCommit?.date || null, lastCommit?.message || null
  );

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
}

async function recloneRepo(projectId, onProgress) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.remote_url) throw new Error('项目没有远程地址，无法重新克隆');

  validateRemoteUrl(project.remote_url);

  const folderPath = assertPathUnderRepoBase(project.path);
  const parentDir = path.dirname(folderPath);
  const dirName = path.basename(folderPath);

  if (onProgress) onProgress('正在删除本地目录...');
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }

  if (onProgress) onProgress(`正在从 ${project.remote_url} 重新克隆...`);
  await runGitClone(project.remote_url, parentDir, dirName, onProgress);

  let { autoDescription, readmeContent } = readReadmeInfo(folderPath);
  if (autoDescription) {
    autoDescription = await translateEnToZh(autoDescription);
  }

  const { remoteUrl, defaultBranch, lastCommit } = await collectGitMeta(folderPath, project.remote_url);

  db.prepare(`
    UPDATE projects SET
      remote_url = ?, default_branch = ?, auto_description = ?, readme_content = ?,
      last_commit_hash = ?, last_commit_date = ?, last_commit_msg = ?,
      has_updates = 0, last_pull_at = datetime('now', 'localtime'),
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    remoteUrl, defaultBranch, autoDescription, readmeContent,
    lastCommit?.hash || null, lastCommit?.date || null, lastCommit?.message || null,
    projectId
  );

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

module.exports = { pullRepo, pullAllProjects, cloneRepo, recloneRepo, cancelActiveClone, parseRepoNameFromUrl };
