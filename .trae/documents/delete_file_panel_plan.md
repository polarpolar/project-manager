# 删除项目文件面板功能 - 实施计划

## 项目背景

当前项目包含两个文件面板：

1. 侧边栏的项目文件面板（通过`openFsRoot()`打开）
2. 项目编辑弹窗中的本地文件标签页

根据需求，我们需要删除侧边栏的项目文件面板功能，只保留项目编辑弹窗中的本地文件标签页。

## 任务列表

### \[x] 任务1：删除侧边栏项目文件按钮

* **Priority**: P0

* **Depends On**: None

* **Description**:

  * 删除项目管理器侧边栏中的"📁 项目文件"按钮

  * 该按钮位于`project-manager.html`第674行

* **Success Criteria**:

  * 侧边栏不再显示"📁 项目文件"按钮

  * 其他侧边栏按钮功能正常

* **Test Requirements**:

  * `programmatic` TR-1.1: 刷新页面后，侧边栏不显示"📁 项目文件"按钮

  * `human-judgment` TR-1.2: 其他侧边栏功能（新建项目、待办分析、台账等）正常可用

* **Notes**: 这是最安全的第一步，即使出错也容易恢复

### \[x] 任务2：注释file-system-module.js中的loadFilePanel调用

* **Priority**: P0

* **Depends On**: 任务1

* **Description**:

  * 注释掉`file-system-module.js`中3处`loadFilePanel`调用

  * 第14行、第153行、第201行

* **Success Criteria**:

  * 3处调用被成功注释

  * 页面加载无报错

* **Test Requirements**:

  * `programmatic` TR-2.1: 检查3处调用是否被正确注释

  * `human-judgment` TR-2.2: 验证项目编辑弹窗的"本地文件"Tab仍能正常显示文件

* **Notes**: 注释而不是删除，方便后续恢复

### \[x] 任务3：删除HTML中的filePanel DOM结构

* **Priority**: P1

* **Depends On**: 任务2

* **Description**:

  * 删除`project-manager.html`中`<div id="filePanel">...</div>`整个块

  * 大约从第1267行到第1367行

* **Success Criteria**:

  * filePanel DOM结构被完全删除

  * 页面加载无报错

* **Test Requirements**:

  * `programmatic` TR-3.1: `document.getElementById('filePanel')`返回null

  * `human-judgment` TR-3.2: 项目编辑弹窗正常打开，其他面板功能正常

* **Notes**: 这是一个较大的删除操作，需要谨慎执行

### \[x] 任务4：删除拖拽相关JavaScript函数

* **Priority**: P1

* **Depends On**: 任务3

* **Description**:

  * 删除`project-manager.html`中的拖拽相关函数：`dragStart`, `dragEnd`, `dragOver`, `drop`

* **Success Criteria**:

  * 拖拽相关函数被完全删除

  * 页面加载无报错

* **Test Requirements**:

  * `programmatic` TR-4.1: 检查这些函数是否已不存在

  * `human-judgment` TR-4.2: 页面上拖拽操作无反应但无报错

* **Notes**: 这些函数只与主文件面板相关，删除风险较低

### \[x] 任务5：删除AI分类按钮相关函数

* **Priority**: P1

* **Depends On**: 任务4

* **Description**:

  * 删除`project-manager.html`中的`classifyFilesWithAI`函数

* **Success Criteria**:

  * `classifyFilesWithAI`函数被完全删除

  * 页面加载无报错

* **Test Requirements**:

  * `programmatic` TR-5.1: `typeof classifyFilesWithAI`返回"undefined"

  * `human-judgment` TR-5.2: 页面无报错

* **Notes**: 此函数仅用于主文件面板的AI分类功能

### [x] 任务6：删除文件操作相关函数
- **Priority**: P1
- **Depends On**: 任务5
- **Description**:
  - 删除`project-manager.html`中的文件操作函数：`openFolder`, `triggerFileUpload`, `saveNote`, `closeFilePanel`
  - 保留`openFsRoot`函数

