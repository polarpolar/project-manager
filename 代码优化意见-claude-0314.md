# 代码优化意见

> 文件：`project-manager-v1_2.html`
> 审阅日期：2025-03-14
> 审阅工具：Claude Sonnet 4.6

---

## 一、程序架构

### 1. 消除"单文件巨石"风险

7700 多行全部堆在一个 HTML 文件里，CSS、HTML 模板字符串、业务逻辑、AI 调用混在一起，维护成本随代码量指数增长。建议即便不引入构建工具，也要在逻辑上做模块切分，用注释边界明确划定每个模块的职责：

```
// ── module: data-store.js ──
// ── module: render-board.js ──
// ── module: ai-service.js ──
// ── module: file-system.js ──
```

长期可以引入 Vite + 原生 JS 模块，打包后仍是单 HTML，但开发体验和可维护性大幅提升。

---

### 2. 数据层与视图层未分离

`render()` 函数直接操作 DOM 并同时夹带业务逻辑，`save()` 函数调用了 `render()`、`renderTodosPanel()`、`renderLedger()` 三个视图函数。一旦某个视图出错，存储也会中断。建议把数据操作和视图刷新分开：

```js
// 当前：save() → render() 耦合
function save() { localStorage.set(...); render(); }

// 建议：职责分离
function save() { localStorage.set(...); }
function refreshAll() { render(); renderTodosPanel(); renderLedger(); }
```

---

### 3. 表单状态靠 DOM 读取，缺少中间层

`getPaymentNodes()`、`getCollectTasks()`、`getTodos()` 都是通过 `querySelectorAll` 遍历 DOM 来"读取"数据，本质上是把 DOM 当数据库用。这导致读取逻辑极其脆弱——只要 HTML 结构微调，选择器就可能失效。建议引入一个轻量的内存状态对象，由 JS 对象驱动视图，而不是反向从视图中读取状态。

---

### 4. `localStorage` 容量管理缺乏主动策略

代码中已有容量警告逻辑（5MB），但只是 `console.warn`，用户完全不感知。建议在 UI 上显示当前已用容量，并在接近上限时主动提示用户导出备份。

---

## 二、代码风格

### 1. 大量 `console.log` 残留在生产代码中

`onStageChange()` 里有 10+ 个 `console.log`，`save()` 里也有，这些应当在生产版本中移除或统一用一个 `debug()` 开关控制：

```js
const DEBUG = false;
const debug = (...args) => DEBUG && console.log(...args);
```

---

### 2. 中文变量名

代码中出现了 `立项材料Dir` 这样的中文变量名，虽然语法上合法，但会在某些工具链、搜索、正则处理中引发问题，建议统一用英文命名：

```js
// 当前
let 立项材料Dir;

// 建议
let projectMaterialsDir;
```

---

### 3. HTML 模板字符串缺乏转义保护（XSS 风险）

`cardHTML()` 和大量 `innerHTML` 拼接中直接插入了用户输入（如项目名称 `p.name`），只有少数地方用了 `.replace(/"/g,'&quot;')` 做处理，但没有做完整的 XSS 防御。如果用户在项目名称中输入 `<script>alert(1)</script>`，会直接执行。建议封装一个统一的转义函数：

```js
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

---

### 4. 魔法数字和魔法字符串散落各处

代码中大量出现 `stage === 1`、`stage === 0`、`'pm_projects_v3'`、`5 * 1024 * 1024` 等，建议集中定义为常量：

```js
const STAGE = {
  NEGOTIATING: 0,
  DELIVERING:  1,
  COMPLETED:   2,
  TERMINATED:  3
};

const STORAGE_KEY = {
  PROJECTS: 'pm_projects_v3',
  RECYCLE:  'pm_recycle_bin_v1'
};

const MAX_STORAGE_BYTES = 5 * 1024 * 1024;
```

---

### 5. `_fromAi: true` 硬编码在 `getPaymentNodes()` 里

```js
// 当前（永远返回 true，语义错误）
return { ..., _fromAi: true };
```

此字段本意是标记"此节点是否由 AI 生成"，但在读取函数里永远写 `true`，导致所有节点都被标记为 AI 生成。应改为从 DOM 数据集（`dataset`）读取实际标记：

```js
// 建议
_fromAi: r.dataset.fromAi === '1'
```

---

## 三、UI 设计

### 1. 四列看板在中等屏幕下布局错乱

当前 `board` 是 `grid-template-columns: repeat(3, 1fr)`，但实际上有 4 列（洽谈 / 交付 / 完结 / 终止）。"已终止"列在 3 列布局下会折到第二行，破坏看板的整体感。建议改为 4 列，或者默认折叠"已终止"列（类似 archive 概念），按需展开。

---

### 2. Pipeline 条与看板列的颜色语义不一致

Pipeline 顶部只展示 3 个状态（洽谈 / 交付 / 完结），缺少"已终止"；而看板有 4 列。这种不一致会让用户对数据总览产生困惑。建议 Pipeline 与看板列完全对应，或者 Pipeline 改为显示关键业务指标（如催款中的项目数、本月到期节点数）。

---

### 3. 卡片信息密度过高

单张卡片可能同时出现：更新时间、最新日志、元数据标签、金额行、交付标签、回款进度条、催款预览、待办预览、操作按钮，信息量超过用户的视觉处理能力。建议采用"折叠默认、悬停展开"的渐进式信息展示，卡片默认只显示项目名、负责人、客户、一条最新动态，次要信息在悬停或点击展开时才显示。

---

### 4. Modal 宽度固定 660px，在大屏上显得局促

回款节点的双列布局（目标 / 落实）在 660px 宽度下字段已经相当紧凑，可以考虑将 Modal 的 `max-width` 改为 `800px` 或使用侧滑抽屉（Drawer）替代弹窗，侧滑更适合需要频繁查阅和编辑大量字段的场景。

---

### 5. 侧边栏收起后 Tooltip 缺失

侧边栏折叠后图标仍然可以点击，但没有 Tooltip，用户需要靠记忆判断每个图标的功能。建议折叠状态下为每个按钮添加 `title` 属性或自定义 Tooltip：

```html
<!-- 建议 -->
<button class="sb-btn" title="导入 Excel" onclick="openImport()">
  <span class="sb-icon">📥</span><span class="sb-label">导入 Excel</span>
