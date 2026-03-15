// 项目管理相关功能模块

// 项目阶段
const STAGE = { NEGOTIATING: 0, DELIVERING: 1, COMPLETED: 2, TERMINATED: 3 };
const STAGE_LABEL  = ['洽谈中', '已签单·执行中', '已完结', '已终止'];
const STAGE_SHORT  = ['洽谈', '交付中', '已完结', '已终止'];
const STAGE_COLOR  = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s0)'];
const STAGE_S_ATTR = ['0', '1', '2', '3'];

// 存储键
const STORAGE_KEY = {
  PROJECTS: 'pm_projects_v3',
  RECYCLE: 'pm_recycle_bin_v1',
  AI_PROVIDER: 'ai_provider',
  AI_MODEL: 'ai_model',
  AI_KEY: 'ai_key',
  AI_PROXY: 'ai_proxy',
  AI_LOGS: 'ai_logs',
  AI_MODEL_POLICY: 'ai_model_policy',
  AI_MAX_TOKENS: 'ai_max_tokens',
  YUQUE_PROXY: 'yuque_proxy',
  YUQUE_TOKEN: 'yuque_token',
  YUQUE_URL: 'yuque_url',
  PARSE_MODE: 'parse_mode',
  SB_COLLAPSED: 'sb_collapsed'
};

// 全局变量：由 main.js 在 window 上初始化
// 模块内直接使用全局变量（window.projects 等）

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 清理 localStorage 中不必要的数据
function cleanLocalStorage() {
  try {
    // 清理 AI 日志，只保留最近 100 条
    const aiLogs = JSON.parse(localStorage.getItem(STORAGE_KEY.AI_LOGS) || '[]');
    if (aiLogs.length > 100) {
      const trimmedLogs = aiLogs.slice(0, 100);
      localStorage.setItem(STORAGE_KEY.AI_LOGS, JSON.stringify(trimmedLogs));
    }
    
    // 检查存储大小
    const totalSize = Object.keys(localStorage).reduce((total, key) => {
      return total + localStorage.getItem(key).length;
    }, 0);
    
    if (totalSize > MAX_STORAGE_BYTES * 0.8) {
      // 如果存储接近上限，清理更多数据
      if (aiLogs.length > 50) {
        const trimmedLogs = aiLogs.slice(0, 50);
        localStorage.setItem(STORAGE_KEY.AI_LOGS, JSON.stringify(trimmedLogs));
      }
    }
    
    if (DEBUG) console.log('localStorage 清理完成');
  } catch (error) {
    if (DEBUG) console.error('清理 localStorage 失败：', error);
  }
}

// 增量存储标志
let storageDirty = false;

// 优化后的 saveToLocalStorage 函数（带防抖）
const saveToLocalStorage = debounce(function() {
  if (!storageDirty) return;
  
  try {
    localStorage.setItem(STORAGE_KEY.PROJECTS, JSON.stringify(projects));
    localStorage.setItem(STORAGE_KEY.RECYCLE, JSON.stringify(recycleBin));
    storageDirty = false;
    if (DEBUG) console.log('数据已保存到 localStorage');
  } catch (error) {
    if (DEBUG) console.error('保存到 localStorage 失败：', error);
  }
}, 1000); // 1秒防抖

// 标记存储为脏
function markStorageDirty() {
  storageDirty = true;
  saveToLocalStorage();
}

// XSS 转义函数
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 动态导入数据库模块
async function loadDatabase() {
  try {
    const module = await import('./db.js');
    db = module.default;
    if (DEBUG) console.log('数据库模块加载成功');
    return true;
  } catch (error) {
    if (DEBUG) console.error('数据库模块加载失败:', error);
    return false;
  }
}



