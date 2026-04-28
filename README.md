# 项目总览管理系统

> 一款面向中小型团队的**纯前端单页项目管理工具**，无需后端，数据本地存储，支持 AI 智能识别合同与交付内容。

---

## 功能概览

### 看板视图（主界面）

项目以 Kanban 看板形式呈现，分为四个阶段列：

| 阶段 | 说明 |
|------|------|
| 🤝 洽谈中 | 正在对接、尚未签约的商机 |
| 📦 交付中 | 已签约、正在执行交付的项目 |
| ✅ 已完结 | 交付完成、款项结清的项目 |
| ❌ 已终止 | 中途终止的项目 |

每张项目卡片展示：项目名称、负责人、客户、更新时间、金额概览、回款进度条、催款任务预览和待办预览。

---

### 项目管理

**新建 / 编辑项目**支持以下字段（分 Tab 管理）：

**基本信息**
- 项目名称、自动生成的项目编号（格式 `PM-YYYYMMDD-XXXX`）
- 项目来源、客户名称、负责人、产品/方案
- 报价金额（万元）
- 项目阶段、洽谈状态、活跃度
- 合同签署日期
- 项目简介、更新日志

**回款管理**
- 报价金额、合同金额、成本评估（万元）
- 已回款金额、回款进度条（自动计算百分比）
- **回款节点**：计划日期、计划金额、触发条件、实际回款日期、实际金额、完成状态
- **催款任务**：日期、金额、负责人、备注、完成状态

**交付情况**
- 交付类型标签：无线硬件 / 有线硬件 / 软件定制 / 其他
- 交付内容描述（可由 AI 自动识别技术协议生成）
- 补充说明（交付细节、安装调试情况、客户反馈等）

**项目进度**
- 从语雀同步的月度进度数据
- 进度内容展示和折叠
- 支持按月份查看项目进展

**本地文件（File System Access API）**
- 绑定本地磁盘文件夹（持久化权限）
- 文件自动分类展示：合同 / 技术协议 / 技术方案 / 方案报价 / 其他
- 支持拖拽上传、在线预览（图片、PDF、文本、DOCX）
- 合同/技术协议 AI 智能识别
- 项目文件夹备注（写入本地 `备注.txt`）

**更新日志**
- 时间线形式记录所有更新历史
- 每次保存自动添加时间戳

---

### 台账（Ledger）

从侧边栏打开，以表格形式汇总所有项目：

- **展示字段**：项目名称、阶段、项目来源、客户、负责人、报价、合同额、签订日期、已回款、回款进度、毛利润、待办数
- **快速筛选**：全部 / 洽谈 / 交付中 / 催款中 / 已完结 / 有待办
- **排序**：默认 / 阶段 / 报价↓ / 合同额↓ / 回款进度↑ / 利润↓
- **AI 自然语言筛选**：输入"催款中的项目"、"苏奕玮负责的"、"合同超50万"等自然语言自动筛选，支持结果缓存

---

### 待办分析面板

汇总所有项目的待办事项，智能分类多维度展示：

- **催款任务区**：单独展示所有未完成催款任务，计算欠款时长（按天/月/年），高亮超期任务
- **统计概览**：总数、未完成、已完成、完成率
- **按类型分析**：
  - 📝 推进合同（关键词：合同、签约、报价等）
  - 💰 催收回款（关键词：回款、发票、付款等）
  - 🚚 交付执行（关键词：交付、发货、验收等）
  - 📞 客户跟进（关键词：跟进、拜访、沟通等）
  - 📌 其他事项
- **按负责人分组**：查看每个人的待办负担
- **按项目列出**：查看每个项目的待办进度条
- **快捷操作**：点击待办直接完成/取消完成

---

### AI 功能

系统集成了 AI 能力用于自动化文档识别，支持以下 AI 服务商：

| 服务商 | 说明 |
|--------|------|
| Claude (Anthropic) | 默认推荐，支持原生 PDF 解析 |
| OpenAI | GPT-4o 系列模型 |
| Gemini (Google) | Gemini 2.0/2.5 系列 |
| 自定义 | 兼容 OpenAI API 格式的任意服务（智谱、DeepSeek 等）|

