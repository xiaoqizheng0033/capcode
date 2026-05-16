const fs = require('fs');
const path = require('path');

const SRC_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.cc', '.h', '.hpp', '.rb', '.swift',
  '.vue', '.svelte', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.sql', '.sh', '.bat', '.ps1',
  '.php', '.dart', '.lua', '.zig', '.nim',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'target', '.idea', '.vscode',
  'coverage', '.nyc_output', 'out', 'vendor', 'bower_components',
  'egg-info', '.tox', '.mypy_cache', '.pytest_cache',
  'android', 'ios', '.expo', '.gradle',
]);

const MAX_FILES = 200;
const MAX_INDEX_CHARS = 8000;

const DEF_PATTERNS = [
  // Python
  { pattern: /^\s*(?:async\s+)?def\s+(\w+)\s*\(/, lang: 'py' },
  { pattern: /^\s*class\s+(\w+)\s*[:(]/, lang: 'py' },
  // JS/TS
  { pattern: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/, lang: 'js' },
  { pattern: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/, lang: 'js' },
  { pattern: /^\s*(?:export\s+)?class\s+(\w+)/, lang: 'js' },
  // Go
  { pattern: /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/, lang: 'go' },
  // Rust
  { pattern: /^\s*(?:pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/, lang: 'rs' },
  // Java/Kotlin
  { pattern: /^\s*(?:public|private|protected|static|\s)+\w+(?:\s*<[^>]*>)?\s+(\w+)\s*\(/, lang: 'java' },
  // C/C++
  { pattern: /^\s*(?:\w+(?:\s*\*)?\s+)+\s*(\w+)\s*\(/, lang: 'c' },
];

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || name.startsWith('.');
}

function readFileSafe(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 500 * 1024) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch { return null; }
}

function buildSourceIndex(projectPath) {
  const files = [];
  let totalDefs = 0;

  function walk(dir) {
    if (files.length >= MAX_FILES) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) walk(path.join(dir, entry.name));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SRC_EXTENSIONS.has(ext)) {
          const fullPath = path.join(dir, entry.name);
          const rel = path.relative(projectPath, fullPath).replace(/\\/g, '/');
          const content = readFileSafe(fullPath);
          if (!content) continue;
          const lines = content.split('\n');
          const defs = [];
          for (const { pattern, lang } of DEF_PATTERNS) {
            for (let i = 0; i < lines.length; i++) {
              const m = lines[i].match(pattern);
              if (m) { defs.push({ name: m[1], line: i + 1, lang }); totalDefs++; }
            }
          }
          if (defs.length > 0 || lines.length > 5) {
            files.push({ rel, lines: lines.length, defs });
          }
        }
      }
    }
  }

  walk(projectPath);
  files.sort((a, b) => b.defs.length - a.defs.length);
  return { files, totalDefs };
}

function formatIndexForAI(projectPath, projectName) {
  const { files, totalDefs } = buildSourceIndex(projectPath);
  let output = `项目: ${projectName}\n源码文件数: ${files.length}, 函数/类定义数: ${totalDefs}\n\n====== 关键文件索引 ======\n`;
  let chars = output.length;

  for (const f of files) {
    const defList = f.defs.slice(0, 30).map(d => `${d.name}:${d.line}`).join(', ');
    const extra = f.defs.length > 30 ? ` ...+${f.defs.length - 30}` : '';
    const entry = `  ${f.rel} (${f.lines}行) [${defList}${extra}]\n`;
    if (chars + entry.length > MAX_INDEX_CHARS) {
      output += `  ... 更多文件省略\n`;
      break;
    }
    output += entry;
    chars += entry.length;
  }
  return { text: output, stats: { fileCount: files.length, totalDefs } };
}

module.exports = { buildSourceIndex, formatIndexForAI };