// 初始化数据库并加载数据
async function initDatabase() {
  try {
    // 清理 localStorage 中不必要的数据
    cleanLocalStorage();
    
    // 1. 尝试从 IndexedDB 加载数据
    const loadSuccess = await loadDatabase();
    if (loadSuccess) {
      if (DEBUG) console.log('数据库模块加载成功');
      
      // 2. 初始化数据库
      const initSuccess = await db.init();
      
      if (initSuccess) {
        if (DEBUG) console.log('数据库初始化成功，开始加载完整数据');
        
        // 3. 并行加载项目数据和回收站数据
        const [projectsData, recycleData] = await Promise.all([
          db.getProjects().catch(() => []),
          db.getRecycleBin().catch(() => [])
        ]);
        
        if (DEBUG) {
          console.log('项目数据加载成功，数量：', projectsData.length);
          console.log('回收站数据加载成功，数量：', recycleData.length);
        }
        
        // 4. 更新数据并重新渲染
        projects = projectsData;
        recycleBin = recycleData;
        
        // 5. 保存到localStorage，以便下次快速加载
        markStorageDirty();
        
        // 6. 重新渲染页面，显示完整数据
        render();
        
        return;
      }
    }
    
    // 如果 IndexedDB 加载失败，从 localStorage 加载数据
    if (DEBUG) console.log('从 localStorage 加载数据');
    const hasLocalData = loadFromLocalStorage();
    
    // 如果有本地数据，尝试导入到 IndexedDB
    if (hasLocalData && loadSuccess) {
      if (DEBUG) console.log('尝试将 localStorage 数据导入到 IndexedDB');
      try {
        // 导入项目数据
        for (const project of projects) {
          await db.saveProject(project);
        }
        
        // 导入回收站数据
        for (const item of recycleBin) {
          await db.saveToRecycleBin(item);
        }
        
        if (DEBUG) console.log('数据导入成功');
      } catch (e) {
        if (DEBUG) console.error('数据导入失败：', e);
      }
    }
  } catch (error) {
    if (DEBUG) console.error('初始化数据库失败：', error);
    // 继续使用localStorage中的数据
    loadFromLocalStorage();
  }
}

// 从localStorage加载数据作为备用
function loadFromLocalStorage() {
  try {
    let hasData = false;
    
    const raw = localStorage.getItem(STORAGE_KEY.PROJECTS);
    if (raw) {
      try {
        projects = JSON.parse(raw);
        if (DEBUG) console.log('从localStorage加载项目数据，数量：', projects.length);
        hasData = true;
      } catch (parseError) {
        if (DEBUG) console.error('解析项目数据失败：', parseError);
        projects = [];
      }
    } else {
      projects = [];
    }
    
    const recycleRaw = localStorage.getItem(STORAGE_KEY.RECYCLE);
    if (recycleRaw) {
      try {
        recycleBin = JSON.parse(recycleRaw);
        if (DEBUG) console.log('从localStorage加载回收站数据，数量：', recycleBin.length);
      } catch (parseError) {
        if (DEBUG) console.error('解析回收站数据失败：', parseError);
        recycleBin = [];
      }
    } else {
      recycleBin = [];
    }
    
    if (projects.length > 0) {
      // 从localStorage加载后，触发渲染
      render();
    }
    
    return hasData;
  } catch (error) {
    if (DEBUG) console.error('从localStorage加载数据失败：', error);
    projects = [];
    recycleBin = [];
    return false;
  }
}

// 保存数据到localStorage


// 导出数据为JSON文件
function exportData() {
  try {
    const exportData = {
      projects: projects,
      recycleBin: recycleBin,
      exportDate: new Date().toISOString(),
      version: '1.2'
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-manager-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('数据导出成功');
  } catch (error) {
    if (DEBUG) console.error('导出数据失败：', error);
    showToast('导出失败：' + error.message);
  }
}

// 导入数据从JSON文件
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importData = JSON.parse(event.target.result);
          
          // 验证数据格式
          if (!importData.projects || !Array.isArray(importData.projects)) {
            throw new Error('数据格式错误：缺少项目数据');
          }
          
          showConfirm({ 
            icon: '📤', 
            title: '导入数据', 
            msg: `确定要导入数据吗？这将会覆盖当前的${importData.projects.length}个项目和${importData.recycleBin ? importData.recycleBin.length : 0}个回收站项目。`, 
            okText: '导入',
            onOk: async () => {
              // 更新内存中的数据
              projects = importData.projects;
              recycleBin = importData.recycleBin || [];
              
              // 保存到数据库
              if (db) {
                // 清空当前数据库
                const allProjects = await db.getProjects();
                for (const project of allProjects) {
                  await db.deleteProject(project.id);
                }
                await db.clearRecycleBin();
                
                // 保存项目数据到数据库
                for (const project of projects) {
                  await db.saveProject(project);
                }
                
                // 保存回收站数据到数据库
                for (const item of recycleBin) {
                  await db.saveToRecycleBin(item);
                }
              }
              
              // 重新渲染页面
              render();
              showToast('数据导入成功');
            }
          });
        } catch (parseError) {
          if (DEBUG) console.error('解析导入数据失败：', parseError);
          showToast('导入失败：数据格式错误');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      if (DEBUG) console.error('导入数据失败：', error);
      showToast('导入失败：' + error.message);
    }
  };
  
  input.click();
}

