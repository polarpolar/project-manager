// 文件系统相关功能模块

// 选择根目录
async function selectRootDir() {
  if (isFilePickerOpen) return;
  
  try {
    isFilePickerOpen = true;
    fsRootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    // 持久化权限（IndexedDB存储句柄）
    await saveRootHandle(fsRootHandle);
    updateRootBar();
    showToast('✅ 根目录已设置：' + fsRootHandle.name);
    if (fsCurrentProjectId) await loadFilePanel(fsCurrentProjectId);
    // 如果当前在本地文件标签页，更新显示
    if (currentEditProjectId) {
      const p = projects.find(x => x.id === currentEditProjectId);
      if (p) {
        updateRootBar(getProjectDirName(p));
      }
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
function updateRootBar(projectName) {
  // 更新主文件面板的根目录状态栏
  const pathEl = document.getElementById('fsRootPath');
  if (pathEl) {
    if (fsRootHandle) {
      if (projectName) {
        pathEl.textContent = `${fsRootHandle.name} / ${projectName}`;
      } else {
        pathEl.textContent = fsRootHandle.name;
      }
    } else {
      pathEl.textContent = '未选择';
    }
  }
  
  // 更新项目编辑页面的根目录状态栏
  const modalPathEl = document.getElementById('modalFsRootPath');
  if (modalPathEl) {
    if (fsRootHandle) {
      if (projectName) {
        modalPathEl.textContent = projectName;
      } else {
        modalPathEl.textContent = fsRootHandle.name;
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

// 获取项目目录
async function getProjectDir(projectName) {
  if (!fsRootHandle) return null;
  try {
    const safeName = projectName.replace(/[\\/:*?"<>|]/g, '_');
    const dirHandle = await fsRootHandle.getDirectoryHandle(safeName, { create: false });
    return dirHandle;
  } catch(e) {
    return null;
  }
}

// 重命名项目目录
async function renameProjectDir(oldName, newName) {
  if (!fsRootHandle) return;
  try {
    const oldDir = await fsRootHandle.getDirectoryHandle(oldName, { create: false });
    await fsRootHandle.rename(oldDir, newName);
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
  } finally {
    await loadFilePanel(projectId);
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
    
    const dir = await getProjectDir(p.name);
    if (!dir) {
      showToast('❌ 项目目录不存在');
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
  } finally {
    await loadFilePanel(projectId);
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
    
    const dir = await getProjectDir(p.name);
    if (!dir) {
      showToast('❌ 项目目录不存在');
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
function setupFileDrop(dir, projectId) {
  const dropZone = document.getElementById('fileDropZone');
  if (!dropZone) return;
  
  dropZone.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropZone.style.borderColor = 'var(--accent)';
    dropZone.style.backgroundColor = 'rgba(123, 31, 162, 0.05)';
  };
  
  dropZone.ondragleave = () => {
    dropZone.style.borderColor = 'var(--paper3)';
    dropZone.style.backgroundColor = 'transparent';
  };
  
  dropZone.ondrop = async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--paper3)';
    dropZone.style.backgroundColor = 'transparent';
    
    if (e.dataTransfer.files.length) {
      showToast(`正在上传 ${e.dataTransfer.files.length} 个文件...`);
      await uploadFiles(Array.from(e.dataTransfer.files), dir, projectId);
    }
  };
  
  // 添加点击上传功能
  dropZone.onclick = () => {
    const fileInput = document.getElementById('fileUploadInput');
    if (fileInput) {
      fileInput.click();
    }
  };
}

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

// 导出模块
export {
  selectRootDir,
  saveRootHandle,
  loadRootHandle,
  updateRootBar,
  getProjectDir,
  renameProjectDir,
  uploadFiles,
  deleteFile,
  previewFile,
  setupFileDrop,
  readDocxText,
  clearFileOperationCache
};
