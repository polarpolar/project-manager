# 架构优化方案：消除单文件巨石

> 基于 `project-manager-v1_2.html`（7772 行）深度分析
> 输出日期：2025-03-14

---

## 一、现状诊断

通读全文后，代码实际上已经有清晰的功能边界，只是物理上全部挤在一个文件里。按功能划分，现有代码可以识别出以下 **9 个内聚模块**：

| 行号范围 | 内容 |
|----------|------|
| 1 – 670 | CSS 样式（约 670 行） |
| 671 – 1648 | HTML 模板结构（看板、Modal、侧边栏、各面板） |
| 1650 – 1755 | 数据初始化 & 持久化（`projects`、`recycleBin`、`save()`） |
| 1756 – 1970 | 项目增删改查 & 回收站 |
| 1971 – 2201 | 看板渲染（`render()`、`cardHTML()`） |
| 2202 – 3070 | Modal 表单（新建/编辑/保存项目、Tab 切换、回款节点、待办） |
| 3071 – 3620 | Excel & 语雀导入 |
| 4334 – 4565 | 待办分析 & 台账（`renderTodosPanel`、`renderLedger`） |
| 4566 – 4872 | AI 服务（`claudeCall`、多服务商配置、监控日志） |
| 4915 – 7768 | 文件系统（File System Access API、文件分类、AI 识别、沙盒） |

---

## 二、目标架构

拆分后仍然保持**零构建工具、单 HTML 文件可运行**的特性，采用原生 ES Module（`<script type="module">`）在浏览器中直接实现模块化。

### 推荐目录结构

```
project-manager/
│
├── index.html              ← 只保留 HTML 骨架和 <script type="module"> 入口
│
├── styles/
│   ├── base.css            ← 变量、Reset、全局字体
│   ├── layout.css          ← 侧边栏、看板布局
│   ├── card.css            ← 项目卡片
│   ├── modal.css           ← Modal / 表单 / Tab
│   ├── panels.css          ← 侧边栏面板（台账、待办、文件）
│   └── monitor.css         ← AI 监控 / 沙盒调试台
│
├── modules/
│   ├── store.js            ← 数据层：读写 localStorage、回收站
│   ├── render-board.js     ← 看板渲染：render()、cardHTML()
│   ├── modal-form.js       ← Modal 表单：openModal()、editProject()、saveProject()
│   ├── payment.js          ← 回款节点：addPaymentNode()、getPaymentNodes()、calcCollected…
│   ├── import.js           ← Excel & 语雀导入
│   ├── ledger.js           ← 台账渲染 & AI 筛选
│   ├── todos-panel.js      ← 待办分析面板
│   ├── ai-service.js       ← claudeCall()、多服务商、监控日志
│   └── file-system.js      ← File System Access API、文件分类、AI 文件识别
│
└── main.js                 ← 入口：组装各模块、绑定全局事件、初始化
```

> **说明**：如果你不想引入多文件开发工具，可以先不拆分物理文件，只在现有单文件中按模块添加清晰的注释边界（见第三节），等到代码量继续增长时再做物理拆分。

---

## 三、过渡方案（不改变部署方式）

如果暂时不想引入多文件结构，可以先做**逻辑分层**，在同一个文件内按严格的区块顺序重组代码，效果等同于模块化：

```html
<script>
// ╔══════════════════════════════════════════╗
// ║  MODULE: constants                       ║
// ╚══════════════════════════════════════════╝
const STAGE = { NEGOTIATING: 0, DELIVERING: 1, COMPLETED: 2, TERMINATED: 3 };
const STORAGE_KEY = { PROJECTS: 'pm_projects_v3', RECYCLE: 'pm_recycle_bin_v1' };
// ...

// ╔══════════════════════════════════════════╗
// ║  MODULE: store（数据层，无 DOM 依赖）     ║
// ╚══════════════════════════════════════════╝
// 只允许读写 localStorage，不允许出现任何 document.getElementById
// ...

// ╔══════════════════════════════════════════╗
// ║  MODULE: ai-service（AI 调用层）          ║
// ╚══════════════════════════════════════════╝
// 只允许调用 claudeCall，不允许直接操作 DOM
// ...

// ╔══════════════════════════════════════════╗
// ║  MODULE: render（视图层）                 ║
// ╚══════════════════════════════════════════╝
// 只允许读取 store 的数据，输出 HTML 字符串
// ...

// ╔══════════════════════════════════════════╗
// ║  MODULE: controllers（交互层）            ║
// ╚══════════════════════════════════════════╝
// 连接视图事件和数据层，是唯一允许同时调用 store 和 render 的地方
// ...
</script>
```

