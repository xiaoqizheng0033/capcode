# React Portal 解决 Modal 被父容器隐藏 — 经验记录

## 问题表现

Modal 弹窗（fixed 定位）在页面中显示，但点击页面空白区域或其他位置后视觉上消失，不过组件状态未丢失（再点按钮能重新弹出）。

## 根因分析

Modal 使用 `position: fixed` 定位，但 React 组件节点挂载在父组件 DOM 树内。当父容器或其祖先元素存在以下 CSS 属性时，`fixed` 定位的参照物会变成该祖先而非 viewport：

- `transform`（任意值，包括 `translate(0, 0)`）
- `filter`、`backdrop-filter`
- `perspective`
- `will-change: transform`
- `contain: paint` 或 `contain: layout`

这会导致 Modal 看似"消失"，实际上被推到页面外的某个位置（相对于截断的父容器而非 viewport）。

## 解决方案

用 `ReactDOM.createPortal()` 将 Modal 渲染到 `document.body` 下，脱离父容器 DOM 层级。

```jsx
import { createPortal } from 'react-dom'

export default function AddProjectModal({ open, onClose, onAdded }) {
  if (!open) return null

  const modal = (
    <div className="fixed inset-0 ... z-50">
      {/* 弹窗内容 */}
    </div>
  )

  return createPortal(modal, document.body)
}
```

**关键点：**
1. `if (!open) return null` 必须在 portal 调用之前（portal 挂载到 body 时也需要能卸载）
2. `createPortal(modal, document.body)` 将 DOM 节点插入 `<body>` 末尾
3. `z-index: 50` 现在直接相对于 viewport 生效

## 适用范围

所有 Modal/Dialog/Drawer/Dropdown 等覆盖层组件，只要使用 `fixed` 或 `absolute` 定位且需要覆盖页面内容，都应该通过 Portal 渲染。

## 常见误区

| 误区 | 后果 |
|------|------|
| 觉得 Modal 在根组件里就不用 Portal | 根组件的容器 div 也可能有 CSS 属性 |
| 用更高 z-index 解决 | 没用，z-index 和 fixed 参照物无关 |
| 移除外层 `overflow-y-auto` | 可能有用但治标不治本，换一个父元素加 `transform` 又会坏 |

## 对应文件

- `client/src/components/AddProjectModal.jsx` — 已用 `createPortal` 渲染到 body
