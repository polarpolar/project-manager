# 项目唯一代码功能调整计划

## 需求概述

调整项目编号规则，引入"项目唯一代码"概念，使其成为项目的唯一标识。

## 详细需求

1. **唯一代码生成规则**：4位随机字符（包含数字0-9、大写英文字母A-Z），共36个字符可选
2. **唯一代码一旦生成不再改变**：首次导入时生成，保存后永久保留
3. **项目编号格式变更**：PXXXX + 唯一代码（例如：P2603ABCD）
4. **UI更新**：按钮改名为"下载项目唯一代码"，导出的Excel列名改为"唯一代码"
5. **导入识别**：AI识别时识别"唯一代码"字段，有代码的项目视为已有项目

***

## 实现步骤

### 步骤1：修改唯一代码生成函数

**文件**：`project-module.js`

**修改内容**：

* 将 `genIdCode()` 函数修改为生成4位随机字符（0-9 + A-Z）

* 新增 `genUniqueCode()` 函数专门用于生成唯一代码

```javascript
// 生成4位随机字符（数字+大写字母）
function genUniqueCode() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
```

### 步骤2：修改项目编号生成逻辑

**文件**：`project-module.js`

**修改内容**：

* 修改 `genProjectCode()` 函数，格式变为：`P` + 年月(4位) + 唯一代码(4位)

* 例如：`P2603ABCD`

```javascript
function genProjectCode(stage, contractDate) {
  const uniqueCode = genUniqueCode();  // 生成唯一代码
  const now = new Date();
  let ym;
  if (stage === STAGE.NEGOTIATING) {
    ym = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,'0');
  } else {
    const d = contractDate ? new Date(contractDate) : now;
    ym = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0');
  }
  const prefix = stage === STAGE.NEGOTIATING ? 'C' : 'P';
  return prefix + ym + uniqueCode;
}
```

### 步骤3：更新 updateCodePrefix 函数

**文件**：`project-module.js`

**修改内容**：

* 修改 `updateCodePrefix()` 函数，保留唯一代码部分不变，只更新前缀和年月

```javascript
function updateCodePrefix(code, newStage, contractDate) {
  if (!code) return null;
  if (!code.startsWith('C') && !code.startsWith('P')) return code;
  const newPrefix = newStage === STAGE.NEGOTIATING ? 'C' : 'P';
  // 唯一代码在最后4位
  const uniqueCode = code.slice(-4);
  let ym = code.slice(1, 5);
  if (newStage !== STAGE.NEGOTIATING && contractDate) {
    const d = new Date(contractDate);
    ym = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0');
  }
  return newPrefix + ym + uniqueCode;
}
```

### 步骤4：修改导出函数

**文件**：`import-module.js`

**修改内容**：

* 修改 `exportExcelWithProjectCodes()` 函数

* 导出列名改为"唯一代码"

* 导出内容改为 `p.projectCode` (已包含唯一代码)

```javascript
function exportExcelWithProjectCodes() {
  if (!yuquePendingImport.length) { showToast('请先读取语雀文档'); return; }
  const data = yuquePendingImport.map(p => ({
    '项目名称': p.name,
    '唯一代码': p.projectCode || ''  // 项目编号中包含唯一代码
  }));
  // ... 其余代码不变
}
```

### 步骤5：更新 UI 按钮文字

**文件**：`project-manager.html`

**修改内容**：

* 按钮文字从"下载项目编号"改为"下载项目唯一代码"

```html
<button class="btn-export btn-hdr-ghost" id="btnExportProjectCodes" ...>📤 下载项目唯一代码</button>
```

### 步骤6：修改 AI 识别逻辑 - 添加唯一代码字段识别

**文件**：`import-module.js`

**修改内容**：

* 在 `parseTableWithClaude()` 函数的提示词中添加唯一代码字段识别

* 在 `parseBodySheet()` 函数的列映射中添加唯一代码映射

提示词添加：

```
- uniqueCode: 项目唯一代码/唯一代码
```

列映射添加：

```javascript
const LOCAL_COL_MAP = {
  // ... 现有映射
  '唯一代码': 'uniqueCode', '项目唯一代码': 'uniqueCode', '代码': 'uniqueCode',
};
```

### 步骤7：修改项目匹配逻辑

**文件**：`import-module.js`

**修改内容**：

* 在 `confirmYuqueImport()` 和 `confirmImport()` 中

* 优先通过 `uniqueCode` 匹配项目，其次通过项目名称匹配

```javascript
yuquePendingImport.forEach(p => {
  let idx = -1;
  // 优先通过唯一代码匹配
  if (p.uniqueCode) {
    idx = projects.findIndex(x => x.projectCode && x.projectCode.endsWith(p.uniqueCode));
  }
  // 其次通过项目编号匹配（兼容旧数据）
  if (idx === -1 && p.projectCode) {
    idx = projects.findIndex(x => x.projectCode === p.projectCode);
  }
  // 最后通过项目名称匹配
  if (idx === -1) {
    idx = projects.findIndex(x => x.name === p.name);
  }
  // ...
});
```

### 步骤8：兼容旧数据

**文件**：`import-module.js`

**修改内容**：

* 对于已存在的旧项目，如果没有唯一代码，在首次更新时自动生成

* 在 `genProjectCode()` 中检查现有项目，确保不重复

***

## 涉及文件清单

| 文件                     | 修改内容                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| `project-module.js`    | 修改 `genIdCode()` → `genUniqueCode()`，修改 `genProjectCode()` 和 `updateCodePrefix()` |
| `import-module.js`     | 修改导出函数、修改 AI 识别提示词、修改项目匹配逻辑                                                       |
| `project-manager.html` | 修改按钮文字                                                                            |

***

## 测试要点

1. 新建项目时生成唯一代码
2. 导入时识别唯一代码，匹配已有项目
3. 导出的 Excel 包含唯一代码列
4. 阶段变更时唯一代码保持不变
5. 旧数据兼容性

