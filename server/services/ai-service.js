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

  const prompt = `将以下开源项目按领域/用途打标签。每个项目可以有1-3个标签。
标签名称应该简洁（2-6个字），如：量化交易、AI Agent、大模型应用、开发工具、数据分析、Web框架、自动化工具、其他

项目列表：
${projectList}

请只返回 JSON 数组，不要其他内容：
[{"id": 项目ID数字, "tags": ["标签1", "标签2"]}, ...]`;

  const content = await chatCompletion([{ role: 'user', content: prompt }]);

  // Parse JSON from response (handle markdown code fences)
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*$/g, '');
  }
  return JSON.parse(jsonStr);
}

/**
 * Generate a Markdown update report from pullAllProjects() results.
 * Focuses on (1) local source-code updates and (2) pull errors.
 * If AI is unavailable, caller should fall back to buildLocalUpdateReport().
 */
async function generateUpdateReport(results) {
  const total = results.length;
  const updated = results.filter(r => r.status === 'success');
  const noChange = results.filter(r => r.status === 'no_change');
  const failed = results.filter(r => r.status === 'failed');

  const updatedSection = updated.map(r => {
    const commits = (r.commits || []).slice(0, 15).map(c =>
      `    - [${String(c.hash || '').slice(0, 7)}] ${String(c.message || '').trim().split('\n')[0]} — ${c.author || ''}`
    ).join('\n');
    return `  - **${r.name}** (${r.commitsCount} 个新提交)\n${commits || '    (无提交明细)'}`;
  }).join('\n');

  const failedSection = failed.map(r =>
    `  - **${r.name}**：${r.error || '未知错误'}`
  ).join('\n');

  const prompt = `你是一位资深的代码仓库运维分析助手。请根据下面「一键拉取所有项目更新」的执行结果，生成一份中文 Markdown 更新报告。

执行统计：
- 总项目数：${total}
- 有源码更新：${updated.length}
- 无变化：${noChange.length}
- 拉取失败：${failed.length}

【有更新的项目及其提交记录】
${updatedSection || '  (无)'}

【拉取失败的项目及错误信息】
${failedSection || '  (无)'}

请直接输出 Markdown 报告（不要额外说明、不要包裹在代码块中），并严格使用以下结构：

## 📦 代码更新情况
${
  updated.length > 0
    ? '逐个项目总结本次实质性源码更新：哪些模块/功能发生了变化、提交主题反映了什么开发进展、有哪些值得关注的提交（如 breaking change、新特性、安全修复）。按更新重要性排序。'
    : '本次没有项目发生源码更新。'
}

## ⚠️ 拉取错误情况
${
  failed.length > 0
    ? '逐个分析失败项目，对每个错误进行分类（如：网络问题、认证失败、本地路径不存在、合并冲突、远端仓库已删除等），并给出具体的修复建议。'
    : '本次没有拉取失败的项目。'
}

## 💡 整体建议
针对本次更新情况给出 1-3 条整体建议（如：需要重点 review 的项目、需要修复的拉取问题、后续行动建议）。`;

  const content = await chatCompletion([{ role: 'user', content: prompt }]);
  if (!content || content.trim().length < 10) {
    throw new Error('AI returned empty or too short response');
  }
  return content;
}

/**
 * Local fallback Markdown report when AI is unavailable (e.g. API key missing).
 * Produces a plain summary from raw results without calling the LLM.
 */
function buildLocalUpdateReport(results) {
  const total = results.length;
  const updated = results.filter(r => r.status === 'success');
  const noChange = results.filter(r => r.status === 'no_change');
  const failed = results.filter(r => r.status === 'failed');

  let md = `## 📊 拉取统计\n\n`;
  md += `- 总项目数：**${total}**\n- 有源码更新：**${updated.length}**\n- 无变化：**${noChange.length}**\n- 拉取失败：**${failed.length}**\n\n`;

  md += `## 📦 代码更新情况\n\n`;
  if (updated.length === 0) {
    md += `_本次没有项目发生源码更新。_\n\n`;
  } else {
    for (const r of updated) {
      md += `**${r.name}**（${r.commitsCount} 个新提交）\n`;
      for (const c of (r.commits || []).slice(0, 15)) {
        md += `- [${String(c.hash || '').slice(0, 7)}] ${String(c.message || '').trim().split('\n')[0]} — ${c.author || ''}\n`;
      }
      md += `\n`;
    }
  }

  md += `## ⚠️ 拉取错误情况\n\n`;
  if (failed.length === 0) {
    md += `_本次没有拉取失败的项目。_\n\n`;
  } else {
    for (const r of failed) {
      md += `- **${r.name}**：${r.error || '未知错误'}\n`;
    }
    md += `\n`;
  }
  md += `## 💡 整体建议\n\n`;
  md += `_（AI 未配置或调用失败，以上为原始拉取结果汇总。请在「设置」中配置 DeepSeek API Key 以获取 AI 智能分析报告。）_\n`;
  return md;
}

module.exports = { generateSummary, classifyProjects, chatCompletion, generateUpdateReport, buildLocalUpdateReport };