</button>
```

---

## 四、功能实现

### 1. `addCollectRow()` 在初始化时也触发 Toast 和日志（误报）

```js
function addCollectRow(task = {}) {
  // ...
  if (!task.done) {
    _appendPendingLog(`🔔 新增催款任务...`); // 编辑已有项目时也会触发
    showToast('✅ 催款任务已新增');           // 打开 Modal 就会弹 Toast
  }
}
```

当 `editProject()` 打开已有项目并恢复催款任务列表时，也会调用 `addCollectRow(task)`，从而触发 Toast 和日志写入，产生误报。需要加一个 `isNew` 参数来区分"初始化渲染"和"用户主动新增"：

```js
// 建议
function addCollectRow(task = {}, isNew = false) {
  // ...
  if (isNew && !task.done) {
    _appendPendingLog(`🔔 新增催款任务...`);
    showToast('✅ 催款任务已新增');
  }
}

// 初始化时传 false
collectTasks.forEach(t => addCollectRow(t, false));

// 用户点击新增时传 true
// onclick="addCollectRow({}, true)"
```

---

### 2. 二进制文件复制时使用 `.text()` 导致文件损坏

```js
// 当前（❌ 对二进制文件是破坏性操作）
const fileContent = await (await file.handle.getFile()).text();
await writable.write(fileContent);
```

`organizeFilesForProjectStart()` 中把所有文件都用 `.text()` 读取再写入，这对 PDF、DOCX、图片等二进制文件是破坏性操作，文件内容会损坏。应改为 `arrayBuffer()`：

```js
// 建议（✅ 正确读取二进制）
const fileContent = await (await file.handle.getFile()).arrayBuffer();
await writable.write(fileContent);
```

---

### 3. 回收站面板操作后不刷新自身 UI

`restoreFromRecycleBin()` 和 `deleteFromRecycleBin()` 调用了 `save()` 刷新看板，但回收站面板本身的 DOM 不会重新渲染，用户需要手动关闭再重新打开才能看到更新后的列表。建议在操作后调用一个 `renderRecycleBin()` 函数原地刷新面板内容：

```js
function restoreFromRecycleBin(id) {
  // ... 现有逻辑 ...
  save();
  showToast('项目已从回收站恢复');
  renderRecycleBin(); // 新增：原地刷新面板
}
```

---

### 4. 台账 AI 筛选无防抖，存在并发请求风险

`ledgerAiSearch()` 每次回车就直接发起 AI 请求，没有防抖或 loading 锁，用户快速按多次 Enter 会发起多个并发请求。建议加一个简单的锁：

```js
let ledgerAiPending = false;

async function ledgerAiSearch() {
  if (ledgerAiPending) return;
  ledgerAiPending = true;
  try {
    // ... 现有逻辑 ...
  } finally {
    ledgerAiPending = false;
  }
}
```

---

### 5. 合同日期每次变动都立即写入日志，日志膨胀严重

`onContractDateChange()` 在用户每次修改合同日期时都会立刻写入 `localStorage` 并追加一条日志，这意味着用户在日期选择器上每点击一次都会产生一条"合同签署日期更新"的日志记录，日志会迅速膨胀。建议将"保存并写日志"推迟到用户点击"保存"按钮时统一处理，`onContractDateChange()` 只做 UI 预览：

```js
// 建议：onContractDateChange 只更新编号预览，不写 localStorage 和日志
function onContractDateChange() {
  // 仅更新编号显示，不调用 save()，不追加日志
  updateCodePreview();
}

// 在 saveProject() 中统一处理日期变更日志
function saveProject() {
  const p = projects.find(x => x.id === editingId);
  if (p && p.contractDate !== newContractDate) {
    p.logs.push({ time: now(), text: `📝 合同签署日期更新为 ${newContractDate}` });
  }
  // ...
}
```

---

## 优先级汇总

| 优先级 | 问题 | 类型 |
|--------|------|------|
| 🔴 高  | 二进制文件复制损坏（Bug） | 功能实现 |
| 🔴 高  | XSS 风险（innerHTML 未转义） | 代码风格 |
| 🔴 高  | `addCollectRow` 初始化误触发 Toast/日志 | 功能实现 |
| 🟡 中  | 回收站 UI 不自刷新 | 功能实现 |
| 🟡 中  | 台账 AI 筛选无并发锁 | 功能实现 |
| 🟡 中  | 合同日期变动频繁写日志 | 功能实现 |
| 🟡 中  | 四列看板布局错乱 | UI 设计 |
| 🟡 中  | `console.log` 残留 | 代码风格 |
| 🟢 低  | 魔法数字/字符串 | 代码风格 |
| 🟢 低  | 中文变量名 | 代码风格 |
| 🟢 低  | 侧边栏折叠无 Tooltip | UI 设计 |
| 🟢 低  | 数据层与视图层耦合 | 程序架构 |
| 🟢 低  | `_fromAi` 硬编码 true | 代码风格 |
