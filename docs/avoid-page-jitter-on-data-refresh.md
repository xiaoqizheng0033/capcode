# 数据刷新导致页面抖动 — 经验记录

## 问题表现

Modal 弹窗中操作成功（如克隆完成）后，背景页面出现抖动/闪烁。

## 根因

`onAdded` 回调中调用了 `loadData()`（完整刷新），而 `loadData` 内部先 `setLoading(true)` 再请求 API 再 `setProjects(p)` `setStats(s)`。

即使 Modal 还在页面上方，`setLoading(true)` 触发的 React 重新渲染也可能引起背景页面重绘。

## 解决方案

操作成功的回调中**不重新请求 API**，而是直接增量修改 state：

```jsx
// 不好：触发 loading + API + 全量替换
onAdded={(project) => { loadData() }}

// 好：直接追加到本地 state
onAdded={(project) => {
  setProjects(prev => [...prev, project]);
  setStats(s => ({ ...s, totalProjects: s.totalProjects + 1 }));
}}
```

## 原则

| 场景 | 做法 |
|------|------|
| 单个项目新增/修改 | 直接修改本地 state，不请求 API |
| 全量数据需要刷新 | 在页面切入/切换时做，不要叠在操作回调里 |
| 非 UI 阻塞更新 | 用 `useEffect` + 定时器静默刷新，不留 `loading` 状态 |

## 对应文件

- `client/src/pages/Dashboard.jsx` — `onAdded` 回调使用增量 state 更新