---

## 四、各模块职责详细定义

### 4.1 `store.js` — 数据层（最核心）

**规则：这个模块不允许出现任何 DOM 操作。**

```js
// store.js

// ── 状态 ──
export let projects  = [];
export let recycleBin = [];

// ── 初始化（应用启动时调用一次）──
export function initStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY.PROJECTS);
    projects  = raw ? JSON.parse(raw) : migrateFromV2();
    const rb  = localStorage.getItem(STORAGE_KEY.RECYCLE);
    recycleBin = rb ? JSON.parse(rb) : [];
  } catch(e) {
    projects = []; recycleBin = [];
  }
}

// ── 持久化（只写数据，不触发任何视图刷新）──
export function persist() {
  localStorage.setItem(STORAGE_KEY.PROJECTS, JSON.stringify(projects));
  localStorage.setItem(STORAGE_KEY.RECYCLE,  JSON.stringify(recycleBin));
}

// ── 业务操作 ──
export function addProject(data)           { projects.push(data);     persist(); }
export function updateProject(id, patch)   { /* ...merge... */         persist(); }
export function moveToRecycleBin(id)       { /* ...splice + push... */ persist(); }
export function restoreFromRecycleBin(id)  { /* ...splice + push... */ persist(); }
export function deleteFromRecycleBin(id)   { /* ...splice... */        persist(); }
```

**当前代码中需要迁移到这里的函数：**
- `save()`（只保留持久化部分，去掉 `render()` 调用）
- `moveToRecycleBin()`
- `restoreFromRecycleBin()`
- `deleteFromRecycleBin()`
- `emptyRecycleBin()`
- `genProjectCode()`、`updateCodePrefix()`

---

### 4.2 `ai-service.js` — AI 调用层

**规则：只负责与 AI API 通信，不操作 DOM，不读取表单值。**

```js
// ai-service.js

export const AI_PROVIDERS = { /* 现有的 claude/openai/gemini/custom 配置 */ };

export function getAiConfig() { /* 从 localStorage 读取 */ }

export async function claudeCall({ task, messages, max_tokens }) {
  // 现有逻辑，保持不变
  // 返回统一格式 { text, usage, error }
}

// AI 监控日志（与 DOM 无关，只读写 localStorage）
export function appendAiLog(log) { /* ... */ }
export function getAiLogs()      { /* ... */ }
export function clearAiLogs()    { /* ... */ }
```

**当前代码中需要迁移到这里的函数：**
- `claudeCall()`（约 50 行，几乎不改动）
- `AI_PROVIDERS` 对象（约 100 行）
- `TASK_MODEL_OVERRIDE`
- `getAiConfig()`、`saveAiProxy()`、`saveAiKey()` 等配置存取函数
- `aiLogs` 数组及相关读写逻辑

---

### 4.3 `file-system.js` — 文件系统层

**规则：只负责 File System Access API 操作，不关心 AI 解析的具体内容格式。**

```js
// file-system.js

export let fsRootHandle = null;

export async function selectRootDir()            { /* 现有逻辑 */ }
export async function getProjectDir(projectName) { /* 现有逻辑 */ }
export async function renameProjectDir(old, new_) { /* 现有逻辑，修复二进制复制 Bug */ }
export async function uploadFiles(files, dir)    { /* 现有逻辑 */ }
export async function deleteFile(projectId, fileName) { /* 现有逻辑 */ }
export function saveRootHandle(handle)           { /* IndexedDB 存储 */ }
export function loadRootHandle()                 { /* IndexedDB 读取 */ }
```

**当前代码中需要迁移到这里的函数：**
- `selectRootDir()`
- `getProjectDir()`
- `renameProjectDir()`（同时修复二进制文件复制 Bug）
- `saveRootHandle()`、`loadRootHandle()`
- `uploadFiles()`、`deleteFile()`
- `organizeFilesForProjectStart()`

---

### 4.4 `render-board.js` — 看板视图层

**规则：只读取 `store.projects`，输出 HTML 字符串或直接操作看板区域的 DOM，不操作 Modal。**

