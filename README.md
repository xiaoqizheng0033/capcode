# CapCode

> 本地开源项目管理器 — 自动 Git、分类、摘要、发现更新

## 初衷

AI 智能时代，个体开发者可以快速学习开源项目。但克隆下来的开源项目多了，管理就成了大问题：

- 几十上百个 repo 散落在硬盘里，记不清每个是做什么的
- 不知道哪些项目有更新，手动 `git pull` 太繁琐
- README 全是英文，快速浏览效率低
- 项目缺乏分类，想找某个领域的参考代码时无从下手

CapCode 为此而生。把本地 repo 目录交给它，自动完成 Git 同步、AI 摘要生成、智能分类、更新发现 — 让你专注于学习和开发本身。

## 功能

### 核心

- **目录扫描**：自动识别本地 Git 仓库，提取 README、commit 信息
- **定时/手动拉取**：批量或单独 `git pull`，实时终端风格进度显示
- **AI 智能摘要**：调用 DeepSeek 分析项目，生成中文技术摘要（项目概述、技术栈、架构特点、值得学习的点）
- **AI 智能分类**：自动打标签（量化交易、AI Agent、开发工具等），支持手动调整
- **GitHub Release 同步**：显示当前版本完整的 Release Notes

### 操作

- **克隆新项目**：输入 GitHub URL，终端风格实时进度
- **一键展开/折叠**：按分类分组浏览，全部展开/折叠
- **手动编辑**：项目介绍、分类可手动修改
- **暗黑/亮色主题**：跟随系统或手动切换

### 计划

- **AI 辅助代码学习**：选中项目，AI 帮你解读核心模块、调用链、设计模式
- **代码搜索**：跨项目搜索函数定义、API 用法

## 项目结构

```
repo-manager/
├── server/
│   ├── index.js                  # Express 入口
│   ├── db.js                     # SQLite 封装（sql.js WASM）
│   ├── routes/
│   │   ├── projects.js           # 项目 CRUD、clone、pull、摘要、分类、release
│   │   ├── updates.js            # 更新历史查询
│   │   └── config.js             # 配置读写
│   └── services/
│       ├── git-service.js        # git clone/pull（child_process + SSE）
│       ├── scanner.js            # 目录扫描 + AI 处理流水线
│       ├── ai-service.js         # DeepSeek API 调用
│       ├── scheduler.js          # node-cron 定时 pull
│       └── translate.js          # Google Translate 英译中
├── client/
│   └── src/
│       ├── App.jsx               # 路由
│       ├── api.js                # 前端 API 封装
│       ├── pages/
│       │   ├── Dashboard.jsx     # 主页（项目列表、统计卡片）
│       │   ├── ProjectDetail.jsx # 项目详情
│       │   └── Settings.jsx      # 设置页
│       ├── components/
│       │   ├── CategoryGroup.jsx      # 分类分组
│       │   ├── ProjectCard.jsx        # 项目卡片
│       │   ├── UpdateTimeline.jsx     # 更新历史
│       │   ├── CollapsibleSection.jsx # 可折叠区块
│       │   ├── AddProjectModal.jsx    # 克隆弹窗
│       │   └── StatusBadge.jsx        # 状态标记
│       └── context/
│           └── ThemeContext.jsx  # 主题切换
├── data/                         # SQLite 数据库存储
├── docs/                         # 开发文档与经验记录
├── package.json
└── start.bat                     # Windows 一键启动
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + React Router 7 + Tailwind CSS + Vite |
| 后端 | Express 4 + sql.js (SQLite WASM) |
| Git | simple-git + child_process |
| AI | DeepSeek Chat API |
| 翻译 | Google Translate API（免费） |
| 定时 | node-cron |

## 部署

### 前置条件

- Node.js 18+
- Git

### 1. 安装依赖

```bash
npm install
cd client && npm install
```

### 2. 配置

启动后访问 `http://localhost:3456/settings`：

- **Repo 目录路径**：你存放开源项目的本地目录，如 `C:\Myfiles\Codes\repos`
- **检查间隔**：定时 pull 的小时间隔
- **AI API Key**：DeepSeek API Key（[获取地址](https://platform.deepseek.com)）
- **GitHub Token**（可选）：用于获取 Release 信息，不加则 API 限速 60次/小时

### 3. 启动

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build    # 构建前端
npm start        # 启动服务 → http://localhost:3456
```

Windows 一键启动：

```bash
start.bat
```

### 4. 首次使用

1. 确保 Repo 目录路径下已有 Git 仓库（或为空）
2. 点击"手动扫描"初始化数据库
3. 点击"智能分类" + "生成摘要"（需要配置 AI API Key）

## License

MIT
