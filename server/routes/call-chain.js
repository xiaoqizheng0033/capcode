const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { formatIndexForAI } = require('../services/code-analyzer');
const { chatCompletion } = require('../services/ai-service');

// GET /api/projects/:projectId/call-chain-topics — AI pre-analyzes project and returns a list of traceable topics
router.get('/:projectId/call-chain-topics', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const cached = db.prepare(
      "SELECT * FROM call_chains WHERE project_id = ? AND query = '__topics__' ORDER BY created_at DESC LIMIT 1"
    ).get(projectId);
    if (cached) {
      return res.json({ topics: JSON.parse(cached.result), cached: true });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { text: indexText } = formatIndexForAI(project.path, project.name);

    const prompt = `你是一个代码分析专家。以下是项目"${project.name}"的源码结构索引：

${indexText}

请根据源码结构，列出这个项目中值得追踪的核心功能调用链话题（5-10个）。
每个话题是一句话描述，如"用户登录完整流程"、"点击克隆按钮后的处理"、"定时任务调度机制"。

请只返回 JSON 数组，不要其他内容：
["话题1", "话题2", "话题3"]`;

    const content = await chatCompletion([{ role: 'user', content: prompt }]);

    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*$/g, '');
    }

    let topics;
    try { topics = JSON.parse(jsonStr); if (!Array.isArray(topics)) topics = []; }
    catch { topics = []; }

    db.prepare('INSERT INTO call_chains (project_id, query, result) VALUES (?, ?, ?)')
      .run(projectId, '__topics__', JSON.stringify(topics));

    res.json({ topics, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/call-chain?q=xxx
router.get('/:projectId/call-chain', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const query = (req.query.q || '').trim();
    if (!query) return res.status(400).json({ error: 'q (query) is required' });

    const cached = db.prepare(
      'SELECT * FROM call_chains WHERE project_id = ? AND query = ? ORDER BY created_at DESC LIMIT 1'
    ).get(projectId, query);
    if (cached) {
      return res.json({ id: cached.id, project_id: cached.project_id, query: cached.query,
        chain: JSON.parse(cached.result), cached: true });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { text: indexText, stats } = formatIndexForAI(project.path, project.name);

    const prompt = `你是一个代码分析专家。以下是项目"${project.name}"的源码结构索引：

${indexText}

用户问题：请分析"${query}"的代码调用链，从用户操作到最终结果，列出完整的代码调用过程。

请以 JSON 数组格式返回调用链。每个节点包含：level（缩进层级，0=入口）、file（相对路径）、line（行号）、function（函数名）、description（中文简述，15字内）。

格式：[{"level":0,"file":"src/App.jsx","line":50,"function":"Button","description":"用户点击按钮"},...]
规则：level 从 0 开始；只返回 JSON 数组；5-15 个节点；无法确定行号填 0。`;

    const content = await chatCompletion([{ role: 'user', content: prompt }]);

    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*$/g, '');
    }

    let chain;
    try { chain = JSON.parse(jsonStr); }
    catch { chain = [{ level: 0, file: '', line: 0, function: '', description: content.substring(0, 200) }]; }
    if (!Array.isArray(chain)) chain = [{ level: 0, file: '', line: 0, function: '', description: 'AI 返回格式异常' }];

    const result = db.prepare('INSERT INTO call_chains (project_id, query, result) VALUES (?, ?, ?)')
      .run(projectId, query, JSON.stringify(chain));

    res.json({ id: result.lastInsertRowid, project_id: projectId, query, chain, cached: false, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/study-guide — generate learning guide (chunked per section)
// Accepts ?force=1 to bypass cache and regenerate
router.get('/:projectId/study-guide', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const force = req.query.force === '1';

    // Check cache (skip if force)
    if (!force) {
      const cached = db.prepare(
        "SELECT * FROM call_chains WHERE project_id = ? AND query = '__study_guide__' ORDER BY created_at DESC LIMIT 1"
      ).get(projectId);
      if (cached) {
        return res.json({ ...JSON.parse(cached.result), cached: true });
      }
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { text: indexText } = formatIndexForAI(project.path, project.name);
    const aiSummary = project.ai_summary || '';
    const baseCtx = `=== 项目源码索引 ===\n${indexText}\n${aiSummary ? '\n=== 已有AI摘要 ===\n' + aiSummary : ''}`;

    // Helper: generate one section
    async function genSection(title, instruction) {
      const p = `你是一位资深编程导师。以下是项目"${project.name}"的信息：

${baseCtx}

请只输出这一章节的内容：${title}

${instruction}

重要：用中文，内容详实具体。直接输出 Markdown，不要包裹在代码块或 JSON 中。`;
      const c = await chatCompletion([{ role: 'user', content: p }]);
      let md = c.trim();
      if (md.startsWith('```')) md = md.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```\s*$/, '');
      return md;
    }

    // Generate 4 sections in parallel
    const [overview, modules, flow, replicate] = await Promise.all([
      genSection('大白话概览', '用 3 句话解释：这是什么项目、能干什么、怎么跑起来。然后列出关键词速查表（术语 | 解释）。直接输出内容，不要写"## 大白话概览"这个标题。'),
      genSection('模块拆解', '每个核心模块用 ### 标题。包含：模块名和文件路径、干什么的、数据流向、涉及编程概念、关键代码行号。覆盖前后端核心模块（至少 4 个）。直接输出内容，不要写"## 模块拆解"这个标题。'),
      genSection('主线流程', '选最常见的一个用户操作，从触发到结束逐步跟踪代码。每步：文件路径:行号、做了什么、为什么这样写、涉及概念。至少 6 步。直接输出内容，不要写"## 主线流程"这个标题。'),
      genSection('复刻指令', '如果让 AI 复刻需告诉它什么：项目定位、技术选型与理由（表格）、核心功能精准 Prompt、关键约束和踩坑点。直接输出内容，不要写"## 复刻指令"这个标题。'),
    ]);

    // Generate cards separately
    const cardsContent = await genSection('复习卡片', '列出 8-12 个编程知识点卡片。用以下格式（卡片间 --- 分隔）：\n**概念名称**\n- 正面：概念解释 + 项目例子\n- 背面：大白话比喻\n直接输出卡片列表，不要写"## 复习卡片"标题。');

    // Parse cards
    let cards = [];
    const cardBlocks = cardsContent.split(/\n(?=\*\*)/g);
    for (const block of cardBlocks) {
      const titleMatch = block.match(/^\*\*(.+?)\*\*/);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      const lines = block.split('\n');
      let front = '', back = '';
      for (const line of lines) {
        const fl = line.replace(/^-\s*/, '').trim();
        if (fl.startsWith('正面')) front = fl.replace(/^正面[：:]\s*/, '').trim();
        if (fl.startsWith('背面')) back = fl.replace(/^背面[：:]\s*/, '').trim();
      }
      if (title) cards.push({ title, front: front || title, back: back || '' });
    }

    // Assemble full markdown
    const fullMarkdown = [
      '## 大白话概览', overview,
      '## 模块拆解', modules,
      '## 主线流程', flow,
      '## 复刻指令', replicate,
    ].join('\n\n');

    const guide = { overview: fullMarkdown, cards: JSON.stringify(cards) };

    // Clear old cache and store new
    db.prepare("DELETE FROM call_chains WHERE project_id = ? AND query = '__study_guide__'")
      .run(projectId);
    db.prepare('INSERT INTO call_chains (project_id, query, result) VALUES (?, ?, ?)')
      .run(projectId, '__study_guide__', JSON.stringify(guide));

    console.log('[study-guide] sections done, cards:', cards.length);
    res.json({ ...guide, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/outline — generate 6-dimension outline from project
// query: ?force=1 to regenerate
router.get('/:projectId/outline', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const force = req.query.force === '1';

    if (!force) {
      const cached = db.prepare(
        "SELECT * FROM call_chains WHERE project_id = ? AND query = '__outline__' ORDER BY created_at DESC LIMIT 1"
      ).get(projectId);
      if (cached) return res.json({ ...JSON.parse(cached.result), cached: true });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { text: indexText } = formatIndexForAI(project.path, project.name);
    const aiSummary = project.ai_summary || '';
    const baseCtx = '=== 项目源码索引 ===\n' + indexText + '\n' + (aiSummary ? '\n=== 已有AI摘要 ===\n' + aiSummary : '');

    const categories = [
      { key: 'functions', label: '功能大纲', desc: '用户视角下项目能做什么。先整体概括（1-3条大功能），再按整体条目细分具体子功能点（3-5条）。输出层级JSON：{"summary":[{"text":"整体条目","items":["子条目1","子条目2"]}]}' },
      { key: 'architecture', label: '架构大纲', desc: '技术栈选型、模块划分、数据流、通信方式。先整体架构（1-2条），再细分各层/各端。输出层级JSON：{"summary":[{"text":"整体架构描述","items":["前端技术栈","后端技术栈","通信方式"]}]}' },
      { key: 'modules', label: '组件/模块大纲', desc: '核心文件/模块路径、职责、对外接口。按层级分组（前端组件/后端路由/服务层等）。输出层级JSON：{"summary":[{"text":"模块分组","items":["模块:路径:职责"]}]}' },
      { key: 'ui', label: 'UI/交互大纲', desc: '按页面/视图整体划分（主页、详情页、设置页、学习工作室等），再细分每个页面的布局和交互元素。输出层级JSON：{"summary":[{"text":"页面整体描述","items":["布局元素1","交互细节2"]}]}' },
      { key: 'data', label: '数据大纲', desc: '数据库表结构、字段含义、关键查询。先概括数据整体设计（1条），再按表细分字段。输出层级JSON：{"summary":[{"text":"数据整体设计","items":["表名:字段1/字段2/...","表名:字段1/字段2/..."]}]}' },
      { key: 'constraints', label: '约束/边界大纲', desc: '平台限制、API限速、已知限制、容易踩坑的地方。按类型分组（平台限制/性能限制/安全约束等）。输出层级JSON：{"summary":[{"text":"约束类型","items":["具体约束1","具体约束2"]}]}' },
    ];

    async function genOutline(cat) {
      const p = '你是一位资深软件架构师。以下是项目"' + project.name + '"的信息：\n\n' + baseCtx + '\n\n请生成该项目的' + cat.label + '。' + cat.desc + '\n\n直接返回 JSON，格式：{"summary":[{"text":"整体描述","items":["细节1","细节2"]},...]}\n不要包含任何说明文字。';
      const c = await chatCompletion([{ role: 'user', content: p }]);
      let j = c.trim();
      if (j.startsWith('```')) j = j.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
      try { return JSON.parse(j); } catch { return { summary: [] }; }
    }

    const results = {};
    await Promise.all(categories.map(async (cat) => { results[cat.key] = await genOutline(cat); }));

    // Build two-level outline: summary items → sub-items
    const outline = categories.map(cat => {
      const data = results[cat.key] || { summary: [] };
      const summaries = data.summary || [];
      return {
        id: cat.key, title: cat.label, selected: false,
        items: summaries.map((s, i) => ({
          id: cat.key + '-' + i,
          text: s.text || '',
          selected: false, expanded: true,
          children: (s.items || []).map((child, j) => ({
            id: cat.key + '-' + i + '-' + j,
            text: typeof child === 'string' ? child : (child.text || ''),
            selected: false,
          })),
        })),
      };
    });

    db.prepare("DELETE FROM call_chains WHERE project_id = ? AND query = '__outline__'").run(projectId);
    db.prepare('INSERT INTO call_chains (project_id, query, result) VALUES (?, ?, ?)')
      .run(projectId, '__outline__', JSON.stringify({ outline }));

    console.log('[outline] generated, categories:', Object.values(results).map(function(r){return r.length}).join(','));
    res.json({ outline, cached: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