```js
// render-board.js
import { projects } from './store.js';

export function renderBoard() {
  // 现有 render() 的看板部分
}

export function cardHTML(p, colKey) {
  // 现有逻辑，但所有 p.name 等插值都需要通过 esc() 转义
}
```

**当前代码中需要迁移到这里的函数：**
- `render()`（拆分为 `renderBoard()` + `renderSidebarStats()`）
- `cardHTML()`
- `getBoardColumn()`
- `hasOpenCollect()`
- `fmtWan()`、`fmtYuan()`、`fmtWanShort()`
- `STAGE_LABEL`、`STAGE_SHORT`、`STAGE_COLOR`、`STAGE_S_ATTR` 常量

---

### 4.5 `modal-form.js` — Modal 表单控制器

**规则：负责 Modal 的打开/关闭/填充/读取，调用 store 保存，不包含业务计算逻辑。**

```js
// modal-form.js
import { projects, addProject, updateProject } from './store.js';
import { renderBoard } from './render-board.js';

export function openModal()      { /* 清空表单、打开 Modal */ }
export function editProject(id)  { /* 填充表单 */ }
export function saveProject()    { /* 读取表单、调用 store */ }
export function closeModal()     { /* 关闭 Modal */ }
export function switchModalTab() { /* Tab 切换 */ }
export function onStageChange()  { /* 字段显隐，去掉所有 console.log */ }
```

**当前代码中需要迁移到这里的函数：**
- `openModal()`、`editProject()`、`saveProject()`、`closeModal()`
- `switchModalTab()`、`switchModalTabById()`
- `onStageChange()`（去掉全部 `console.log`）
- `onContractDateChange()`（改为只做预览，不再立即写 localStorage）
- `renderLogHistory()`
- `syncMirrorFields()`、`updatePaymentPct()`

---

### 4.6 `payment.js` — 回款节点子模块

这是 Modal 里最复杂的子模块，逻辑独立性强，单独拆出。

```js
// payment.js

export function addPaymentNode(node, fromAi)     { /* 渲染一行节点 */ }
export function removePaymentNode(btn)           { /* 删除一行 */ }
export function getPaymentNodes()                { /* 从 DOM 读取，返回数组 */ }
export function addCollectRow(task, isNew=false) { /* 修复：isNew 控制 Toast/日志 */ }
export function getCollectTasks()                { /* 从 DOM 读取，返回数组 */ }
export function calcCollectedFromNodes(nodes)    { /* 纯计算，无 DOM 依赖 */ }
export function onPnActualInput(input)           { /* 联动计算 */ }
export function onPnDoneToggle(wrap)             { /* 完成状态切换 */ }
export function syncCollectedFromNodes()         { /* 汇总到 f-collected */ }
```

---

### 4.7 `import.js` — 数据导入

```js
// import.js
import { claudeCall } from './ai-service.js';
import { projects, addProject, updateProject } from './store.js';

export function openImport()    { /* 打开导入面板 */ }
export function closeImport()   { /* 关闭 */ }
export async function parseExcel(buf, filename) { /* 现有逻辑 */ }
export function confirmImport() { /* 批量写入 store */ }
export async function fetchYuqueDoc()    { /* 语雀 API 调用 */ }
export function confirmYuqueImport()     { /* 批量写入 store */ }
export function downloadTemplate()       { /* 下载 Excel 模板 */ }
```

---

### 4.8 `ledger.js` — 台账

```js
// ledger.js
import { projects } from './store.js';
import { claudeCall } from './ai-service.js';

export function openLedger()    { /* 打开台账面板 */ }
export function closeLedger()   { /* 关闭 */ }
export function renderLedger()  { /* 渲染表格 */ }
export async function ledgerAiSearch() {
  // 修复：加并发锁
  if (ledgerAiPending) return;
  ledgerAiPending = true;
  try { /* ... */ } finally { ledgerAiPending = false; }
}
```

---

### 4.9 `main.js` — 应用入口（组装者）

```js
// main.js
import { initStore, projects } from './modules/store.js';
import { renderBoard }         from './modules/render-board.js';
import { loadRootHandle }      from './modules/file-system.js';

// 1. 初始化数据
initStore();

// 2. 首次渲染
renderBoard();

// 3. 恢复文件系统根目录
(async () => {
  const saved = await loadRootHandle();
  if (saved) { /* 恢复权限 */ }
})();

// 4. 绑定全局事件（只有跨模块的事件在这里注册）
document.getElementById('confirmOkBtn').onclick = /* ... */;
```

