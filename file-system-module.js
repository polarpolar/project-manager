// ╔══════════════════════════════════════════╗
// ║  MODULE: file-system（文件系统层）        ║
// ╚══════════════════════════════════════════╝
// 
// 文件系统相关功能模块

// 防止多次打开文件选择器
let isFilePickerOpen = false;

// 缓存根目录文件夹列表（用于性能优化）
let cachedDirEntries = null;

// 扫描根目录文件夹（带缓存）
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

// 清除根目录文件夹缓存
function clearDirCache() {
  cachedDirEntries = null;
}

// 选择根目录
async function selectRootDir() {
  if (isFilePickerOpen) return;
  
  try {
    isFilePickerOpen = true;
    window.fsRootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    // 持久化权限（IndexedDB存储句柄）
    await saveRootHandle(window.fsRootHandle);
    // 初始化项目文件夹映射
    await initProjectDirMap();
    updateRootBar();
    showToast('✅ 根目录已设置：' + window.fsRootHandle.name);
    if (window.currentEditProjectId) {
      updateRootBar(window.currentEditProjectId);
    }
  } catch(e) {
    if (e.name !== 'AbortError') showToast('❌ 选择目录失败：' + e.message);
  } finally {
    isFilePickerOpen = false;
  }
}

// 持久化根目录句柄到 IndexedDB
function saveRootHandle(handle) {
  return new Promise((res, rej) => {
    const req = indexedDB.open('pmFilesDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => {
      const tx = e.target.result.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'root');
      tx.oncomplete = res; tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

// 从 IndexedDB 恢复根目录句柄
async function loadRootHandle() {
  return new Promise((res) => {
    const req = indexedDB.open('pmFilesDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => {
      const tx = e.target.result.transaction('handles', 'readonly');
      const get = tx.objectStore('handles').get('root');
      get.onsuccess = () => res(get.result || null);
      get.onerror = () => res(null);
    };
    req.onerror = () => res(null);
  });
}

// 更新根目录状态栏
async function updateRootBar(projectIdOrName) {
  // 获取 projectId 和 project（可能是 id 字符串，也可能是 project 对象）
  let projectId = null;
  let project = null;
  
  if (typeof projectIdOrName === 'string') {
    // 检查是否是项目 id（唯一代码，4位）
    if (projectIdOrName.length === 4) {
      projectId = projectIdOrName;
      project = projects.find(p => p.id === projectId);
    } else {
      // 是项目名称
      project = projects.find(p => p.name === projectIdOrName);
      projectId = project?.id;
    }
  } else if (projectIdOrName && projectIdOrName.id) {
    project = projectIdOrName;
    projectId = project.id;
  }

  // 获取项目关联的文件夹
  let projectDirName = null;
  if (projectId && window.projectDirMap[projectId]) {
    projectDirName = window.projectDirMap[projectId].name;
  }

  // 更新主文件面板的根目录状态栏
  const pathEl = document.getElementById('fsRootPath');
  if (pathEl) {
    if (window.fsRootHandle) {
      if (projectDirName) {
        pathEl.textContent = `${window.fsRootHandle.name} / ${projectDirName}`;
      } else if (project) {
        pathEl.textContent = `${window.fsRootHandle.name} / 未关联`;
      } else {
        pathEl.textContent = window.fsRootHandle.name;
      }
    } else {
      pathEl.textContent = '未选择';
    }
  }
  
  // 更新项目编辑页面的根目录状态栏
  const modalPathEl = document.getElementById('modalFsRootPath');
  if (modalPathEl) {
    if (window.fsRootHandle) {
      if (projectDirName) {
        modalPathEl.textContent = projectDirName;
      } else if (project) {
        modalPathEl.textContent = '未关联本地文件夹';
      } else {
        modalPathEl.textContent = window.fsRootHandle.name;
      }
      // 根目录已配置，移除点击事件和可点击样式
      modalPathEl.style.cursor = 'default';
      modalPathEl.onclick = null;
    } else {
      modalPathEl.textContent = '未选择';
      // 根目录未配置，添加点击事件和可点击样式
      modalPathEl.style.cursor = 'pointer';
      modalPathEl.onclick = selectRootDir;
    }
  }
}

// ═══════════════════════════════════════════════════
// 本地文件夹三层存储系统
// ═══════════════════════════════════════════════════

// 项目文件夹映射表：projectId -> FileSystemDirectoryHandle
window.projectDirMap = {};

// 本地存储 key
const DIR_MAP_STORAGE_KEY = 'pmDirMap';

// 获取本地存储的映射
function getDirMapFromStorage() {
  try {
    const data = localStorage.getItem(DIR_MAP_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    if (DEBUG) console.error('读取映射失败：', e);
    return {};
  }
}

// 保存映射到本地存储
function saveDirMapToStorage(mapping) {
  try {
    localStorage.setItem(DIR_MAP_STORAGE_KEY, JSON.stringify(mapping));
  } catch (e) {
    if (DEBUG) console.error('保存映射失败：', e);
  }
}

// 从根目录读取索引文件 .pm-index.json
async function loadIndexFromRoot() {
  if (!window.fsRootHandle) return {};
  try {
    const file = await window.fsRootHandle.getFileHandle('.pm-index.json');
    const content = await file.getFile().then(f => f.text());
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

// 保存索引文件到根目录
async function saveIndexToRoot(mapping) {
  if (!window.fsRootHandle) return;
  try {
    const file = await window.fsRootHandle.getFileHandle('.pm-index.json', { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(mapping, null, 2));
    await writable.close();
  } catch (e) {
    if (DEBUG) console.error('保存索引失败：', e);
  }
}

// 同步更新三层存储
async function syncProjectDirMapping(projectId, dirHandle, dirName) {
  if (DEBUG) console.log('syncProjectDirMapping called:', projectId, dirName);
  // 1. 更新 localStorage
  const storageMap = getDirMapFromStorage();
  storageMap[projectId] = dirName;
  saveDirMapToStorage(storageMap);
  if (DEBUG) console.log('已保存到 localStorage');

  // 2. 更新内存
  window.projectDirMap[projectId] = dirHandle;

  // 3. 更新 .pm-index.json
  const indexMap = await loadIndexFromRoot();
  indexMap[projectId] = dirName;
  await saveIndexToRoot(indexMap);
  if (DEBUG) console.log('已保存到 .pm-index.json');
}

// 初始化项目文件夹映射（三层查找）
async function initProjectDirMap() {
  if (!window.fsRootHandle) return;

  // 清除缓存，确保重新扫描
  clearDirCache();

  // 第一层：从 localStorage 读取
  const storageMap = getDirMapFromStorage();
  window.projectDirMap = {};
  let missCount = 0;

  // 逐个验证 localStorage 中的映射
  for (const [projectId, dirName] of Object.entries(storageMap)) {
    try {
      const dir = await window.fsRootHandle.getDirectoryHandle(dirName);
      window.projectDirMap[projectId] = dir;
    } catch (e) {
      // 目录不存在或名称已更改
      missCount++;
    }
  }

  // 第二层：从 .pm-index.json 读取
  const indexMap = await loadIndexFromRoot();
  for (const [projectId, dirName] of Object.entries(indexMap)) {
    if (window.projectDirMap[projectId]) continue; // 已有有效映射
    try {
      const dir = await window.fsRootHandle.getDirectoryHandle(dirName);
      window.projectDirMap[projectId] = dir;
      // 修复 localStorage
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

  // 第三层：扫描根目录下的所有文件夹，查找 .pm-project.json
  // 优化：先收集所有 entry，再并行读取
  try {
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

    // 保存修复后的映射
    saveDirMapToStorage(storageMap);
    await saveIndexToRoot(indexMap);
  } catch (e) {
    if (DEBUG) console.error('扫描目录失败：', e);
  }

  if (DEBUG) console.log('项目文件夹映射初始化完成：', window.projectDirMap);
}

// 创建项目文件夹并写入标记文件
async function createProjectDir(project) {
  if (!window.fsRootHandle) {
    showToast('请先配置根目录');
    return null;
  }

  // 清除缓存
  clearDirCache();

  const dirName = getProjectDirName(project);
  const projectId = project.id;
  if (DEBUG) console.log('createProjectDir called:', projectId, dirName);

  try {
    // 创建文件夹
    const dirHandle = await window.fsRootHandle.getDirectoryHandle(dirName, { create: true });

    // 写入 .pm-project.json 标记文件
    const markerContent = {
      projectId: projectId,
      createdAt: new Date().toISOString()
    };
    const markerFile = await dirHandle.getFileHandle('.pm-project.json', { create: true });
    const writable = await markerFile.createWritable();
    await writable.write(JSON.stringify(markerContent, null, 2));
    await writable.close();

    // 同步三层存储
    await syncProjectDirMapping(projectId, dirHandle, dirName);

    if (DEBUG) console.log(`创建项目文件夹：${dirName}`);
    return dirHandle;
  } catch (e) {
    if (DEBUG) console.error('创建项目文件夹失败：', e);
    showToast('创建文件夹失败：' + e.message);
    return null;
  }
}

// 根据 projectId 获取项目文件夹
async function getProjectDirById(projectId) {
  if (DEBUG) console.log('getProjectDirById called:', projectId, 'projectDirMap:', window.projectDirMap);
  
  // 首先从内存映射中获取
  if (window.projectDirMap[projectId]) {
    if (DEBUG) console.log('从内存映射中找到');
    return window.projectDirMap[projectId];
  }

  // 如果没有，尝试逐层查找
  if (!window.fsRootHandle) {
    if (DEBUG) console.log('没有根目录句柄');
    return null;
  }

  // 从 localStorage 查找
  const storageMap = getDirMapFromStorage();
  if (DEBUG) console.log('localStorage 映射:', storageMap);
  if (storageMap[projectId]) {
    try {
      const dir = await window.fsRootHandle.getDirectoryHandle(storageMap[projectId]);
      window.projectDirMap[projectId] = dir;
      return dir;
    } catch (e) {}
  }

  // 从 .pm-index.json 查找
  const indexMap = await loadIndexFromRoot();
  if (indexMap[projectId]) {
    try {
      const dir = await window.fsRootHandle.getDirectoryHandle(indexMap[projectId]);
      window.projectDirMap[projectId] = dir;
      return dir;
    } catch (e) {}
  }

  // 兜底：扫描所有文件夹，查找 .pm-project.json
  const foundDir = await findProjectDirById(projectId);
  if (foundDir) {
    // 修复映射
    storageMap[projectId] = foundDir.name;
    saveDirMapToStorage(storageMap);
    indexMap[projectId] = foundDir.name;
    await saveIndexToRoot(indexMap);
    return foundDir.dir;
  }

  return null;
}

// 获取项目文件夹名称（根据 id）
async function getProjectDirNameById(projectId) {
  const dir = await getProjectDirById(projectId);
  return dir ? dir.name : null;
}

// 模糊匹配现有文件夹
async function matchExistingDirs(projectName, channel) {
  if (!window.fsRootHandle) return [];

  const entries = await scanRootDirs(); // 使用缓存
  const candidates = [];
  const nameLower = projectName.toLowerCase();

  for (const entry of entries) {
    const dirName = entry.name;
    const dirNameLower = dirName.toLowerCase();

    // 检查是否已关联（通过映射表）
    const isLinked = Object.values(window.projectDirMap).some(h => h.name === dirName);
    if (isLinked) continue;

    // 模糊匹配规则
    let score = 0;
    if (dirNameLower === nameLower) {
      score = 100; // 完全匹配
    } else if (dirNameLower.includes(nameLower)) {
      score = 80; // 文件夹名包含项目名
    } else if (nameLower.includes(dirNameLower)) {
      score = 70; // 项目名包含文件夹名
    } else {
      // 计算字符重叠
      const overlap = [...dirNameLower].filter(c => nameLower.includes(c)).length;
      const ratio = overlap / Math.max(dirNameLower.length, nameLower.length);
      if (ratio > 0.5) score = 50 * ratio;
    }

    if (score > 30) {
      candidates.push({ dirHandle: entry, dirName, score });
    }
  }

  // 按匹配度排序
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// 手动关联项目文件夹
async function linkProjectDir(projectId, dirHandle) {
  // 清除缓存
  clearDirCache();

  const dirName = dirHandle.name;

  // 写入 .pm-project.json 标记文件
  try {
    const markerContent = {
      projectId: projectId,
      createdAt: new Date().toISOString()
    };
    const markerFile = await dirHandle.getFileHandle('.pm-project.json', { create: true });
    const writable = await markerFile.createWritable();
    await writable.write(JSON.stringify(markerContent, null, 2));
    await writable.close();
  } catch (e) {
    if (DEBUG) console.error('写入标记文件失败：', e);
  }

  // 同步三层存储
  await syncProjectDirMapping(projectId, dirHandle, dirName);
  showToast('✅ 已关联文件夹：' + dirName);
}

// 手动关联项目文件夹（UI入口）
async function linkProjectFolder() {
  const projectId = window.currentEditProjectId;
  if (!projectId) {
    showToast('请先保存项目');
    return;
  }

  if (!window.fsRootHandle) {
    showToast('请先配置根目录');
    return;
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await linkProjectDir(projectId, dirHandle);

    // 更新当前项目的文件列表
    if (window.currentEditProjectId) {
      updateRootBar(window.currentEditProjectId);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      showToast('选择文件夹失败：' + e.message);
    }
  }
}

// 获取项目目录
async function getProjectDir(projectName) {
  if (!window.fsRootHandle) return null;
  try {
    const safeName = projectName.replace(/[\\/:*?"<>|]/g, '_');
    const dirHandle = await window.fsRootHandle.getDirectoryHandle(safeName, { create: false });
    return dirHandle;
  } catch(e) {
    return null;
  }
}

// 重命名项目目录
async function renameProjectDir(oldName, newName) {
  if (!window.fsRootHandle) return;
  try {
    const oldDir = await window.fsRootHandle.getDirectoryHandle(oldName, { create: false });
    await window.fsRootHandle.rename(oldDir, newName);
  } catch(e) {
    if (DEBUG) console.error('重命名目录失败:', e);
  }
}

// 文件操作缓存
const fileOperationCache = new Map();

// 上传文件
async function uploadFiles(files, dir, projectId) {
  if (!files || files.length === 0) return;
  
  try {
    // 并行上传文件，提高效率
    const uploadPromises = files.map(async (file) => {
      try {
        const newFileHandle = await dir.getFileHandle(file.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(await file.arrayBuffer());
        await writable.close();
        return { success: true, name: file.name };
      } catch(e) {
        if (DEBUG) console.error(`上传文件 ${file.name} 失败:`, e);
        return { success: false, name: file.name, error: e.message };
      }
    });
    
    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    if (errorCount > 0) {
      showToast(`文件上传完成：成功 ${successCount} 个，失败 ${errorCount} 个`);
    } else {
      showToast(`✅ 成功上传 ${successCount} 个文件`);
    }
  } catch(e) {
    if (DEBUG) console.error('上传文件失败:', e);
    showToast('❌ 文件上传失败：' + e.message);
  }
}

// 删除文件
async function deleteFile(projectId, fileNames) {
  const filesToDelete = Array.isArray(fileNames) ? fileNames : [fileNames];
  if (filesToDelete.length === 0) return;
  
  if (!confirm(`确定要删除 ${filesToDelete.length} 个文件吗？`)) return;
  
  try {
    const p = projects.find(x => x.id === projectId);
    if (!p) {
      showToast('❌ 项目不存在');
      return;
    }
    
    const dir = await getProjectDirById(p.id);
    if (!dir) {
      showToast(`❌ 项目目录不存在：${getProjectDirName(p)}`);
      return;
    }
    
    // 并行删除文件，提高效率
    const deletePromises = filesToDelete.map(async (fileName) => {
      try {
        await dir.removeEntry(fileName);
        return { success: true, name: fileName };
      } catch(e) {
        if (DEBUG) console.error(`删除文件 ${fileName} 失败:`, e);
        return { success: false, name: fileName, error: e.message };
      }
    });
    
    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    if (errorCount > 0) {
      showToast(`文件删除完成：成功 ${successCount} 个，失败 ${errorCount} 个`);
    } else {
      showToast(`✅ 成功删除 ${successCount} 个文件`);
    }
  } catch(e) {
    if (DEBUG) console.error('删除文件失败:', e);
    showToast('❌ 文件删除失败：' + e.message);
  }
}

// 预览文件
async function previewFile(projectId, fileName) {
  try {
    const p = projects.find(x => x.id === projectId);
    if (!p) {
      showToast('❌ 项目不存在');
      return;
    }
    
    const dir = await getProjectDirById(p.id);
    if (!dir) {
      showToast(`❌ 项目目录不存在：${getProjectDirName(p)}`);
      return;
    }
    
    // 检查缓存
    const cacheKey = `${projectId}_${fileName}`;
    if (fileOperationCache.has(cacheKey)) {
      const cachedUrl = fileOperationCache.get(cacheKey);
      window.open(cachedUrl, '_blank');
      return;
    }
    
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    
    // 缓存URL，避免重复创建
    fileOperationCache.set(cacheKey, url);
    
    // 检测文件类型并选择合适的预览方式
    const fileType = file.type;
    if (fileType.startsWith('image/')) {
      // 图片直接预览
      window.open(url, '_blank');
    } else if (fileType === 'application/pdf') {
      // PDF预览
      window.open(url, '_blank');
    } else if (fileType === 'text/plain') {
      // 文本文件预览
      window.open(url, '_blank');
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX文件，使用在线预览
      showToast('正在打开文档...');
      window.open(url, '_blank');
    } else {
      // 其他文件类型
      window.open(url, '_blank');
    }
  } catch(e) {
    if (DEBUG) console.error('预览文件失败:', e);
    showToast('❌ 预览失败：' + e.message);
  }
}

// 清理文件操作缓存
function clearFileOperationCache() {
  // 释放所有URL对象，避免内存泄漏
  fileOperationCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      if (DEBUG) console.error('释放URL失败:', e);
    }
  });
  fileOperationCache.clear();
}

// 设置文件拖拽上传


// 读取 docx 文本（动态加载 mammoth）
async function readDocxText(file) {
  if (!window.mammoth) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const ab = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
  return result.value;
}

// 打开文件系统根目录
async function openFsRoot() {
  await selectRootDir();
}

// 导出模块
export {
  selectRootDir,
  saveRootHandle,
  loadRootHandle,
  updateRootBar,
  getProjectDir,
  getProjectDirById,
  getProjectDirNameById,
  scanRootDirs,
  createProjectDir,
  linkProjectDir,
  matchExistingDirs,
  initProjectDirMap,
  renameProjectDir,
  readDocxText,
  clearFileOperationCache,
  previewFile,
  deleteFile,
  openFsRoot
};