// 从localStorage导入数据到数据库
async function importFromLocalStorage() {
  try {
    showConfirm({ 
      icon: '📤', 
      title: '从缓存导入数据', 
      msg: '确定要从localStorage缓存中导入数据到数据库吗？这将会覆盖当前数据库中的数据。', 
      okText: '导入',
      onOk: async () => {
        // 从localStorage读取数据
        const raw = localStorage.getItem(STORAGE_KEY.PROJECTS);
        const recycleRaw = localStorage.getItem(STORAGE_KEY.RECYCLE);
        
        if (raw) {
          try {
            const localStorageProjects = JSON.parse(raw);
            if (DEBUG) console.log('从localStorage导入项目数据，数量：', localStorageProjects.length);
            
            // 清空当前数据库
            const allProjects = await db.getProjects();
            for (const project of allProjects) {
              await db.deleteProject(project.id);
            }
            await db.clearRecycleBin();
            
            // 保存项目数据到数据库
            for (const project of localStorageProjects) {
              await db.saveProject(project);
            }
            
            // 保存回收站数据到数据库
            if (recycleRaw) {
              try {
                const localStorageRecycleBin = JSON.parse(recycleRaw);
                if (DEBUG) console.log('从localStorage导入回收站数据，数量：', localStorageRecycleBin.length);
                for (const item of localStorageRecycleBin) {
                  await db.saveToRecycleBin(item);
                }
                recycleBin = localStorageRecycleBin;
              } catch (recycleParseError) {
                if (DEBUG) console.error('解析回收站数据失败：', recycleParseError);
              }
            }
            
            // 更新内存中的数据
            projects = localStorageProjects;
            
            // 重新渲染页面
            render();
            showToast('数据导入成功');
          } catch (parseError) {
            if (DEBUG) console.error('解析项目数据失败：', parseError);
            showToast('导入失败：数据格式错误');
          }
        } else {
          showToast('没有找到缓存数据');
        }
      }
    });
  } catch (error) {
    if (DEBUG) console.error('导入数据失败：', error);
    showToast('导入失败：' + error.message);
  }
}

// 项目修改状态跟踪
let modifiedProjects = new Set();
let modifiedRecycleItems = new Set();

// 标记项目为已修改
function markProjectModified(projectId) {
  modifiedProjects.add(projectId);
}

// 标记回收站项目为已修改
function markRecycleItemModified(itemId) {
  modifiedRecycleItems.add(itemId);
}

function save() {
  try {
    // 检查是否有修改，在清空集合之前
    const hasModifications = modifiedProjects.size > 0 || modifiedRecycleItems.size > 0 || projects.some(p => p._modified);
    
    if (db) {
      // 只保存修改过的项目到数据库
      let savedCount = 0;
      for (const project of projects) {
        if (modifiedProjects.has(project.id)) {
          db.saveProject(project);
          savedCount++;
        }
      }
      
      // 只保存修改过的回收站数据
      let savedRecycleCount = 0;
      for (const item of recycleBin) {
        if (modifiedRecycleItems.has(item.id)) {
          db.saveToRecycleBin(item);
          savedRecycleCount++;
        }
      }
      
      if (DEBUG && (savedCount > 0 || savedRecycleCount > 0)) {
        console.log(`数据保存到数据库成功：项目 ${savedCount} 个，回收站 ${savedRecycleCount} 个`);
      }
    }
    
    // 无论数据库是否可用，都保存到localStorage，确保下次快速加载
    try {
      // 只有当有修改时才保存
      if (hasModifications) {
        // 标记存储为脏，由防抖函数处理保存
        markStorageDirty();
        // 清除修改标记
        modifiedProjects.clear();
        modifiedRecycleItems.clear();
        projects.forEach(p => delete p._modified);
      }
    } catch (localStorageError) {
      if (DEBUG) console.error('保存到 localStorage 失败：', localStorageError);
    }
  } catch(e) {
    if (DEBUG) console.error('保存数据失败：', e);
  }
}