---

## 五、模块间依赖关系图

```
main.js
  ├── store.js           ← 最底层，零依赖
  ├── ai-service.js      ← 依赖 store（读取配置）
  ├── file-system.js     ← 依赖 store（读取项目信息）
  │
  ├── render-board.js    ← 依赖 store
  │
  ├── modal-form.js      ← 依赖 store、render-board
  │   └── payment.js     ← 依赖 store、ai-service（合同识别）
  │
  ├── import.js          ← 依赖 store、ai-service
  ├── ledger.js          ← 依赖 store、ai-service
  └── todos-panel.js     ← 依赖 store
```

**核心约束：**
- `store.js` 不能依赖任何其他模块
- `ai-service.js` 不能依赖任何视图模块
- 视图模块只能向下依赖（不能循环依赖）

---

## 六、CSS 拆分方案

CSS 670 行，但内部结构已经很清晰，按组件拆分即可：

| 文件 | 内容 | 大概行数 |
|------|------|----------|
| `base.css` | `:root` CSS 变量、`*` Reset、`body` 布局 | ~30 行 |
| `layout.css` | `#sidebar`、`#content`、Pipeline 条 | ~120 行 |
| `card.css` | `.card`、`.card-*`、回款进度条、催款预览 | ~100 行 |
| `modal.css` | `.overlay`、`.modal`、`.form-group`、Modal Tab、回款节点 `.pn-*` | ~200 行 |
| `panels.css` | 台账 `.ledger-*`、待办 `.side-panel`、文件面板 `.file-*` | ~150 行 |
| `monitor.css` | AI 监控 `.monitor-*`、沙盒 `.sbx-*`、对话气泡 | ~80 行 |

---

## 七、实施步骤建议

建议按以下顺序进行，每一步都可以单独提交、验证功能后再进行下一步：

**第一阶段：最小风险改动（1-2天）**
1. 在现有单文件中按模块注释边界重组代码顺序，不改任何逻辑
2. 将全局常量（`STAGE`、`STORAGE_KEY` 等）提取到文件顶部
3. 去掉所有 `console.log`，用 `DEBUG` 开关替代
4. 修复三个高优先级 Bug（二进制文件、addCollectRow 误触发、XSS 转义）

**第二阶段：提取无 DOM 依赖的模块（2-3天）**
1. 将 `store.js` 的内容（数据读写、`persist()`）从 `save()` 里剥离出来
2. 将 `ai-service.js` 的内容（`claudeCall`、`AI_PROVIDERS`）单独聚合
3. 验证：AI 调用和数据保存功能正常

**第三阶段：引入 ES Module（可选，3-5天）**
1. 将单文件中的模块代码逐个剪切到独立 `.js` 文件
2. 将 `<script>` 改为 `<script type="module" src="main.js">`
3. 逐模块添加 `export`/`import`，解决循环依赖
4. 本地用 `python -m http.server` 或 VS Code Live Server 测试（ES Module 需要 HTTP 协议）

**第四阶段：CSS 拆分（1天）**
1. 将 CSS 按组件切分到独立文件
2. 用 `<link rel="stylesheet">` 引入各 CSS 文件

> **注意：** 第三阶段引入 ES Module 后，应用就不能再直接双击 HTML 文件打开了（浏览器会报 CORS 错误），需要通过本地服务器或打包工具运行。如果双击打开是硬性要求，只做前两个阶段的逻辑重组即可，不做物理文件拆分。

---

## 八、关于是否引入构建工具

| 方案 | 优点 | 缺点 | 适合场景 |
|------|------|------|----------|
| 纯逻辑重组（不拆文件） | 零学习成本，部署方式不变 | 文件还是很长，只是更整齐 | 个人使用、不打算长期迭代 |
| ES Module 多文件（无构建） | 真正的模块隔离，无需学习构建工具 | 需要本地服务器才能运行 | 有本地服务器环境、团队协作 |
| Vite + 打包 | 最完整的工程化，打包后仍是单 HTML | 需要 Node.js 环境，有学习成本 | 长期维护、代码量继续增长 |

基于你的工程特点（单 HTML 文件、无后端、个人/小团队使用），**建议先做第一和第二阶段**，效果立竿见影，风险极低，不改变任何部署和使用方式。等代码量增长到 1 万行以上，或者开始多人协作时，再考虑第三阶段。
