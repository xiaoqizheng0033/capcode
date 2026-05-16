const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const fs = require('fs');
const db = require('../db');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  },
});
const upload = multer({ storage: uploadStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const { chatCompletion } = require('../services/ai-service');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'target', '.idea', '.vscode',
  'coverage', 'out', 'vendor', 'bower_components',
]);

const SRC_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.rb', '.swift',
  '.vue', '.svelte', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.sql', '.sh', '.php', '.dart', '.lua', '.zig',
  '.html', '.svg', '.txt', '.env',
]);

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || name.startsWith('.');
}

// GET /api/projects/:projectId/file-tree
router.get('/:projectId/file-tree', (req, res) => {
  try {
    const project = db.prepare('SELECT path, name FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    function walk(dir, maxDepth = 10) {
      if (maxDepth <= 0) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const children = [];
      for (const e of entries) {
        if (e.isDirectory()) {
          if (shouldSkipDir(e.name)) continue;
          const sub = walk(path.join(dir, e.name), maxDepth - 1);
          if (sub.length > 0) children.push({ name: e.name, type: 'dir', children: sub });
        } else {
          const ext = path.extname(e.name).toLowerCase();
          if (!SRC_EXTENSIONS.has(ext)) continue;
          const fullPath = path.join(dir, e.name);
          const rel = path.relative(project.path, fullPath).replace(/\\/g, '/');
          let lines = 0;
          try { lines = fs.readFileSync(fullPath, 'utf-8').split('\n').length; } catch {}
          children.push({ name: e.name, type: 'file', path: rel, lines });
        }
      }
      return children;
    }

    const tree = walk(project.path);
    res.json({ root: project.path, tree, name: project.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/file?path=src/App.jsx
router.get('/:projectId/file', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fullPath = path.resolve(project.path, filePath);
    if (!fullPath.startsWith(path.resolve(project.path)))
      return res.status(403).json({ error: 'Access denied' });

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    res.json({ path: filePath, content, lines: lines.length });
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// GET /api/projects/:projectId/translate-file?path=xxx
router.get('/:projectId/translate-file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fullPath = path.resolve(project.path, filePath);
    if (!fullPath.startsWith(path.resolve(project.path))) return res.status(403).json({ error: 'Access denied' });

    const content = fs.readFileSync(fullPath, 'utf-8');
    // Split into chunks (每段 2000 字符，保留段落边界)
    const chunks = [];
    let remaining = content;
    while (remaining.length > 0) {
      if (remaining.length <= 2000) { chunks.push(remaining); break }
      let cut = 2000
      // Try to cut at newline
      const nl = remaining.lastIndexOf('\n', 2000)
      if (nl > 1000) cut = nl
      chunks.push(remaining.substring(0, cut))
      remaining = remaining.substring(cut)
    }

    const { chatCompletion } = require('../services/ai-service');
    // Translate first chunk only (rest on demand if needed)
    const prompt = `请将以下英文代码和注释翻译成中文。保留代码不变，只翻译注释和文档字符串。输出双语对照格式：原文一行，译文一行（以"// 译："开头）。

${chunks[0]}

重要：代码关键字不翻译，只翻译注释和说明文字。`

    const translated = await chatCompletion([{ role: 'user', content: prompt }]);

    // Extract vocabulary: ask AI to list 3-5 technical English words
    const vocabPrompt = `从以下代码注释中提取 3-5 个技术英语词汇，返回 JSON 数组：[{"word":"middleware","meaning":"中间件","context":"...项目中的例句..."}]

代码：${chunks[0].substring(0, 1500)}`;

    let vocab = [];
    try {
      const vocabContent = await chatCompletion([{ role: 'user', content: vocabPrompt }]);
      let v = vocabContent.trim();
      if (v.startsWith('```')) v = v.replace(/```json?\s*/g, '').replace(/```\s*$/g, '');
      vocab = JSON.parse(v);
      if (!Array.isArray(vocab)) vocab = [];
    } catch {}

    res.json({ path: filePath, translated, vocab, totalLines: content.split('\n').length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/analyze-file?path=xxx
router.get('/:projectId/analyze-file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fullPath = path.resolve(project.path, filePath);
    if (!fullPath.startsWith(path.resolve(project.path)))
      return res.status(403).json({ error: 'Access denied' });

    const content = fs.readFileSync(fullPath, 'utf-8');
    // Truncate if too long
    const code = content.length > 6000 ? content.substring(0, 6000) + '\n...(truncated)' : content;

    const prompt = `你是一位编程导师。请分析以下文件。项目：${project.name}，文件：${filePath}

\`\`\`
${code}
\`\`\`

请用 Markdown 格式输出分析，包含以下内容：
1. **文件概述**：这个文件是干什么的（2-3句）
2. **核心逻辑**：主要的函数/类和它们的作用
3. **关键代码段**：指出 2-3 处值得学习的写法或设计
4. **涉及概念**：这个文件涉及哪些编程概念
5. **学习建议**：如果是新手，应该关注哪些部分

用中文，简洁清晰。`;

    const analysis = await chatCompletion([{ role: 'user', content: prompt }]);
    res.json({ path: filePath, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/learn-chat
router.post('/:projectId/learn-chat', async (req, res) => {
  try {
    const { messages, fileContext, filePath } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

    const project = db.prepare('SELECT name, path FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Build system prompt with file context
    let systemMsg = `你是一位编程导师，正在帮助用户学习项目"${project.name}"。`;
    if (fileContext) {
      systemMsg += `\n\n当前用户正在查看文件 ${filePath || ''}：\n\`\`\`\n${fileContext.substring(0, 4000)}\n\`\`\``;
    }

    const content = await chatCompletion([
      { role: 'system', content: systemMsg },
      ...messages,
    ]);

    res.json({ reply: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/notes
router.post('/:projectId/notes', (req, res) => {
  try {
    const { title, content, filePath, tags } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    const noteTags = tags || [];
    const result = db.prepare(
      'INSERT INTO learn_notes (project_id, type, title, content, file_path, tags) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.params.projectId, 'note', title, content, filePath || '', JSON.stringify(noteTags));

    const note = db.prepare('SELECT * FROM learn_notes WHERE id = ?').get(result.lastInsertRowid);
    let pt = [];
    try { pt = JSON.parse(note.tags || '[]'); } catch {}
    res.json({ ...note, tags: pt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/notes
router.get('/:projectId/notes', (req, res) => {
  try {
    const tag = req.query.tag || '';
    let notes;
    if (tag) {
      notes = db.prepare(
        "SELECT * FROM learn_notes WHERE project_id = ? AND type = 'note' AND tags LIKE ? ORDER BY updated_at DESC"
      ).all(req.params.projectId, `%${tag}%`);
    } else {
      notes = db.prepare(
        "SELECT * FROM learn_notes WHERE project_id = ? AND type = 'note' ORDER BY updated_at DESC"
      ).all(req.params.projectId);
    }
    res.json(notes.map(n => {
      let tags = [];
      try { tags = JSON.parse(n.tags || '[]'); } catch {}
      return { ...n, tags };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId/notes/:noteId
router.delete('/:projectId/notes/:noteId', (req, res) => {
  try {
    db.prepare('DELETE FROM learn_notes WHERE id = ? AND project_id = ?')
      .run(req.params.noteId, req.params.projectId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Cards =====

// GET /api/projects/:projectId/cards
router.get('/:projectId/cards', (req, res) => {
  try {
    const tag = req.query.tag || '';
    let cards;
    if (tag) {
      cards = db.prepare(
        "SELECT * FROM learn_notes WHERE project_id = ? AND type = 'card' AND tags LIKE ? ORDER BY updated_at DESC"
      ).all(req.params.projectId, `%${tag}%`);
    } else {
      cards = db.prepare(
        "SELECT * FROM learn_notes WHERE project_id = ? AND type = 'card' ORDER BY updated_at DESC"
      ).all(req.params.projectId);
    }
    // Parse tags and content JSON for each card
    res.json(cards.map(c => {
      let tags = [];
      let content = c.content;
      try { tags = JSON.parse(c.tags || '[]'); } catch {}
      try { content = JSON.parse(c.content); } catch {}
      return { ...c, tags, content };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:projectId/cards — create card (or AI generate from chat reply)
router.post('/:projectId/cards', async (req, res) => {
  try {
    const { title, front, back, tags, chatReply, filePath, extractOnly } = req.body;
    let cardTitle = title, cardFront = front, cardBack = back;

    // If chatReply provided, use AI to extract a card
    if (chatReply && !cardTitle && !cardFront) {
      const prompt = `从以下内容提炼一张学习记忆卡片。返回纯JSON：{"title":"概念名称（10字内）","front":"概念解释+项目中的例子","back":"大白话比喻"}\n\n内容：${chatReply.substring(0, 3000)}`;
      const { chatCompletion } = require('../services/ai-service');
      const content = await chatCompletion([{ role: 'user', content: prompt }]);
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*$/g, '');
      try {
        const extracted = JSON.parse(jsonStr);
        cardTitle = extracted.title || '';
        cardFront = extracted.front || '';
        cardBack = extracted.back || '';
      } catch {}
      // Only extract, don't save — return extraction result directly
      if (extractOnly) {
        return res.json({ title: cardTitle, front: cardFront, back: cardBack, tags: tags || [] });
      }
    }

    if (!cardTitle || !cardFront) return res.status(400).json({ error: 'title and front are required' });

    const result = db.prepare(
      'INSERT INTO learn_notes (project_id, type, title, content, tags, file_path) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.params.projectId, 'card', cardTitle,
      JSON.stringify({ front: cardFront, back: cardBack || '' }),
      JSON.stringify(tags || []), filePath || '');

    const card = db.prepare('SELECT * FROM learn_notes WHERE id = ?').get(result.lastInsertRowid);
    let parsedTags = [];
    try { parsedTags = JSON.parse(card.tags || '[]'); } catch {}
    res.json({ ...card, tags: parsedTags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/projects/:projectId/cards/:id — update card
router.put('/:projectId/cards/:id', (req, res) => {
  try {
    const { title, front, back, tags } = req.body;
    const existing = db.prepare("SELECT * FROM learn_notes WHERE id = ? AND project_id = ? AND type = 'card'")
      .get(req.params.id, req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Card not found' });

    const ct = JSON.parse(existing.content);
    const newContent = JSON.stringify({ front: front || ct.front, back: back || ct.back });
    const newTags = tags !== undefined ? JSON.stringify(tags) : existing.tags;

    db.prepare(
      "UPDATE learn_notes SET title = ?, content = ?, tags = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(title || existing.title, newContent, newTags, req.params.id);

    const updated = db.prepare('SELECT * FROM learn_notes WHERE id = ?').get(req.params.id);
    let parsedTags = [];
    try { parsedTags = JSON.parse(updated.tags || '[]'); } catch {}
    res.json({ ...updated, tags: parsedTags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:projectId/cards/:id
router.delete('/:projectId/cards/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM learn_notes WHERE id = ? AND project_id = ? AND type = 'card'")
      .run(req.params.id, req.params.projectId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/projects/:projectId/cards/:id/review — SM-2 review update
router.put('/:projectId/cards/:id/review', (req, res) => {
  try {
    const { quality } = req.body; // 0=forgot, 1=hard, 2=good, 3=easy
    const card = db.prepare("SELECT * FROM learn_notes WHERE id = ? AND project_id = ? AND type = 'card'")
      .get(req.params.id, req.params.projectId);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const q = parseInt(quality) || 2;
    let easiness = parseFloat(card.easiness) || 2.5;
    let interval = parseInt(card.interval_days) || 0;
    let reps = 0; // We use interval > 0 as proxy for reps

    if (q < 2) {
      // Forgot or hard: reset interval
      interval = 1;
      reps = 0;
    } else {
      // Good or Easy
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 3;
      else interval = Math.round(interval * easiness);

      if (q === 3) interval = Math.round(interval * 1.2); // Easy bonus
    }

    // Update easiness
    const delta = { 0: -0.30, 1: -0.15, 2: 0, 3: 0.15 }[q] || 0;
    easiness = Math.max(1.3, easiness + delta);

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    const nextReview = nextDate.toISOString().slice(0, 10);

    db.prepare(
      "UPDATE learn_notes SET easiness = ?, interval_days = ?, next_review = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(easiness, interval, nextReview, req.params.id);

    res.json({ easiness, interval_days: interval, next_review: nextReview });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Notes (extended) =====

// PUT /api/projects/:projectId/notes/:id — update note
router.put('/:projectId/notes/:id', (req, res) => {
  try {
    const { title, content, filePath, tags } = req.body;
    const existing = db.prepare("SELECT * FROM learn_notes WHERE id = ? AND project_id = ? AND type = 'note'")
      .get(req.params.id, req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    db.prepare(
      "UPDATE learn_notes SET title = ?, content = ?, file_path = ?, tags = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(title || existing.title, content || existing.content, filePath !== undefined ? filePath : existing.file_path,
      tags !== undefined ? JSON.stringify(tags) : existing.tags, req.params.id);

    const updated = db.prepare('SELECT * FROM learn_notes WHERE id = ?').get(req.params.id);
    let parsedTags = [];
    try { parsedTags = JSON.parse(updated.tags || '[]'); } catch {}
    res.json({ ...updated, tags: parsedTags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Tags (aggregated from learn_notes) =====

// GET /api/projects/:projectId/learn-tags
router.get('/:projectId/learn-tags', (req, res) => {
  try {
    const items = db.prepare(
      "SELECT tags FROM learn_notes WHERE project_id = ? AND tags != '[]' AND tags != ''"
    ).all(req.params.projectId);
    const tagSet = new Set();
    const tagCounts = {};
    for (const item of items) {
      try {
        const arr = JSON.parse(item.tags);
        arr.forEach(t => { if (t) { tagSet.add(t); tagCounts[t] = (tagCounts[t] || 0) + 1; } });
      } catch {}
    }
    res.json(Array.from(tagSet).sort().map(name => ({ name, count: tagCounts[name] || 0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Chat History =====

// GET /api/projects/:projectId/chat-history
router.get('/:projectId/chat-history', (req, res) => {
  try {
    const list = db.prepare(
      'SELECT id, project_id, title, file_path, created_at, updated_at FROM chat_history WHERE project_id = ? ORDER BY updated_at DESC'
    ).all(req.params.projectId);
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:projectId/chat-history/:id
router.get('/:projectId/chat-history/:id', (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM chat_history WHERE id = ? AND project_id = ?')
      .get(req.params.id, req.params.projectId);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json({ ...record, messages: JSON.parse(record.messages) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:projectId/chat-history — save/update
router.post('/:projectId/chat-history', (req, res) => {
  try {
    const { id, title, filePath, messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages is required' });
    if (id) {
      db.prepare('UPDATE chat_history SET title = ?, file_path = ?, messages = ?, updated_at = datetime("now","localtime") WHERE id = ? AND project_id = ?')
        .run(title || '', filePath || '', JSON.stringify(messages), id, req.params.projectId);
      const updated = db.prepare('SELECT * FROM chat_history WHERE id = ?').get(id);
      return res.json({ ...updated, messages: JSON.parse(updated.messages) });
    }
    const result = db.prepare('INSERT INTO chat_history (project_id, title, file_path, messages) VALUES (?, ?, ?, ?)')
      .run(req.params.projectId, title || '', filePath || '', JSON.stringify(messages));
    const created = db.prepare('SELECT * FROM chat_history WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...created, messages: JSON.parse(created.messages) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:projectId/chat-history/:id
router.delete('/:projectId/chat-history/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM chat_history WHERE id = ? AND project_id = ?')
      .run(req.params.id, req.params.projectId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:projectId/prompt-outline — parse study guide into outline for prompt assembly
router.get('/:projectId/prompt-outline', (req, res) => {
  try {
    const cached = db.prepare("SELECT * FROM call_chains WHERE project_id = ? AND query = '__study_guide__' ORDER BY created_at DESC LIMIT 1")
      .get(req.params.projectId);
    if (!cached) return res.json({ outline: [], cached: false });

    const guide = JSON.parse(cached.result);
    const md = guide.overview || '';

    // Parse sections: ## Title, ### Subtitle, content blocks
    const sections = md.split('\n## ');
    const outline = [];
    let currentSection = null;

    for (const sec of sections) {
      if (!sec.trim()) continue;
      const lines = sec.split('\n');
      const title = lines[0].replace(/^##\s*/, '').replace(/#/g, '').trim();
      if (!title) continue;

      // Classify section
      let category = 'other';
      const tl = title.toLowerCase();
      if (tl.includes('概览') || tl.includes('关键词')) category = 'overview';
      else if (tl.includes('模块') || tl.includes('拆解')) category = 'modules';
      else if (tl.includes('流程') || tl.includes('步骤')) category = 'flow';
      else if (tl.includes('复刻') || tl.includes('定位') || tl.includes('技术选型') || tl.includes('约束') || tl.includes('踩坑')) category = 'replicate';

      // Extract sub-items from ### headers or bullet points
      const items = [];
      const contentLines = lines.slice(1);
      for (const line of contentLines) {
        const subMatch = line.match(/^###\s+(.+)/);
        if (subMatch) {
          items.push({ id: outline.length + '-' + items.length, text: subMatch[1].trim(), selected: true, type: 'heading' });
        }
        const bulletMatch = line.match(/^[-*]\s+\*\*(.+?)\*\*[:：]?\s*(.*)/) || line.match(/^[-*]\s+(.+)/);
        if (bulletMatch && !items.find(i => i.text === bulletMatch[0])) {
          const t = bulletMatch[1] + (bulletMatch[2] ? ': ' + bulletMatch[2] : '');
          items.push({ id: outline.length + '-' + items.length, text: t.substring(0, 100).trim(), selected: true, type: 'bullet' });
        }
      }

      outline.push({
        id: String(outline.length),
        title,
        category,
        selected: true,
        items: items.length > 0 ? items : undefined,
      });
    }

    res.json({ outline, cached: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:projectId/assemble-prompt — AI expands selected outline items into precise prompts
router.post('/:projectId/assemble-prompt', async (req, res) => {
  try {
    const { categories, items } = req.body;
    if (!categories || items == null) return res.status(400).json({ error: 'categories is required' });

    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { chatCompletion } = require('../services/ai-service');

    const prompt = `你是一位资深软件架构师，擅长将项目描述转化为精确的 AI 编程指令。

以下是从项目"${project.name}"中提取的大纲条目：

${categories}

请将每个条目展开为一段**精确的、可直接喂给 AI 执行的提示词指令**。要求：

1. **功能级**：描述具体的界面布局、交互细节、数据流，像给程序员下达开发任务一样精确
2. **架构级**：说明技术栈、模块划分、通信方式、数据存储，像架构文档一样清晰
3. **约束级**：列出关键限制、易踩坑点、平台差异，像代码审查一样细致

输出格式：每个条目生成一段提示词，用 ### 标题分隔。示例：

### 主页侧边栏
创建一个 React Dashboard 页面，左侧固定侧边栏约 200px 宽，显示所有项目标签和对应数量。点击标签筛选右侧项目卡片网格（3列响应式布局）。侧边栏默认展开，通过 PanelLeftClose 图标按钮切换折叠。侧边栏与主内容区背景色统一（bg-gray-50），紧密贴合无间隙。

总共 ${items} 个条目，所有条目都要生成。用中文输出。`;

    const content = await chatCompletion([{ role: 'user', content: prompt }]);
    const resultPrompt = content.trim() || '生成失败';

    // Auto-save to history
    db.prepare('INSERT INTO prompt_history (project_id, categories, items_count, prompt) VALUES (?, ?, ?, ?)')
      .run(req.params.projectId, categories, items, resultPrompt);

    res.json({ prompt: resultPrompt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:projectId/prompt-history?starred=1&tag=xxx&all=1&project=id
router.get('/:projectId/prompt-history', (req, res) => {
  try {
    const starred = req.query.starred === '1';
    const tag = req.query.tag || '';
    const allProjects = req.query.all === '1';
    const filterProject = req.query.project || '';

    let sql = 'SELECT ph.id, ph.title, ph.tags, ph.starred, ph.images, ph.categories, ph.items_count, ph.prompt, ph.created_at, ph.updated_at, ph.project_id, p.name as project_name FROM prompt_history ph JOIN projects p ON ph.project_id = p.id WHERE 1=1';
    const params = [];

    if (!allProjects && !filterProject) {
      sql += ' AND ph.project_id = ?';
      params.push(req.params.projectId);
    } else if (filterProject) {
      sql += ' AND ph.project_id = ?';
      params.push(filterProject);
    }

    if (starred) { sql += ' AND ph.starred = 1'; }
    if (tag) { sql += " AND ph.tags LIKE ?"; params.push('%' + tag + '%'); }
    sql += ' ORDER BY ph.starred DESC, ph.updated_at DESC LIMIT 50';
    const list = db.prepare(sql).all(...params);
    res.json(list.map(h => {
      let t = [], imgs = [];
      try { t = JSON.parse(h.tags || '[]'); } catch {}
      try { if (h.images) imgs = JSON.parse(h.images); } catch {}
      return { ...h, tags: t, images: imgs };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:projectId/prompt-history/:id/upload — upload image for prompt
router.post('/:projectId/prompt-history/:id/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file' });
    const url = '/uploads/' + req.file.filename;

    const existing = db.prepare('SELECT images FROM prompt_history WHERE id = ? AND project_id = ?')
      .get(req.params.id, req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    let images = [];
    try { images = JSON.parse(existing.images || '[]'); } catch {}
    images.push(url);

    db.prepare("UPDATE prompt_history SET images = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(JSON.stringify(images), req.params.id);

    res.json({ url, images });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/projects/:projectId/prompt-history/:id — edit title/tags/starred/prompt/images
router.put('/:projectId/prompt-history/:id', (req, res) => {
  try {
    const { title, tags, starred, prompt } = req.body;
    const existing = db.prepare('SELECT * FROM prompt_history WHERE id = ? AND project_id = ?').get(req.params.id, req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    db.prepare("UPDATE prompt_history SET title = ?, tags = ?, starred = ?, prompt = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(title !== undefined ? title : existing.title,
        tags !== undefined ? JSON.stringify(tags) : existing.tags,
        starred !== undefined ? (starred ? 1 : 0) : existing.starred,
        prompt !== undefined ? prompt : existing.prompt,
        req.params.id);

    const updated = db.prepare('SELECT * FROM prompt_history WHERE id = ?').get(req.params.id);
    let t = [];
    try { t = JSON.parse(updated.tags || '[]'); } catch {}
    res.json({ ...updated, tags: t });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:projectId/prompt-history/:id
router.delete('/:projectId/prompt-history/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM prompt_history WHERE id = ? AND project_id = ?').run(req.params.id, req.params.projectId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
