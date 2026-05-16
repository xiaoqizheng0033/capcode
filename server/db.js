const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js').default || require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'data', 'repo-manager.db');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  remote_url TEXT,
  default_branch TEXT DEFAULT 'main',
  description TEXT DEFAULT '',
  auto_description TEXT DEFAULT '',
  readme_content TEXT DEFAULT '',
  ai_summary TEXT DEFAULT '',
  category TEXT DEFAULT '',
  last_commit_hash TEXT,
  last_commit_date TEXT,
  last_commit_msg TEXT,
  has_updates INTEGER DEFAULT 0,
  last_pull_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS update_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  pull_time TEXT DEFAULT (datetime('now', 'localtime')),
  commits_count INTEGER DEFAULT 0,
  commit_log TEXT DEFAULT '[]',
  status TEXT DEFAULT 'no_change',
  error_msg TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  starred INTEGER DEFAULT 0,
  categories TEXT NOT NULL DEFAULT '',
  items_count INTEGER DEFAULT 0,
  prompt TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learn_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT DEFAULT 'note',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  file_path TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`;

const DEFAULT_CONFIG = {
  scan_interval_hours: '6',
  repo_base_path: 'C:\\Myfiles\\Codes\\repos',
  ai_api_key: '',
  ai_api_url: 'https://api.deepseek.com/v1/chat/completions',
  github_token: '',
  tag_set: '[]',
};

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let _db = null;
let _dbReady = false;
let _dbInitError = null;

// ---------------------------------------------------------------------------
// Write modified database to disk
// ---------------------------------------------------------------------------
function _save() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = _db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

// ---------------------------------------------------------------------------
// Kick off async initialisation immediately at module load time
// ---------------------------------------------------------------------------

// Keep a reference to the promise so it is not garbage-collected
const _initPromise = (async () => {
  try {
    const SQLModule = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      _db = new SQLModule.Database(fileBuffer);
    } else {
      _db = new SQLModule.Database();
    }

    // Enable WAL mode and foreign keys
    _db.run('PRAGMA journal_mode=WAL');
    _db.run('PRAGMA foreign_keys=ON');

    // Create tables
    _db.run(SCHEMA_SQL);

    // Migration: add readme_content column if not exists
    try {
      _db.run("ALTER TABLE projects ADD COLUMN readme_content TEXT DEFAULT ''");
    } catch (e) {}
    // Migration: add ai_summary and category columns if not exist
    try {
      _db.run("ALTER TABLE projects ADD COLUMN ai_summary TEXT DEFAULT ''");
    } catch (e) {}
    try {
      _db.run("ALTER TABLE projects ADD COLUMN category TEXT DEFAULT ''");
    } catch (e) {}
    // Migration: add release_info column to update_logs
    try {
      _db.run("ALTER TABLE update_logs ADD COLUMN release_info TEXT DEFAULT '[]'");
    } catch (e) {}
    // Migration: add tags column (multi-label, JSON array)
    try {
      _db.run("ALTER TABLE projects ADD COLUMN tags TEXT DEFAULT '[]'");
    } catch (e) {}
    // Migration: add type, tags, updated_at to learn_notes
    try { _db.run("ALTER TABLE learn_notes ADD COLUMN type TEXT DEFAULT 'note'"); } catch (e) {}
    try { _db.run("ALTER TABLE learn_notes ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
    try { _db.run("ALTER TABLE learn_notes ADD COLUMN updated_at TEXT DEFAULT (datetime('now', 'localtime'))"); } catch (e) {}
    // Migration: add SM-2 review fields to learn_notes
    try { _db.run("ALTER TABLE learn_notes ADD COLUMN easiness REAL DEFAULT 2.5"); } catch (e) {}
    try { _db.run("ALTER TABLE learn_notes ADD COLUMN interval_days INTEGER DEFAULT 0"); } catch (e) {}
    try { _db.run("ALTER TABLE learn_notes ADD COLUMN next_review TEXT DEFAULT (date('now','localtime'))"); } catch (e) {}
    // Migration: prompt_history table + new columns
    try { _db.run("CREATE TABLE IF NOT EXISTS prompt_history (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, title TEXT DEFAULT '', tags TEXT DEFAULT '[]', starred INTEGER DEFAULT 0, categories TEXT DEFAULT '', items_count INTEGER DEFAULT 0, prompt TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now', 'localtime')), updated_at TEXT DEFAULT (datetime('now', 'localtime')), FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE)"); } catch (e) {}
    try { _db.run("ALTER TABLE prompt_history ADD COLUMN title TEXT DEFAULT ''"); } catch (e) {}
    try { _db.run("ALTER TABLE prompt_history ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
    try { _db.run("ALTER TABLE prompt_history ADD COLUMN starred INTEGER DEFAULT 0"); } catch (e) {}
    try { _db.run("ALTER TABLE prompt_history ADD COLUMN updated_at TEXT DEFAULT NULL"); } catch (e) {}
    try { _db.run("ALTER TABLE prompt_history ADD COLUMN images TEXT DEFAULT '[]'"); } catch (e) {}
    // Normalize NULL ai_summary to empty string
    _db.run("UPDATE projects SET ai_summary = '' WHERE ai_summary IS NULL");

    // Insert default config values
    const cntResult = _db.exec('SELECT COUNT(*) AS cnt FROM config');
    const rowCount = cntResult.length > 0 ? cntResult[0].values[0][0] : 0;
    if (rowCount === 0) {
      for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
        _db.run('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)', [key, value]);
      }
    }

    _save();
    _dbReady = true;
  } catch (err) {
    _dbInitError = err;
    _dbReady = true;
    console.error('Database initialisation failed:', err);
  }
})();

// ---------------------------------------------------------------------------
// Ensure database is initialised before any operation
// ---------------------------------------------------------------------------
function _ensureReady() {
  if (!_dbReady) {
    throw new Error('Database not yet initialised. Please await the db module.');
  }
  if (_dbInitError) {
    throw _dbInitError;
  }
}

// ---------------------------------------------------------------------------
// Helper: execute a SELECT query via prepare and return array of row objects
// ---------------------------------------------------------------------------
function _execSelect(sqlText, params) {
  const stmt = _db.prepare(sqlText);
  try {
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const rows = [];
    if (stmt.step()) {
      const columnNames = stmt.getColumnNames();
      do {
        const raw = stmt.get();
        const row = {};
        for (let i = 0; i < columnNames.length; i++) {
          row[columnNames[i]] = raw[i];
        }
        rows.push(row);
      } while (stmt.step());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

// ---------------------------------------------------------------------------
// Public API: exec(sql)
// ---------------------------------------------------------------------------
function exec(sql) {
  _ensureReady();
  try {
    return _db.exec(sql);
  } catch (err) {
    throw new Error(
      `SQL exec error: ${err.message}\n  SQL: ${sql.slice(0, 300)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Public API: prepare(sql) -> { run(), get(), all() }
// ---------------------------------------------------------------------------
function prepare(sql) {
  _ensureReady();

  return {
    run(...params) {
      _ensureReady();
      try {
        _db.run(sql, params);
        const changes = _db.getRowsModified();

        // Retrieve last inserted row id
        let lastInsertRowid = 0;
        const idStmt = _db.prepare('SELECT last_insert_rowid() AS id');
        try {
          if (idStmt.step()) {
            const obj = idStmt.getAsObject();
            lastInsertRowid = obj.id || 0;
          }
        } finally {
          idStmt.free();
        }

        _save();
        return { changes, lastInsertRowid };
      } catch (err) {
        throw new Error(
          `SQL run error: ${err.message}\n  SQL: ${sql.slice(0, 300)}`
        );
      }
    },

    get(...params) {
      _ensureReady();
      try {
        const rows = _execSelect(sql, params);
        return rows.length > 0 ? rows[0] : undefined;
      } catch (err) {
        throw new Error(
          `SQL get error: ${err.message}\n  SQL: ${sql.slice(0, 300)}`
        );
      }
    },

    all(...params) {
      _ensureReady();
      try {
        return _execSelect(sql, params);
      } catch (err) {
        throw new Error(
          `SQL all error: ${err.message}\n  SQL: ${sql.slice(0, 300)}`
        );
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: returns a promise that resolves once the DB is ready
// ---------------------------------------------------------------------------
function ready() {
  return _initPromise;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
module.exports = {
  exec,
  prepare,
  name: DB_PATH,
  ready,
};