**模型策略**：
- 🚀 **自动选择**：快速任务用轻量模型，复杂任务自动升级高级模型
- 📌 **固定模型**：所有任务都使用指定模型

**AI 能力包括：**
- **合同识别**：上传合同 PDF/DOCX，自动提取合同总金额、回款节点、交付内容
- **技术协议识别**：自动识别交付类型标签和交付内容摘要
- **报价识别**：自动提取报价金额
- **台账 AI 筛选**：自然语言过滤项目列表
- **表格列名识别**：Excel/语雀导入时自动识别列名映射

---

### 数据导入

**Excel 导入**
- 支持 `.xlsx` / `.xls` 格式
- 两种解析模式：AI 智能识别列名（推荐）/ 固定模板格式
- 导入前可预览数据，区分新增/更新项目
- 下载导入模板

**语雀导入**

> ⚠️ **重要**：语雀导入功能需要配置本地代理服务才能正常工作。

**为什么需要代理？**

由于浏览器同源策略限制，直接从前端访问语雀 API（`pi2star.yuque.com`）会被 CORS 阻止。本地代理服务解决这一限制，使浏览器可以正常调用语雀 API。

**配置步骤：**

1. **安装 Node.js**（如果尚未安装）

2. **启动本地代理服务**：
```bash
cd project-manager

# 使用 pm2 启动服务（后台运行 + 开机自启）
npm install -g pm2
pm2 start local-yuque-proxy.js --name yuque-proxy
pm2 startup
pm2 save
```

3. **在应用界面配置代理地址**：
   - 打开「语雀导入」面板
   - 将代理地址改为：`http://localhost:3030`

**日常使用：**

- 开机后 `pm2` 会自动启动代理服务
- 管理命令：
  - `pm2 status` - 查看服务状态
  - `pm2 logs yuque-proxy` - 查看日志
  - `pm2 restart yuque-proxy` - 重启服务

**代理架构说明：**

```
浏览器 → 本地代理 (localhost:3030) → 语雀 API（国内可直连）
```

- 支持 AI 智能识别表格结构

---

### 沙盒调试台

开发者工具，用于调试 AI Prompt 和测试配置：

- **合同调试 Tab**：
  - 上传合同文件（PDF/DOCX/TXT）
  - 独立调试交付内容识别
  - 独立调试回款节点识别
  - 全量识别（交付+回款+金额）
  - 支持编辑 Prompt 后重新运行
  - 显示 AI 原始响应和解析结果

- **技术协议调试 Tab**：
  - 上传技术协议文件
  - 识别交付内容标签和简要描述

- **表格识别调试 Tab**：
  - 上传 Excel 文件
  - 测试表格列名映射
  - 支持字段映射关系编辑

- **模型切换**：内置 Claude 沙盒 / 全局 AI 模型

---

### AI 监控面板

记录所有 AI 调用的使用情况和配置：

**配置 Tab**：
- 服务商选择（Claude/OpenAI/Gemini/自定义）
- 模型选择（各服务商支持的模型列表）
- 模型策略（自动/固定）
- 代理地址 & API Key 配置
- Token 配置（max_tokens）
- 连接测试
- 对话测试（实时聊天验证配置）

**调用日志 Tab**：
- 总调用次数、总消耗 Token、输入/输出 Token
- 详细调用日志（时间、任务类型、模型、Token 数、耗时、状态）
- 按任务类型统计

---

### 其他功能

- **Pipeline 统计栏**：页面顶部实时显示各阶段项目数量
- **侧边栏统计**：显示项目总数、总报价额、总合同额、待办事项（支持"全部/本年"筛选）
- **回收站**：删除的项目暂存于回收站，可恢复或彻底删除
- **项目编号自动生成**：格式为 `PM-YYYYMMDD-XXXX`
- **数据导出**：导出 JSON 备份文件
- **数据导入**：从 JSON 文件恢复数据，支持从 localStorage 缓存导入
- **清空数据**：一键清空所有项目（含确认提示）
- **侧边栏折叠**：节省屏幕空间

---

## 技术架构

