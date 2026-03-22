删除代码容易出错，建议按以下阶段执行，每步都有验证手段：

***

## 🛡️ 分阶段删除方案

### 阶段 1：删除侧边栏按钮（最安全）

**操作**：

```html
<!-- 删除第674行 -->
<button class="sb-btn" onclick="openFsRoot()">
  <span class="sb-icon">📁</span><span class="sb-label">项目文件</span>
</button>
```

**验证手段**：

```javascript
// 控制台检查
console.log(typeof openFsRoot);  // 应该还是 "function"，未删除

// 手动测试
// 1. 刷新页面，应该能正常加载
// 2. 侧边栏不再显示"📁 项目文件"按钮
// 3. 其他按钮（新建项目、待办分析等）正常可用
```

**回滚**：如果出问题，恢复这一行按钮代码即可。

***

### 阶段 2：注释掉 `file-system-module.js` 中的调用

**操作**：将3处 `loadFilePanel` 调用注释掉（不要删除，方便恢复）

```javascript
// 第14行
// if (window.fsCurrentProjectId) await loadFilePanel(window.fsCurrentProjectId);

// 第153行
// await loadFilePanel(projectId);

// 第201行
// await loadFilePanel(projectId);
```

**验证手段**：

```javascript
// 测试文件系统基础功能
// 1. 选择根目录（应该还能工作，只是不刷新）
await selectRootDir();

// 2. 检查 IndexedDB 中是否保存了句柄
// 打开浏览器 DevTools → Application → IndexedDB → pmFilesDB → handles

// 3. 检查项目编辑弹窗的"本地文件"Tab是否还能显示文件
// 打开一个项目 → 切换到"本地文件"Tab → 应该能看到文件列表
```

**预期现象**：

- 上传/删除文件后，侧边栏面板**不会自动刷新**（因为调用了被注释的函数）
- 但文件实际上传/删除成功了（可以通过重新打开项目验证）

***

### 阶段 3：删除 HTML 中的 `filePanel` DOM 结构

**操作**：删除 `<div id="filePanel">...</div>` 整个块（约100行）

**验证手段**：

```javascript
// 控制台检查DOM是否存在
document.getElementById('filePanel');  // 应该返回 null

// 检查是否有JS报错（因为可能有代码尝试访问这些DOM）
// 打开控制台，看是否有红色错误：
// - "Cannot read property '...' of null"
// - "getElementById(...) is null"
```

**重点检查**：

- 项目编辑弹窗是否正常打开
- 其他面板（待办分析、台账）是否正常
- 页面是否能正常加载不报错

***

### 阶段 4：删除 JavaScript 函数（分小步）

**建议顺序**：

#### 4.1 先删除拖拽相关函数（风险低）

```javascript
// 删除：dragStart, dragEnd, dragOver, drop
```

**验证**：

```javascript
// 尝试在页面上拖拽
// 应该没有任何反应（因为事件处理器已被删除）
// 控制台无报错
```

#### 4.2 删除 AI 分类按钮相关

```javascript
// 删除：classifyFilesWithAI
```

**验证**：

```javascript
console.log(typeof classifyFilesWithAI);  // 应该返回 "undefined"
// 页面无报错
```

#### 4.3 删除文件操作函数

```javascript
// 删除：openFolder, triggerFileUpload, saveNote, closeFilePanel, openFsRoot
```

**验证**：

```javascript
// 检查这些函数是否还存在
console.log(typeof openFsRoot);        // "undefined"
console.log(typeof closeFilePanel);    // "undefined"
console.log(typeof saveNote);          // "undefined"
```

#### 4.4 最后删除核心函数（风险最高）

```javascript
// 删除：loadFilePanel, renderFileSection
```

**验证**：

```javascript
// 最重要：检查项目编辑弹窗是否还能工作
// 1. 打开项目编辑弹窗
// 2. 切换到"本地文件"Tab
// 3. 应该能看到文件列表（由 loadModalFilePanel 渲染）

// 检查函数是否还存在
console.log(typeof loadFilePanel);      // "undefined"
console.log(typeof renderFileSection);  // "undefined"
console.log(typeof loadModalFilePanel); // "function" ✅ 应该还存在！
```

***

### 阶段 5：清理 `file-system-module.js`

**操作**：

1. 删除 `setupFileDrop` 函数
2. 更新 export 列表
3. （可选）删除 `uploadFiles`, `deleteFile`, `previewFile` 如果不再使用

**验证手段**：

```javascript
// 测试文件系统核心功能
// 1. 选择根目录
await selectRootDir();

// 2. 检查是否能获取项目目录
const dir = await getProjectDir("项目名称");
console.log(dir);  // 应该返回 DirectoryHandle 或 null

// 3. 检查项目编辑弹窗的文件显示
// 打开项目 → 本地文件Tab → 应该正常显示
```

***

## 🔄 每阶段的回滚策略

| 阶段 | 回滚方法            | 时间成本 |
| :- | :-------------- | :--- |
| 1  | 恢复按钮HTML        | 1分钟  |
| 2  | 取消注释3行代码        | 1分钟  |
| 3  | 恢复filePanel DOM | 5分钟  |
| 4  | 恢复JS函数（从git）    | 5分钟  |
| 5  | 恢复整个文件          | 10分钟 |

***

## ⚠️ 关键检查点

### 必须验证的功能（每阶段后都要检查）：

```javascript
// 检查清单
□ 页面能正常加载，无控制台报错
□ 项目编辑弹窗能正常打开
□ 项目编辑弹窗的"本地文件"Tab能显示文件
□ 选择根目录功能正常
□ 新建/编辑/删除项目功能正常
□ 台账和待办分析面板正常
```

### 危险信号（立即停止）：

```
❌ 控制台出现红色报错
❌ 项目编辑弹窗打不开
❌ 文件列表无法显示
❌ 页面白屏或卡顿
```

