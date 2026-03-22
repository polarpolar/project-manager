# 项目文件夹关联性能优化计划

## 问题分析

### 问题一：matchExistingDirs 重复扫描

* **现状**：导入 N 个项目时，调用 N 次 `matchExistingDirs`，每次都完整遍历根目录所有文件夹

* **影响**：文件夹越多越慢，导入 100 个项目就要扫描 100 次

### 问题二：initProjectDirMap 第三层串行扫描

* **现状**：逐个读取每个子文件夹的 `.pm-project.json`，串行 await

* **影响**：M 个文件夹就要串行读取 M 次，非常慢

### 问题三：initProjectDirMap 每次都执行第三层

* **现状**：即使 localStorage 和 .pm-index.json 都能找到所有项目，仍然会执行耗时的第三层扫描

* **影响**：不必要的性能开销

***

## 优化方案

### 优化一：matchExistingDirs 只扫描一次，缓存结果

**修改文件**：`file-system-module.js`

1. 添加缓存变量：

```javascript
let cachedDirEntries = null; // 缓存根目录文件夹列表
```

1. 新增扫描函数 `scanRootDirs()`：

```javascript
async function scanRootDirs() {
  if (cachedDirEntries) return cachedDirEntries;
  const entries = [];
  for await (const entry of window.fsRootHandle.values()) {
    if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
      entries.push(entry);
    }
  }
  cachedDirEntries = entries;
  return entries;
}
```

1. 修改 `matchExistingDirs` 使用缓存：

```javascript
async function matchExistingDirs(projectName, channel) {
  const entries = await scanRootDirs(); // 使用缓存
  // ... 后续逻辑不变
}
```

1. **缓存失效时机**（补充）：

```javascript
// 在以下函数中清除缓存
async function selectRootDir() {
  cachedDirEntries = null; // 切换根目录后清除
  // ...
}

async function createProjectDir(project) {
  cachedDirEntries = null; // 创建新文件夹后清除
  // ...
}

async function linkProjectDir(projectId, dirHandle) {
  cachedDirEntries = null; // 关联新文件夹后清除
  // ...
}
```

***

### 优化二：initProjectDirMap 第三层改成并行

**修改文件**：`file-system-module.js`

将串行读取改为并行读取：

```javascript
// 第三层：扫描根目录下的所有文件夹，查找 .pm-project.json
// 优化：先收集所有 entry，再并行读取

// 1. 先收集所有目录 entry
const dirEntries = [];
for await (const entry of window.fsRootHandle.values()) {
  if (entry.kind === 'directory') {
    dirEntries.push(entry);
  }
}

// 2. 并行读取每个目录的标记文件
const readPromises = dirEntries.map(async (entry) => {
  try {
    const markerFile = await entry.getFileHandle('.pm-project.json');
    const content = await markerFile.getFile().then(f => f.text());
    const marker = JSON.parse(content);
    return { entry, projectId: marker.projectId };
  } catch (e) {
    return null;
  }
});

const results = await Promise.all(readPromises);

// 3. 处理结果
for (const result of results) {
  if (result && result.projectId && !window.projectDirMap[result.projectId]) {
    window.projectDirMap[result.projectId] = result.entry;
    storageMap[result.projectId] = result.entry.name;
    indexMap[result.projectId] = result.entry.name;
  }
}
```

***

### 优化三：第三层扫描加条件判断（修正）

**修改文件**：`file-system-module.js`

用"失败项"计数来判断是否需要第三层扫描：