| 类型 | 技术 |
|------|------|
| 语言 | 原生 HTML5 + CSS3 + JavaScript（ES2020+）|
| 框架 | 无框架，纯 Vanilla JS |
| 模块化 | ES Module + 动态导入 (`import()`) |
| 样式 | 模块化 CSS 架构，CSS Variables 主题系统，11个独立样式文件 |
| 字体 | Google Fonts（Noto Serif SC / Noto Sans SC）|
| 第三方库 | [SheetJS (xlsx)](https://sheetjs.com/) v0.18.5 |
| 数据存储 | IndexedDB（主存储）+ localStorage（缓存/快速加载）|
| 文件系统 | Web File System Access API |
| AI 调用 | REST API（兼容 OpenAI/Anthropic/Google 格式）|
| 部署 | 多文件模块，需通过 HTTP 服务器访问 |

---

## 代码结构

项目采用模块化设计，将功能拆分为多个独立的 JavaScript 模块，通过动态导入实现代码拆分和懒加载。代码结构已重新组织为更清晰的目录结构：

```
project-manager/
├── main.js               # 主入口脚本，动态导入所有模块，初始化应用
├── project-manager.html  # 主 HTML 文件，仅包含 DOM 结构（样式已完全外部化）
│
├── css/                  # 样式系统目录（完全模块化）
│   ├── variables.css            # CSS 变量定义（设计系统）
│   ├── base.css                 # 基础重置与布局框架
│   ├── components.css           # 通用 UI 组件（按钮、卡片、标签）
│   ├── board.css                # 看板视图样式
│   ├── modal.css                # 弹窗与表单样式
│   ├── sidebar.css              # 左侧导航栏样式
│   ├── file-panel.css           # 文件面板样式
│   ├── ai-analysis.css          # AI 识别结果展示样式
│   ├── ai-chat.css              # AI 对话界面样式
│   ├── panels.css               # 侧边栏面板样式（待办、台账、导入、监控）
│   ├── panels-ai-monitor.css   # AI 监控面板样式
│   └── import-confirmation.css  # 导入确认面板样式
│
├── js/                  # JavaScript 代码目录（按功能分类）
│   ├── core/            # 核心功能模块
│   │   ├── db.js        # IndexedDB 数据库模块（持久化存储）
│   │   ├── project.js   # 项目管理核心模块（常量、数据管理、回收站）
│   │   ├── store.js     # 统一状态管理模块
│   │   └── render.js    # 渲染模块（看板视图、卡片、统计）
│   │
│   ├── ai/              # AI 相关模块
│   │   ├── chat.js      # AI 数据分析对话模块
│   │   ├── engine.js    # AI 服务核心模块（多服务商支持、API调用、缓存）
│   │   └── ui.js        # AI 界面控制模块（监控面板、沙盒调试台）
│   │
│   ├── features/        # 功能模块
│   │   ├── cost.js      # 成本分析模块
│   │   ├── import.js    # 数据导入模块（Excel/语雀导入、表格解析）
│   │   ├── ledger.js    # 台账模块（表格、筛选、AI搜索）
│   │   └── todos.js     # 待办分析面板模块（分类、多维度展示）
│   │
│   ├── file/            # 文件相关模块
│   │   ├── analysis.js  # 文件识别分析模块（合同/技术协议识别）
│   │   └── system.js   # 文件系统模块（本地文件夹、上传、预览）
│   │
│   └── ui/              # UI 相关模块
│       ├── debug.js     # 调试模块
│       └── modal.js     # Modal 表单控制模块（项目编辑表单）
│
└── local-yuque-proxy.js # 本地语雀代理服务（CORS 代理，解决跨域问题）
```

### 模块依赖关系

- **main.js**：依赖所有模块，负责初始化和协调
- **js/core/**：核心功能模块，其他模块的基础
- **js/ai/**：AI 相关功能，提供智能识别和对话能力
- **js/features/**：具体业务功能模块
- **js/file/**：文件系统操作和分析功能
- **js/ui/**：用户界面相关模块

### 模块说明

| 模块 | 职责 | 导出内容 |
|------|------|----------|
| `main.js` | 应用入口 | 初始化全局变量， orchestrate 模块加载 |
| `js/core/db.js` | 数据库 | `Database` 类（IndexedDB 封装）|
| `js/core/project.js` | 项目管理 | `STAGE`, `STORAGE_KEY`, `save`, `exportData`, `moveToRecycleBin` 等 |
| `js/core/store.js` | 状态管理 | 统一状态对象 `store`，`setState()`, `getState()` |
| `js/core/render.js` | 视图渲染 | `render`, `cardHTML`, `updateStats`, `refreshView` |
| `js/ai/engine.js` | AI 服务 | `claudeCall`, `AI_PROVIDERS`, `classifyFileNames`, `getAiConfig` |
| `js/ai/ui.js` | AI 界面 | `openMonitor`, `openSandbox`, `sendTestChat`, `initDragAndDrop` |
| `js/ai/chat.js` | AI 对话 | `initAiChat`, `sendChatMessage`, `renderChatResponse` |
| `js/features/todos.js` | 待办面板 | `openTodosPanel`, `renderTodosPanel`, `toggleTodo`, `TODO_TYPES` |
| `js/features/ledger.js` | 台账 | `openLedger`, `renderLedger`, `ledgerAiSearch`, `clearAiFilter` |
| `js/features/import.js` | 数据导入 | `parseExcel`, `parseYuqueTable`, `initImportDropZone`, `loadYuqueSettings` |
| `js/features/cost.js` | 成本分析 | `renderCostAnalysisTab`, `analyzeProcurement`, `scanProcurementFiles` |
| `js/file/system.js` | 文件系统 | `selectRootDir`, `saveRootHandle`, `loadRootHandle`, `updateRootBar`, `getProjectDir`, `renameProjectDir`, `readDocxText`, `clearFileOperationCache`, `previewFile`, `deleteFile`, `openFsRoot` |
| `js/file/analysis.js` | 文件识别分析 | `loadModalFilePanel`, `renderModalFileSection`, `toggleFileSelection`, `renderPaymentNodes`, `updatePaymentNode`, `togglePaymentNodeDone`, `togglePaymentNodeTaskCompleted`, `removePaymentNode`, `addPaymentNodeToProject`, `analyzeContractsForPayment`, `analyzeContractsForDelivery`, `analyzeContracts`, `analyzeAgreements`, `analyzeQuotes`, `toggleFileSelect`, `getSelectedFileNames`, `analyzeContractFile`, `analyzeContractText`, `analyzeAgreementFile`, `analyzeAgreementText`, `analyzeQuoteFile`, `analyzeQuoteText`, `renderContractAnalysis`, `confirmAIAnalysis`, `cancelAIAnalysis`, `renderAgreementAnalysis`, `confirmAgreementAIAnalysis`, `cancelAgreementAIAnalysis`, `renderQuoteAnalysis`, `switchToDeliveryTab`, `getFileIcon`, `closePreview`, `organizeFilesForProjectStart` |
| `js/ui/modal.js` | Modal 表单控制 | `openModal`, `closeModal`, `saveProject`, `onStageChange` |
| `js/ui/debug.js` | 调试工具 | 调试相关功能 |

### 模块加载流程

1. **页面加载**：`project-manager.html` 加载 `main.js`（`type="module"`）
2. **全局变量初始化**：`main.js` 在 `window` 上初始化全局状态
3. **模块动态导入**：`loadModules()` 按顺序导入所有模块
   ```
   js/core/db.js → js/core/project.js → js/core/render.js → js/ai/engine.js
   → js/file/system.js → js/features/todos.js → js/features/ledger.js → js/ai/ui.js
   → js/features/import.js → js/ui/modal.js → js/file/analysis.js → js/ai/chat.js → js/features/cost.js
   ```
4. **模块导出挂载**：使用 `Object.assign(window, module)` 将模块导出挂载到全局
5. **应用初始化**：`initApp()` 调用 `initDatabase()` 加载数据
6. **文件系统恢复**：尝试恢复之前授权的根目录句柄
7. **页面渲染**：数据加载完成后调用 `render()` 显示看板

### 全局状态管理

```javascript
// main.js 初始化的全局变量
window.projects = [];           // 项目数组
window.recycleBin = [];         // 回收站数组
window.editingId = null;        // 当前编辑的项目ID
window.currentEditProjectId = null;
window.statsFilter = 'thisYear'; // 统计筛选条件
window.db = null;               // IndexedDB 实例
window.DEBUG = false;           // 调试开关
window.fsRootHandle = null;     // 文件系统根目录句柄
window.isFilePickerOpen = false;
window.fsCurrentProjectId = null;
```

---

## 数据结构（项目对象）

```json
{
  "id": "uuid",
  "projectCode": "PM-20250101-0001",
  "name": "项目名称",
  "channel": "项目来源",
  "customer": "客户名称",
  "owner": "负责人",
  "product": "产品选型/方案",
  "quote": 50,
  "contract": 45,
  "cost": 30,
  "collected": 20,
  "paymentPct": 44,
  "stage": 1,
  "active": "active",
  "洽谈状态": "需求沟通",
  "desc": "项目描述",
  "deliveryTags": {
    "wireless_hardware": true,
    "wired_hardware": false,
    "software": true,
    "other": false
  },
  "deliveryBrief": "AI生成的交付描述",
  "deliveryNote": "补充说明",
  "todos": [{ "text": "待办事项", "done": false }],
  "collectTasks": [{ "date": "2025-01-01", "amount": 10, "owner": "", "note": "", "done": false }],
  "paymentNodes": [{
    "condition": "合同签订后",
    "planDate": "2025-01-01",
    "planAmount": 15,
    "actualDate": "",
    "actualAmount": 0,
    "done": false
  }],
  "logs": [{ "time": "2025-01-01T00:00:00.000Z", "text": "日志内容" }],
  "contractDate": "2025-01-01",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**阶段枚举（STAGE）：**
| 值 | 常量 | 显示 |
|----|------|------|
| `0` | `NEGOTIATING` | 洽谈中 |
| `1` | `DELIVERING` | 已签单·执行中 |
| `2` | `COMPLETED` | 已完结 |
| `3` | `TERMINATED` | 已终止 |

---

## 快速开始

### 方式 1：本地开发服务器（推荐）

```bash
# 进入项目目录
cd project-manager

# 启动本地服务器（Python 3）
python -m http.server 8000

# 或 Node.js
npx serve .

# 浏览器访问
open http://localhost:8000/project-manager.html
```

### 方式 2：直接打开（功能受限）

> ⚠️ **注意**：直接双击打开 HTML 文件时，File System Access API（本地文件绑定功能）会受限，因为浏览器要求该 API 必须在 HTTPS 或 localhost 环境下使用。

### 首次使用

1. 点击左侧导航栏「**＋ 新建项目**」创建第一个项目
2. 如需 AI 功能，进入「**🤖 AI 监控**」配置服务商、代理地址和 API Key
3. 如需绑定本地文件夹，点击「**📁 项目文件**」选择目录

---

## AI 配置指引

### 1. 进入 AI 监控面板

点击左侧导航栏「**🤖 AI 监控**」，切换到「**配置**」Tab。

### 2. 选择服务商

| 服务商 | 特点 | 推荐模型 |
|--------|------|----------|
| Claude | 原生支持 PDF 解析，中文理解好 | Claude Haiku 4.5（快速）/ Sonnet 4（均衡）|
| OpenAI | GPT-4o 系列，生态丰富 | GPT-4o Mini（快速）/ GPT-4o（均衡）|
| Gemini | Google 出品，长文本支持好 | Gemini 2.0 Flash（快速）|
| 自定义 | 支持任何 OpenAI 兼容 API | 根据服务商填写 |

### 3. 配置代理地址

由于浏览器跨域限制，需要配置代理服务：

**Cloudflare Workers 代理示例**：
```
https://your-worker.your-subdomain.workers.dev
```

**本地代理**（开发测试）：
```
http://localhost:8787
```

### 4. 填写 API Key

根据服务商获取 API Key：
- Claude：[console.anthropic.com](https://console.anthropic.com)
- OpenAI：[platform.openai.com](https://platform.openai.com)
- Gemini：[ai.google.dev](https://ai.google.dev)

### 5. 测试连接

点击「**测试连接**」按钮验证配置是否正确。

### 6. 对话测试

在对话框输入消息，测试模型响应。

---

## CSS 架构

本项目采用完全模块化的 CSS 架构，将原本内联在 HTML 中的样式分离为 11 个独立样式文件，实现关注点分离和更好的可维护性。

### 重构成果

| 指标 | 重构前 | 重构后 | 优化 |
|------|--------|--------|------|
| HTML 内联 CSS | ~970 行 | 0 行 | ✅ 完全移除 |
| HTML 总行数 | ~2000 行 | ~1070 行 | ✅ 减少 47% |
| CSS 文件数 | 0 | 11 个模块 | ✅ 完全模块化 |
| 缓存能力 | 无 | 完全支持 | ✅ 浏览器缓存 |

### 文件结构

```
css/
├── variables.css            # 38 行   - 设计系统变量定义
├── base.css                 # 138 行  - 基础重置与布局框架
├── components.css           # 564 行  - 通用 UI 组件（按钮、卡片、标签）
├── board.css                # 新增    - 看板视图样式
├── modal.css                # 630 行  - 弹窗与表单样式
├── sidebar.css              # 187 行  - 左侧导航栏样式
├── file-panel.css           # 408 行  - 文件面板 + 交付标签
├── ai-analysis.css          # 165 行  - AI 合同识别结果样式
├── panels.css               # 873 行  - 待办/台账/导入/监控面板样式
├── panels-ai-monitor.css    # 新增    - AI 监控面板样式
└── import-confirmation.css  # 新增    - 导入确认面板样式
```

### 加载顺序

样式文件按以下顺序加载，确保层叠正确：

```html
<!-- 1. 变量（必须在最前） -->
<link rel="stylesheet" href="css/variables.css">

<!-- 2. 基础（重置 + 布局框架） -->
<link rel="stylesheet" href="css/base.css">

<!-- 3. 组件（通用 UI） -->
<link rel="stylesheet" href="css/components.css">

<!-- 4-11. 模块（具体功能） -->
<link rel="stylesheet" href="css/board.css">
<link rel="stylesheet" href="css/modal.css">
<link rel="stylesheet" href="css/sidebar.css">
<link rel="stylesheet" href="css/file-panel.css">
<link rel="stylesheet" href="css/ai-analysis.css">
<link rel="stylesheet" href="css/panels.css">
<link rel="stylesheet" href="css/panels-ai-monitor.css">
<link rel="stylesheet" href="css/import-confirmation.css">
```

### 设计系统变量

`variables.css` 定义了一套完整的设计系统：

```css
:root {
  /* 主色调 */
  --ink: #1a0533;           /* 主文字色 - 深紫黑 */
  --ink-light: #5b3478;     /* 次要文字 - 浅紫 */

  /* 背景色 */
  --paper: #f8f0ff;         /* 主背景 - 极浅紫 */
  --paper2: #f0e6ff;        /* 次级背景 */
  --paper3: #e6d4f7;        /* 第三级背景 */

  /* 强调色 */
  --accent: #7b1fa2;        /* 主强调色 - 紫色 */
  --gold: #ce93d8;          /* 金色/高亮色 */

  /* 项目阶段色 */
  --s0: #6a1b9a;            /* 洽谈中 - 紫色 */
  --s1: #1565c0;            /* 交付中 - 蓝色 */
  --sc: #e65100;            /* 催款中 - 橙色 */
  --s2: #2e7d32;            /* 已完结 - 绿色 */

  /* 间距与动效 */
  --radius: 10px;
  --radius-lg: 16px;
  --transition: 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 模块化原则

1. **单一职责**：每个 CSS 文件只负责一个功能模块
2. **变量驱动**：所有颜色、间距、动画均使用 CSS 变量
3. **无内联样式**：HTML 中不再包含任何 `<style>` 标签
4. **可缓存**：分离后的 CSS 可被浏览器独立缓存
5. **易于维护**：修改样式只需定位到对应模块文件

---

## 版本说明

当前版本：**v1.8**

### v1.8 更新内容（代码优化 + 语雀代理改进）

- **统一状态管理**：新增 `js/core/store.js`，提供统一的状态管理模块
- **DEBUG 常量统一**：在 `main.js` 统一定义 DEBUG 常量，添加开发环境自动检测
- **全局错误边界**：添加全局错误和未处理 Promise 拒绝的监听与友好提示
- **数据库模块重构**：提取公共删除方法 `deleteByIndex()`，简化 `saveProject()` 逻辑
- **渲染缓存优化**：添加缓存大小限制和 LRU 清理策略
- **ESLint 配置**：新增 `.eslintrc.json` 代码规范配置
- **本地语雀代理**：改进 `local-yuque-proxy.js`，支持 CORS 预检请求，解决跨域问题

### v1.7 更新内容（架构重构）

- **代码架构重构**：将 JavaScript 代码重新组织为按功能分类的目录结构，包括 `js/core/`、`js/ai/`、`js/features/`、`js/file/` 和 `js/ui/`
- **模块重命名**：将模块文件重命名为更简洁的名称，如 `project-module.js` → `project.js`、`ai-module.js` → `engine.js` 等
- **CSS 架构完善**：新增 `ai-chat.css` 等样式文件，实现更细粒度的模块化
- **成本分析功能**：新增成本分析模块，支持从采购文件中识别成本数据
- **AI 对话功能**：新增 AI 数据分析对话模块，提供智能数据分析能力
- **调试工具**：新增调试模块，提供开发和调试支持

### v1.6 更新内容（CSS 架构完善）

- **CSS 架构完善**：新增 `board.css`、`panels-ai-monitor.css`、`import-confirmation.css` 等样式文件，实现更细粒度的模块化
- **样式加载优化**：调整样式文件加载顺序，确保层叠正确
- **项目进度功能**：新增项目进度 Tab，支持从语雀同步月度进度数据
- **AI 监控面板**：优化 AI 控制台，支持多模型配置和任务映射
- **导入确认功能**：新增导入确认面板，提升数据导入体验

### v1.5 更新内容（CSS 架构重构）

- **CSS 完全模块化**：将 ~970 行内联 CSS 分离为 8 个独立样式文件
- **设计系统建立**：提取 CSS 变量到 `variables.css`，统一配色和间距
- **HTML 轻量化**：`project-manager.html` 从 ~2000 行缩减至 ~1070 行
- **缓存优化**：样式文件可被浏览器独立缓存，提升加载性能
- **可维护性提升**：按功能模块组织样式，便于后续开发和维护

### v1.4 更新内容

- **模块化架构优化**：代码拆分为 11 个独立 ES Module，实现更清晰的功能分离
- **文件系统模块增强**：添加 `previewFile`、`deleteFile`、`openFsRoot` 等功能
- **文件分析模块扩展**：增加 `loadModalFilePanel`、`renderPaymentNodes` 等功能，支持更复杂的文件识别和分析
- **代码架构优化**：改进模块间依赖关系和加载流程，提高代码可维护性
- **性能优化**：增强文件操作缓存机制，提高文件处理速度

### v1.3 更新内容

- **模块化重构**：代码拆分为 9 个独立 ES Module
- **新增待办分析面板**：智能分类、多维度展示、催款任务追踪
- **AI 服务商扩展**：新增 Gemini 支持
- **沙盒调试台增强**：支持表格识别调试、模型切换
- **台账 AI 筛选**：自然语言搜索、结果缓存
- **性能优化**：IndexedDB 主存储 + localStorage 缓存

### 数据兼容性

- 数据存储键：`pm_projects_v3`
- 支持从 `pm_projects_v2`（旧版）自动迁移数据

---

## 浏览器兼容性

| 浏览器 | 支持情况 | 说明 |
|--------|----------|------|
| Chrome 86+ | ✅ 完全支持 | 推荐使用 |
| Edge 86+ | ✅ 完全支持 | 推荐使用 |
| Safari 15+ | ⚠️ 部分支持 | File System Access API 受限 |
| Firefox | ⚠️ 部分支持 | File System Access API 不支持 |

---

## 开源协议

MIT License