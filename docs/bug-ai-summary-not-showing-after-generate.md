# Bug: 生成摘要后详情页看不到 AI 摘要 — 未解决

## 现象

1. 克隆新项目 → 主页卡片没有 AI 摘要（正常）
2. 点"生成摘要" → 提示成功 → 主页卡片显示摘要
3. 点卡片进详情页 → **看不到摘要**
4. 详情页 F5 刷新 → **看不到摘要**  
5. 返回主页 → 主页刷新 → 再点卡片 → 能看到摘要

## 已排查并确认的

### 不是以下原因

- **浏览器缓存**：加了 `Cache-Control` 响应头、URL 时间戳参数，Network 面板甚至看不到请求发出（见下方）
- **React 组件缓存**：用了 `location.key` 触发重加载、React Router `key` 强制重挂载
- **后端 API**：curl 验证 `getProject(id)` 返回完整 `ai_summary`
- **SQL 查询**：`regenerate-all-summaries` 正确匹配 `ai_summary = ''`

### 关键发现

1. Clone 时 INSERT 不包含 `ai_summary` 字段，SQLite 可能存为 NULL（已修复：显式 `ai_summary = ''`）
2. `regenerate-all-summaries` 查询条件 `WHERE ai_summary IS NULL OR ai_summary = ''` 理论上能匹配 NULL 和空字符串，但某些 SQLite 版本中 `ALTER TABLE ADD COLUMN` 的 `DEFAULT ''` 对新行行为不明确
3. **前端 `loadData` 中的 `p.ai_summary` 是空字符串 `""`**（console 日志确认），但没发出 HTTP 请求 — 说明数据来自某处缓存而非 API 调用
4. 同一时间 `getProjects(search)` 返回的数据有摘要，`getProject(id)` 没有

## 可能的方向

- SQLite/D1 中 `ALTER TABLE ADD COLUMN ... DEFAULT ''` 对 INSERT 时不指定列的行为在不同版本不一致
- React 前端可能在某处持有了旧 project 对象的引用（虽然 State 已更新）
- `Promise.all` 并行请求中 `getProject(id)` 可能被某个中间件或 Service Worker 拦截

## 涉及文件

- `server/services/git-service.js:197-203` — clone INSERT
- `server/db.js:100-107` — ai_summary 列 migration + NULL 规范化
- `server/routes/projects.js:128-147` — regenerate-all-summaries 接口
- `server/routes/projects.js:39-48` — getProject 接口
- `client/src/pages/ProjectDetail.jsx:28-43` — loadData
- `client/src/api.js` — API 请求函数（带时间戳防缓存）

## 记录时间

2026-05-10 — 经多次排查未定位根因，待后续研究