// 阶段逻辑
// stage: 0=洽谈中, 1=已签单·执行中, 2=已完结, 3=已终止
// "催款中" 不是独立 stage，而是 stage===1 且有未完成催款任务的展示列

function hasOpenCollect(p) {
  return p.stage === STAGE.DELIVERING && (p.collectTasks||[]).some(t => !t.done);
}

// 看板列：0=洽谈, 1=交付中(含催款中), 2=完结, 3=已终止
function getBoardColumn(p) {
  if (p.stage === STAGE.NEGOTIATING) return '0';
  if (p.stage === STAGE.COMPLETED) return '2';
  if (p.stage === STAGE.TERMINATED) return '3';
  return '1';
}

// 金额格式化工具
// 万元：保留2位小数，如 12.50 万
function fmtWan(v) {
  const n = parseFloat(v);
  if (isNaN(n) || v === '' || v == null) return '—';
  return n.toFixed(2) + ' 万';
}
// 元：千位分隔符 + 2位小数，如 386,859.00
function fmtYuan(v) {
  const n = parseFloat(v);
  if (isNaN(n) || v === '' || v == null) return '—';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// 万元显示（用于卡片/台账中的"¥XX万"样式）
function fmtWanShort(v) {
  const n = parseFloat(v);
  if (isNaN(n) || v === '' || v == null) return null;
  return n.toFixed(2);
}

// 回收站功能

// 将项目移至回收站
async function moveToRecycleBin(id) {
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return;
  
  const project = projects[idx];
  projects.splice(idx, 1);
  
  // 添加删除时间
  project.deletedAt = new Date().toISOString();
  recycleBin.push(project);
  
  // 标记回收站项目为已修改
  markRecycleItemModified(project.id);
  
  // 保存到数据库
  await db.deleteProject(id);
  await db.saveToRecycleBin(project);
  
  save();
  refreshView();
  showToast('项目已移至回收站');
}

// 从回收站恢复项目
async function restoreFromRecycleBin(id) {
  const idx = recycleBin.findIndex(p => p.id === id);
  if (idx === -1) return;
  
  const project = recycleBin[idx];
  recycleBin.splice(idx, 1);
  
  // 移除删除时间
  delete project.deletedAt;
  projects.push(project);
  
  // 保存到数据库
  await db.deleteFromRecycleBin(id);
  await db.saveProject(project);
  
  save();
  refreshView();
  showToast('项目已从回收站恢复');
  renderRecycleBin();
}

// 从回收站删除项目（彻底删除）
async function deleteFromRecycleBin(id) {
  const idx = recycleBin.findIndex(p => p.id === id);
  if (idx === -1) return;
  
  recycleBin.splice(idx, 1);
  
  // 从数据库删除
  await db.deleteFromRecycleBin(id);
  
  save();
  refreshView();
  showToast('项目已彻底删除');
  renderRecycleBin();
}

// 清空回收站
async function emptyRecycleBin() {
  if (confirm('确定要清空回收站吗？此操作不可恢复。')) {
    recycleBin = [];
    
    // 清空数据库中的回收站
    await db.clearRecycleBin();
    
    save();
    refreshView();
    showToast('回收站已清空');
    renderRecycleBin();
  }
}

// 渲染回收站面板内容
function renderRecycleBin() {
  const recycleBinList = document.getElementById('recycleBinList');
  if (recycleBinList) {
    recycleBinList.innerHTML = recycleBin.length ? recycleBin.map(p => `
      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px var(--shadow);padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <h4 style="font-weight:700;color:var(--ink);font-size:.8rem">${esc(p.name)}</h4>
          <span style="font-size:.6rem;color:#bbb">${new Date(p.deletedAt).toLocaleString()}</span>
        </div>
        <div style="font-size:.65rem;color:#888;margin-bottom:8px">
          ${p.projectCode ? `编号: ${p.projectCode}<br>` : ''}
          ${p.owner ? `负责人: ${p.owner}<br>` : ''}
          ${p.stage !== undefined ? `阶段: ${STAGE_LABEL[p.stage]}<br>` : ''}
        </div>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="btn-sm" style="background:rgba(77,182,172,.1);color:#4db6ac;border-color:rgba(77,182,172,.2)" onclick="restoreFromRecycleBin('${p.id}')">恢复</button>
          <button class="btn-sm btn-del" onclick="deleteFromRecycleBin('${p.id}')">彻底删除</button>
        </div>
      </div>`).join('') : '<div style="text-align:center;color:#999;padding:40px 0">回收站为空</div>';
  }
}

// 打开回收站面板
function openRecycleBin() {
  const panel = document.createElement('div');
  panel.id = 'recycleBinPanel';
  panel.className = 'side-panel';
  panel.innerHTML = `
    <div class="side-panel-header">
      <h2>🗑️ 项目回收站</h2>
      <button class="btn-close-panel" onclick="closeRecycleBin()">✕</button>
    </div>
    <div class="side-body">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:.9rem;font-weight:700;color:var(--ink)">已删除项目</h3>
        <button class="btn-hdr btn-hdr-danger" style="font-size:.7rem;padding:4px 10px" onclick="emptyRecycleBin()">清空回收站</button>
      </div>
      <div id="recycleBinList">
        ${recycleBin.length ? recycleBin.map(p => `
          <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px var(--shadow);padding:12px 14px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <h4 style="font-weight:700;color:var(--ink);font-size:.8rem">${esc(p.name)}</h4>
              <span style="font-size:.6rem;color:#bbb">${new Date(p.deletedAt).toLocaleString()}</span>
            </div>
            <div style="font-size:.65rem;color:#888;margin-bottom:8px">
              ${p.projectCode ? `编号: ${p.projectCode}<br>` : ''}
              ${p.owner ? `负责人: ${p.owner}<br>` : ''}
              ${p.stage !== undefined ? `阶段: ${STAGE_LABEL[p.stage]}<br>` : ''}
            </div>
            <div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="btn-sm" style="background:rgba(77,182,172,.1);color:#4db6ac;border-color:rgba(77,182,172,.2)" onclick="restoreFromRecycleBin('${p.id}')">恢复</button>
              <button class="btn-sm btn-del" onclick="deleteFromRecycleBin('${p.id}')">彻底删除</button>
            </div>
          </div>
        `).join('') : '<div class="empty-state">回收站为空</div>'}
      </div>
    </div>
  `;
  
  document.body.appendChild(panel);
  
  const backdrop = document.createElement('div');
  backdrop.className = 'side-backdrop show';
  backdrop.onclick = closeRecycleBin;
  backdrop.id = 'recycleBinBackdrop';
  document.body.appendChild(backdrop);
  
  setTimeout(() => panel.classList.add('open'), 10);
}

// 关闭回收站面板
function closeRecycleBin() {
  const panel = document.getElementById('recycleBinPanel');
  const backdrop = document.getElementById('recycleBinBackdrop');
  if (panel) panel.remove();
  if (backdrop) backdrop.remove();
}

// 导出模块
export {
  STAGE,
  STAGE_LABEL,
  STAGE_SHORT,
  STAGE_COLOR,
  STAGE_S_ATTR,
  STORAGE_KEY,
  debounce,
  cleanLocalStorage,
  saveToLocalStorage,
  markStorageDirty,
  esc,
  loadDatabase,
  initDatabase,
  loadFromLocalStorage,
  exportData,
  importData,
  importFromLocalStorage,
  markProjectModified,
  markRecycleItemModified,
  save,
  hasOpenCollect,
  getBoardColumn,
  fmtWan,
  fmtYuan,
  fmtWanShort,
  moveToRecycleBin,
  restoreFromRecycleBin,
  deleteFromRecycleBin,
  emptyRecycleBin,
  renderRecycleBin,
  openRecycleBin,
  closeRecycleBin
};