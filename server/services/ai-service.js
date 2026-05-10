const https = require('https');
const db = require('../db');

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function chatCompletion(messages) {
  return new Promise((resolve, reject) => {
    const apiKey = getConfig('ai_api_key');
    const apiUrl = getConfig('ai_api_url') || 'https://api.deepseek.com/v1/chat/completions';

    if (!apiKey) {
      return reject(new Error('AI API Key not configured'));
    }

    const url = new URL(apiUrl);
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 120000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'API error'));
          } else {
            resolve(parsed.choices?.[0]?.message?.content || '');
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

async function generateSummary(project) {
  const fs = require('fs');
  const path = require('path');

  // Get directory structure (top 2 levels)
  let dirs = '';
  try {
    const walk = (dir, depth) => {
      if (depth > 1) return '';
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '__pycache__' && e.name !== '.git');
      let result = '';
      for (const e of entries) {
        result += '  '.repeat(depth) + (e.isDirectory() ? '📁' : '📄') + ' ' + e.name + '\n';
        if (e.isDirectory()) result += walk(path.join(dir, e.name), depth + 1);
      }
      return result;
    };
    dirs = walk(project.path, 0).substring(0, 3000);
  } catch {}

  // Get README first 2000 chars
  let readmePreview = (project.auto_description || '') + '\n' + (project.readme_content || '').substring(0, 2000);

  const prompt = `你是一个技术分析专家。分析以下开源项目并生成中文技术摘要。

项目名：${project.name}
远程地址：${project.remote_url || 'N/A'}

目录结构：
${dirs || 'N/A'}

README/项目信息：
${readmePreview || 'N/A'}

请按以下格式输出（直接输出 Markdown，不要额外说明）：

### 项目概述
（一句话描述这个项目是什么，解决什么问题）

### 核心技术栈
（列出关键技术、语言、框架）

### 架构特点
（项目的架构设计特点、模块组织方式）

### 值得学习的点
（项目中有哪些值得学习的设计模式、最佳实践、算法等）

### 入口文件与关键模块
（列出项目的入口文件路径和核心模块目录）`;

  const content = await chatCompletion([{ role: 'user', content: prompt }]);
  if (!content || content.trim().length < 10) {
    throw new Error('AI returned empty or too short response');
  }
  return content;
}

async function classifyProjects(projects) {
  const projectList = projects.map(p =>
    `- id:${p.id} name:${p.name} desc:${p.auto_description || p.description || '无描述'} remote:${p.remote_url || ''}`
  ).join('\n');

  const prompt = `将以下开源项目按领域/用途分类。每个项目只能属于一个类别。
类别名称应该简洁（2-6个字），如：量化交易、AI Agent、大模型应用、开发工具、数据分析、Web框架、自动化工具、其他

项目列表：
${projectList}

请只返回 JSON 数组，不要其他内容：
[{"id": 项目ID数字, "category": "分类名"}, ...]`;

  const content = await chatCompletion([{ role: 'user', content: prompt }]);

  // Parse JSON from response (handle markdown code fences)
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*$/g, '');
  }
  return JSON.parse(jsonStr);
}

module.exports = { generateSummary, classifyProjects };