```javascript
async function initProjectDirMap() {
  // ... 第一层代码 ...

  // 第一层查找时记录失败数
  let missCount = 0;
  for (const [projectId, dirName] of Object.entries(storageMap)) {
    try {
      const dir = await window.fsRootHandle.getDirectoryHandle(dirName);
      window.projectDirMap[projectId] = dir;
    } catch (e) {
      // 目录不存在或名称已更改
      missCount++;
    }
  }

  // ... 第二层代码 ...

  // 第二层查找时累加失败数
  for (const [projectId, dirName] of Object.entries(indexMap)) {
    if (window.projectDirMap[projectId]) continue;
    try {
      const dir = await window.fsRootHandle.getDirectoryHandle(dirName);
      window.projectDirMap[projectId] = dir;
      storageMap[projectId] = dirName;
    } catch (e) {
      missCount++;
    }
  }

  // 只有前两层有失败项时才执行第三层扫描
  if (missCount === 0) {
    if (DEBUG) console.log('前两层无失败项，跳过第三层扫描');
    return;
  }

  // 否则执行第三层扫描（并行版本）
  // ... 
}
```

***

### 优化四：导入时一次性完成所有匹配

**修改文件**：`import-module.js`

在导入循环外一次性扫描并匹配所有项目：

```javascript
// 修改 confirmImport 函数中的导入后关联逻辑
async function confirmImport() {
  // ... 现有解析和保存逻辑 ...

  // 导入完成后自动关联文件夹
  if (window.fsRootHandle && added > 0) {
    const newlyAdded = projects.slice(-added);
    
    // 一次性扫描根目录（使用缓存）
    const allDirs = await scanRootDirs();
    
    // 为每个项目做匹配，结果缓存起来
    const matchResults = new Map(); // projectId -> candidates
    
    for (const p of newlyAdded) {
      // 检查是否已有关联
      const existingDir = await getProjectDirById(p.id);
      if (existingDir) continue;
      
      // 直接在 allDirs 里匹配（复用 matchExistingDirs 的匹配逻辑）
      const candidates = [];
      const nameLower = p.name.toLowerCase();
      
      for (const entry of allDirs) {
        const dirName = entry.name;
        // 检查是否已关联
        const isLinked = Object.values(window.projectDirMap).some(h => h.name === dirName);
        if (isLinked) continue;
        
        // 模糊匹配逻辑（与 matchExistingDirs 相同）
        const dirNameLower = dirName.toLowerCase();
        let score = 0;
        if (dirNameLower === nameLower) {
          score = 100;
        } else if (dirNameLower.includes(nameLower)) {
          score = 80;
        } else if (nameLower.includes(dirNameLower)) {
          score = 70;
        } else {
          const overlap = [...dirNameLower].filter(c => nameLower.includes(c)).length;
          const ratio = overlap / Math.max(dirNameLower.length, nameLower.length);
          if (ratio > 0.5) score = 50 * ratio;
        }
        
        if (score > 30) {
          candidates.push({ dirHandle: entry, dirName, score });
        }
      }
      
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length > 0) {
        matchResults.set(p.id, candidates);
      }
    }
    
    // 逐个询问用户（使用预计算的结果）
    for (const p of newlyAdded) {
      const candidates = matchResults.get(p.id);
      if (!candidates || candidates.length === 0) {
        // 没有匹配的文件夹，创建新文件夹
        await createProjectDir(p);
        continue;
      }
      
      const choice = confirm(`项目「${p.name}」检测到可能匹配的文件夹「${candidates[0].dirName}」，是否关联？\n\n确定：关联现有文件夹\n取消：新建文件夹`);
      if (choice) {
        await linkProjectDir(p.id, candidates[0].dirHandle);
      } else {
        await createProjectDir(p);
      }
    }
  }
}
```

***

## 实现步骤

1. **修改 file-system-module.js**

   * 添加缓存变量 `cachedDirEntries`

   * 新增 `scanRootDirs()` 函数

   * 修改 `matchExistingDirs` 使用缓存

   * 在 `selectRootDir`、`createProjectDir`、`linkProjectDir` 中清除缓存

   * 修改 `initProjectDirMap` 第三层为并行读取

   * 添加"失败项"计数判断跳过第三层

2. **修改 import-module.js**

   * 优化导入后关联逻辑，一次性扫描+匹配

3. **测试验证**

   * 导入多个项目，验证性能提升

   * 验证功能不受影响（文件夹匹配、关联正常工作）

