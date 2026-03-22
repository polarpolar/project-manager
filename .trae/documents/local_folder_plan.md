# 本地文件夹功能实现计划

## 需求确认

根据设计文档，实现本地文件夹功能：

1. **文件夹命名**：`{项目来源}{日期}-{项目名称}`，如 `北化20251125-255所项目`
2. **唯一代码作为 Key**：使用项目唯一代码（projectCode 末尾4位）作为 `.pm-index.json` 的 key
3. **匹配时机**：导入新增项目或新建项目时自动进行模糊匹配
4. **存储位置**：用户选择的任意本地文件夹（可能是 OneDrive 同步目录）

---

## 实现步骤

### 步骤1：更新文件夹命名规则

**文件**：`project-module.js`

**修改**：
- 更新 `getProjectDirName(project)` 函数，按新规则生成文件夹名称
- 规则：`{项目来源}{日期(YYYYMMDD)}-{项目名称}`

### 步骤2：实现三层存储机制

**文件**：`file-system-module.js`

**新增函数**：
- `getStorageKey()` - 获取 localStorage 的 key
- `loadDirMapFromStorage()` - 从 localStorage 读取映射
- `saveDirMapToStorage(mapping)` - 保存映射到 localStorage
- `loadIndexFromRoot()` - 从根目录读取 .pm-index.json
- `saveIndexToRoot(mapping)` - 保存 .pm-index.json 到根目录

### 步骤3：实现 initProjectDirMap

**文件**：`file-system-module.js`

**新增函数**：`initProjectDirMap()`
- 按优先级逐层查找：
  1. localStorage → 2. .pm-index.json → 3. 扫描文件夹读取 .pm-project.json
- 建立 `window.projectDirMap`

### 步骤4：实现项目文件夹创建

**文件**：`file-system-module.js`

**新增函数**：`createProjectDir(project)`
- 在根目录下创建新文件夹（按命名规则）
- 写入 `.pm-project.json`
- 更新三层存储

### 步骤5：实现文件夹关联

**文件**：`file-system-module.js`

**新增函数**：
- `linkProjectDir(projectId, dirHandle)` - 手动关联，更新三层存储
- `matchExistingDirs(projectName)` - 模糊匹配已有文件夹

### 步骤6：替换现有 getProjectDir

**文件**：`file-system-module.js`

**修改**：`getProjectDir(projectId)` - 按新逻辑获取项目文件夹

### 步骤7：项目编辑页关联按钮

**文件**：`project-manager.html`, `modal-form.js`

**新增**：
- 项目编辑页显示"关联本地文件夹"按钮
- 点击后弹出文件夹选择器

### 步骤8：导入/新建时的自动关联

**文件**：`import-module.js`, `modal-form.js`

**新增**：
- 导入新增项目时自动匹配候选文件夹
- 弹出确认框让用户选择：关联/新建/跳过

### 步骤9：三层同步写入

**文件**：`file-system-module.js`

**新增函数**：`syncProjectDir(projectId, dirHandle)`
- 同步写入：localStorage + .pm-index.json + .pm-project.json

---

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `project-module.js` | 更新 `getProjectDirName` 函数 |
| `file-system-module.js` | 新增所有文件夹管理函数 |
| `modal-form.js` | 新增关联按钮和逻辑 |
| `import-module.js` | 导入时自动关联提示 |
| `project-manager.html` | UI 按钮 |

---

## 测试要点

1. 新建项目时自动创建文件夹
2. 导入新增项目时自动匹配
3. 手动关联功能正常
4. 跨设备同步（通过 .pm-index.json）
5. 文件夹改名后的兜底查找
