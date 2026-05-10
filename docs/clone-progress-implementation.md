# Git Clone 进度信息前端实时显示 — 实现经验记录

## 概述

在"添加新项目"弹窗中，克隆 GitHub 仓库时实时显示 git 终端的原始进度信息（类似 `git clone --progress` 输出），黑底绿字终端风格。

**本次实现经过一次回滚才纠正，记录如下以防止未来误改。**

## 架构：三端协作

```
[Git child_process] → stderr/stdout → [Node后端 SSE] → fetch ReadableStream → [React前端]
```

### 关键设计决策

1. **后端必须用 `child_process.exec` 而非 `simple-git`** — simple-git 的 progress 回调只能拿到 `{ method, stage, progress }` 结构化数据，丢失原始文本。git 进度信息输出到 stderr，必须直接捕获 stderr。
2. **传输协议用 SSE（Server-Sent Events）** — 流式传输，比 WebSocket 简单，天然适合 server→client 单向推送。
3. **前端用 `fetch` + `ReadableStream` 解析 SSE** — 避免引入 EventSource（EventSource 不支持 POST 请求体）。

## 涉及文件与关键代码

### 1. `server/services/git-service.js` — git 子进程执行

```js
// 使用 child_process.exec 直接捕获原始 git stderr 输出（git 进度信息在 stderr）
const { exec } = require('child_process');
child.stderr.on('data', (data) => {
  const text = data.toString();
  // 过滤 Windows 下的 case-insensitive 文件碰撞 warning
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
```

```js
// clone 命令必须带 --progress（默认 git clone 在非 tty 下不输出进度）
await exec(`git clone "${githubUrl}" "${repoName}" --progress`, { cwd: basePath });
```

**重要：** 不要改回 simple-git 的 `git.clone()`，它会丢失原始文本输出。

### 2. `server/routes/projects.js` — SSE 传输层

```js
router.post('/clone', async (req, res) => {
  // 必须 set SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // 禁用 nginx 缓冲（如果有反向代理）
  });

  function send(type, data) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const project = await cloneRepo(url, (msg) => {
    send('progress', { message: msg });
  });
  send('done', { project });
  res.end();
});
```

**SSE 事件格式：** `event: progress\ndata: {"message":"..."}\n\n`

三种事件类型：`progress`（进度行）、`done`（克隆成功）、`error`（错误）。

**重要：** 
- 不能用 `res.json()` 返回，必须 `res.writeHead(200, SSE headers)` + `res.write()` + `res.end()`
- SSE data 行必须 JSON 编码

### 3. `client/src/components/AddProjectModal.jsx` — 前端消费 SSE

```js
// 通过 fetch + ReadableStream 手动解析 SSE（EventSource 不支持 POST body）
const res = await fetch('/api/projects/clone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: url.trim() }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n\n');  // SSE 事件以 \n\n 分隔
  buffer = parts.pop() || '';          // 保留未完成的事件

  for (const part of parts) {
    // 解析 event 和 data 行
    const lines = part.split('\n');
    let eventType = '';
    let eventData = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7);
      else if (line.startsWith('data: ')) eventData = line.slice(6);
    }
    // 处理事件...
  }
}
```

**重要：** 必须用 `buffer` 累积 + `parts.pop()` 处理 SSE 事件可能被 TCP 分片的情况。

### 4. 日志合并/原地刷新逻辑（关键）

git 输出的进度行（如 `Receiving objects: 10%...` `Receiving objects: 11%...`）应原地刷新而非追加新行。固定信息行（如 `Cloning into`、`remote: Total`）追加保留。

```js
// 三条进度线各自用 _key 标记，相同 key 的行原地替换最后一条
const isReceiving = text.startsWith('Receiving objects:');
const isResolving = text.startsWith('Resolving deltas:');
const isCompressing = text.startsWith('remote: Compressing');

if (isReceiving || isResolving || isCompressing) {
  const key = isReceiving ? 'Receiving' : isResolving ? 'Resolving' : 'remoteCompress';
  const lastIdx = next.length - 1;
  if (lastIdx >= 0 && next[lastIdx]._key === key) {
    next[lastIdx] = { type: 'info', text, _key: key };
  } else {
    next.push({ type: 'info', text, _key: key });
  }
} else {
  next.push({ type: 'info', text });  // 固定行直接追加
}
```

**重要：** `remote:` 前缀不能整体合并，因为 `remote: Compressing`（进度）和 `remote: Total`（统计）是不同的。只合并 `remote: Compressing`。

## 终端风格 UI

```jsx
<div className="bg-gray-950 text-green-400 rounded-md p-3 font-mono text-xs max-h-48 overflow-y-auto">
  {logs.map((log, i) => (
    <div key={i} className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-300' : 'text-green-400'}>
      {log.type === 'info' && '> '}{log.text}
    </div>
  ))}
  <div ref={logEndRef} />  {/* 自动滚到底部 */}
</div>
```

- `bg-gray-950` 黑底，`text-green-400` 绿字，`font-mono` 等宽字体 → 终端外观
- 错误信息红色，成功信息亮绿，进度信息 > 前缀

## 常见陷阱与注意事项

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 用 simple-git 的 progress 回调 | 拿不到原始文本，只有结构化 % | **必须** child_process.exec |
| clone 不加 `--progress` | 非 tty 下 git 不输出进度 | 必须带 `--progress` flag |
| 用 EventSource 接收 | EventSource 不支持 POST | 用 fetch + ReadableStream |
| 不处理 SSE buffer 分片 | 事件被截断丢失 | 用 buffer 累积 + \\n\\n 分割 |
| `remote:` 整体合并刷新 | remote: Total 等汇总行被覆盖 | 只合并 `remote: Compressing` |
| 改回 `res.json()` | SSE 流无法工作 | 必须 SSE headers + write/end |
| Windows 文件碰撞 warning | 干扰进度显示 | stderr 过滤 `warning:` 和 `'` 开头的行 |

## 最终效果

克隆时弹窗显示黑底绿字终端：

```
> Cloning into 'Qbot'...
> remote: Enumerating objects: 5986, done.
> remote: Counting objects: 100% (393/393), done.
> remote: Compressing objects: 100% (284/284), done.     ← 原地刷新
> remote: Total 4692 (delta 1036), reused 940...
> Receiving objects: 100% (4692/4692), done.               ← 原地刷新
> Resolving deltas: 100% (3135/3135), done.                ← 原地刷新
克隆完成                                                    ← 绿色成功提示
```