* **Success Criteria**:

  * 这些文件操作函数被完全删除

  * 页面加载无报错

* **Test Requirements**:

  * `programmatic` TR-6.1: 检查这些函数是否已不存在

  * `human-judgment` TR-6.2: 页面无报错

* **Notes**: 这些函数只与主文件面板相关

### [x] 任务7：删除核心文件面板函数

* **Priority**: P2

* **Depends On**: 任务6

* **Description**:

  * 删除`project-manager.html`中的核心文件面板函数：`loadFilePanel`, `renderFileSection`

* **Success Criteria**:

  * 核心文件面板函数被完全删除

  * 项目编辑弹窗的"本地文件"Tab仍能正常工作

* **Test Requirements**:

  * `programmatic` TR-7.1: `typeof loadFilePanel`和`typeof renderFileSection`返回"undefined"

  * `human-judgment` TR-7.2: 项目编辑弹窗的"本地文件"Tab能正常显示文件

* **Notes**: 这是风险较高的操作，需要确保不影响项目编辑弹窗的功能

### [x] 任务8：清理file-system-module.js

* **Priority**: P2

* **Depends On**: 任务7

* **Description**:

  * 删除`file-system-module.js`中的`setupFileDrop`函数

  * 更新export列表，移除不再使用的函数

  * 可选：删除`uploadFiles`, `deleteFile`, `previewFile`函数

* **Success Criteria**:

  * `setupFileDrop`函数被删除

  * export列表更新正确

  * 页面加载无报错

* **Test Requirements**:

  * `programmatic` TR-8.1: 检查`setupFileDrop`函数是否已不存在

  * `human-judgment` TR-8.2: 验证项目编辑弹窗的"本地文件"Tab仍能正常显示文件

* **Notes**: 确保保留项目编辑弹窗所需的核心文件系统功能

### [/] 任务9：验证所有功能

* **Priority**: P0

* **Depends On**: 任务8

* **Description**:

  * 全面验证所有功能是否正常

  * 重点检查项目编辑弹窗的"本地文件"Tab功能

* **Success Criteria**:

  * 页面能正常加载，无控制台报错

  * 项目编辑弹窗能正常打开

  * 项目编辑弹窗的"本地文件"Tab能显示文件

  * 选择根目录功能正常

  * 新建/编辑/删除项目功能正常

  * 台账和待办分析面板正常

* **Test Requirements**:

  * `programmatic` TR-9.1: 控制台无红色报错

  * `human-judgment` TR-9.2: 所有主要功能正常可用

* **Notes**: 这是最终验证步骤，确保删除操作没有破坏其他功能

## 实施策略

1. **分阶段执行**：按照任务优先级和依赖关系逐步执行
2. **每步验证**：完成每个任务后立即验证相关功能
3. **备份恢复**：保留原始代码备份，以便出现问题时快速恢复
4. **重点保护**：确保项目编辑弹窗的"本地文件"Tab功能不受影响

## 风险评估

| 任务  | 风险等级 | 风险描述                              | 缓解措施                                                            |
| :-- | :--- | :-------------------------------- | :-------------------------------------------------------------- |
| 任务3 | 高    | 删除大量HTML代码可能影响其他功能                | 仔细确认删除范围，只删除filePanel相关代码                                       |
| 任务7 | 高    | 删除核心函数可能影响项目编辑弹窗                  | 确保只删除`loadFilePanel`和`renderFileSection`，保留`loadModalFilePanel` |
| 任务8 | 中    | 修改file-system-module.js可能影响文件系统功能 | 仔细检查export列表，保留必要的函数                                            |

## 预期结果

* 成功删除侧边栏的项目文件面板功能

* 保留项目编辑弹窗中的本地文件标签页功能

* 页面加载速度可能略有提升（减少了不必要的代码）

* 代码结构更加清晰，只保留必要的功能

