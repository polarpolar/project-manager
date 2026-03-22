<br />

***

## 📋 删除清单

### 1. HTML 结构（`project-manager.html`）

| 行号范围      | 内容                                               | 说明             |
| :-------- | :----------------------------------------------- | :------------- |
| 674       | `<button class="sb-btn" onclick="openFsRoot()">` | 侧边栏"📁 项目文件"按钮 |
| 1267-1367 | `<div id="filePanel">...</div>`                  | 整个文件面板 DOM 结构  |
| 542-551   | `#filePanel` 和 `.file-drop-zone` 样式              | CSS 样式（可选保留）   |

**包含的 DOM 元素 ID**：

- `filePanel`, `filePanelTitle`
- `fsRootBar`, `fsRootPath`
- `aiClassifyBtn`, `aiClassifyLoading`
- `fileDropZone`, `fileUploadInput`
- `contractFileGrid`, `contractEmpty`, `contractAnalyzeBtn`
- `agreementFileGrid`, `agreementEmpty`, `agreementAnalyzeBtn`
- `quoteFileGrid`, `quoteEmpty`, `quoteAnalyzeBtn`
- `otherFileGrid`, `otherEmpty`
- `fileNoteText`, `fileNoteSaveStatus`

***

### 2. JavaScript 函数（`project-manager.html`）

| 函数名                     | 起始行号 | 说明         |
| :---------------------- | :--- | :--------- |
| `loadFilePanel()`       | 4939 | **核心加载函数** |
| `renderFileSection()`   | 5259 | 渲染函数       |
| `openFolder()`          | 5142 | 打开文件夹（未完成） |
| `classifyFilesWithAI()` | 5164 | AI 分类按钮处理  |
| `dragStart()`           | 5204 | 拖拽开始       |
| `dragEnd()`             | 5212 | 拖拽结束       |
| `dragOver()`            | 5217 | 拖拽经过       |
| `drop()`                | 5222 | 拖拽放置       |
| `triggerFileUpload()`   | 6384 | 触发上传       |
| `saveNote()`            | 6389 | 保存备注       |
| `closeFilePanel()`      | 6481 | 关闭面板       |
| `openFsRoot()`          | 6487 | 打开面板入口     |

***

### 3. `file-system-module.js` 中的修改

| 位置        | 操作        | 说明                                                             |
| :-------- | :-------- | :------------------------------------------------------------- |
| 第14行      | **删除或注释** | `loadFilePanel` 调用                                             |
| 第153行     | **删除或注释** | `uploadFiles` 中的调用                                             |
| 第201行     | **删除或注释** | `deleteFile` 中的调用                                              |
| 第274-308行 | **可选删除**  | `setupFileDrop()` 函数                                           |
| export列表  | **移除**    | 导出 `uploadFiles`, `deleteFile`, `previewFile`, `setupFileDrop` |

**修改后的** **`file-system-module.js`** **导出**：

```javascript
export {
  selectRootDir,
  saveRootHandle,
  loadRootHandle,
  updateRootBar,
  getProjectDir,
  renameProjectDir,
  clearFileOperationCache
  // 移除：uploadFiles, deleteFile, previewFile, setupFileDrop
};
```

***

### 4. 相关全局变量

| 变量名                  | 位置                         | 操作                |
| :------------------- | :------------------------- | :---------------- |
| `fsRootHandle`       | `file-system-module.js` 顶部 | **保留**（项目编辑弹窗需要）  |
| `fsCurrentProjectId` | 全局                         | **可删除**           |
| `fileClassifyCache`  | `ai-module.js`             | **可删除**（如果不再分类文件） |
| `fileOperationCache` | `file-system-module.js`    | **可删除**           |

***

### 5. 保留的功能（项目编辑弹窗需要）

以下功能需要**保留**，因为项目编辑弹窗（Modal）的"本地文件"Tab仍在使用：

| 功能                         | 位置                      |
| :------------------------- | :---------------------- |
| `loadModalFilePanel()`     | `project-manager.html`  |
| `renderModalFileSection()` | `project-manager.html`  |
| `getProjectDir()`          | `file-system-module.js` |
| `readDocxText()`           | `file-system-module.js` |
| `selectRootDir()`          | `file-system-module.js` |
| `updateRootBar()`          | `file-system-module.js` |

***

## 📊 删除前后对比

| 维度      | 删除前         | 删除后      |
| :------ | :---------- | :------- |
| HTML 行数 | \~6457 行    | \~6300 行 |
| JS 函数数量 | \~15 个函数    | \~3 个函数  |
| 文件面板    | 2 个（侧边栏+弹窗） | 1 个（仅弹窗） |
| 文件上传入口  | 侧边栏+弹窗      | 仅弹窗      |

***

建议分步骤：

1. 先删除 HTML 结构和按钮
2. 再删除 JavaScript 函数
3. 最后修改 `file-system-module.js`

