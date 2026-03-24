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

// 防抖函数（支持异步函数）
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    return new Promise((resolve) => {
      const later = () => {
        clearTimeout(timeout);
        resolve(func(...args));
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    });
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
// 策略：优先从 localStorage 快速显示首屏，再后台从 IndexedDB 加载完整数据
async function initDatabase() {
  try {
    // 清理 localStorage 中不必要的数据
    cleanLocalStorage();

    // 1. 优先从 localStorage 加载，快速显示首屏
    if (DEBUG) console.log('initDatabase: 正在加载 localStorage...');
    const hasLocalData = loadFromLocalStorage();
    if (DEBUG) console.log('initDatabase: localStorage 加载完成，项目数:', projects?.length || 0);

    // 2. 后台加载数据库模块
    if (DEBUG) console.log('initDatabase: 正在加载数据库模块...');
    const loadSuccess = await loadDatabase();
    if (!loadSuccess) {
      if (DEBUG) console.warn('initDatabase: 数据库模块加载失败，继续使用 localStorage 数据');
      return;
    }

    // 3. 初始化数据库
    if (DEBUG) console.log('initDatabase: 正在初始化数据库...');
    const initSuccess = await db.init();

    if (initSuccess) {
      if (DEBUG) console.log('initDatabase: 数据库初始化成功，加载完整数据...');

      // 4. 并行加载项目数据和回收站数据
      const [projectsData, recycleData] = await Promise.all([
        db.getProjects().catch(err => {
          if (DEBUG) console.error('initDatabase: 加载项目数据失败:', err);
          return [];
        }),
        db.getRecycleBin().catch(err => {
          if (DEBUG) console.error('initDatabase: 加载回收站数据失败:', err);
          return [];
        })
      ]);

      if (DEBUG) console.log('initDatabase: 数据库加载完成 - 项目:', projectsData.length, '回收站:', recycleData.length);

      // 5. 只有当 IndexedDB 中有数据时，才用它覆盖 localStorage 的数据
      if (projectsData.length > 0) projects = projectsData;
      if (recycleData.length > 0)  recycleBin = recycleData;

      // 6. 同步到 localStorage
      markStorageDirty();

      // 7. 重新渲染（IndexedDB 数据可能比 localStorage 更新）
      if (typeof render === 'function') {
        render();
      } else {
        if (DEBUG) console.error('initDatabase: render 函数未定义');
      }
    } else {
      if (DEBUG) console.warn('initDatabase: 数据库初始化失败，继续使用 localStorage 数据');
    }
  } catch (error) {
    if (DEBUG) console.error('initDatabase: 初始化异常:', error);
    // 重新抛出，让上层 initApp 处理
    throw error;
  }
}

// 从 localStorage 加载数据（快速路径，作为首屏数据源）
function loadFromLocalStorage() {
  try {
    let hasData = false;

    if (DEBUG) console.log('loadFromLocalStorage: 开始加载...');

    const raw = localStorage.getItem(STORAGE_KEY.PROJECTS);
    if (raw) {
      try {
        projects = JSON.parse(raw);
        // 确保每个项目都有 monthlyProgress 字段
        projects = projects.map(p => ({
          monthlyProgress: [],
          ...p
        }));
        if (DEBUG) console.log('loadFromLocalStorage: 项目数据加载成功，数量：', projects.length);
        hasData = true;
      } catch (parseError) {
        if (DEBUG) console.error('loadFromLocalStorage: 解析项目数据失败：', parseError);
        projects = [];
      }
    } else {
      if (DEBUG) console.log('loadFromLocalStorage: localStorage 中没有项目数据');
      projects = [];
    }

    const recycleRaw = localStorage.getItem(STORAGE_KEY.RECYCLE);
    if (recycleRaw) {
      try {
        recycleBin = JSON.parse(recycleRaw);
        if (DEBUG) console.log('loadFromLocalStorage: 回收站数据加载成功，数量：', recycleBin.length);
      } catch (parseError) {
        if (DEBUG) console.error('loadFromLocalStorage: 解析回收站数据失败：', parseError);
        recycleBin = [];
      }
    } else {
      recycleBin = [];
    }

    if (DEBUG) console.log('loadFromLocalStorage: 加载完成，项目数:', projects.length, '回收站数:', recycleBin.length);

    // 有数据才触发渲染，避免空白闪烁
    if (projects.length > 0 && typeof render === 'function') render();

    return hasData;
  } catch (error) {
    if (DEBUG) console.error('loadFromLocalStorage: 加载失败：', error);
    projects = [];
    recycleBin = [];
    return false;
  }
}

// 保存数据到localStorage


// 导出数据为JSON文件
function exportData() {
  try {
    // 导出配置信息
    const config = {
      aiProvider: localStorage.getItem(STORAGE_KEY.AI_PROVIDER),
      aiModel: localStorage.getItem(STORAGE_KEY.AI_MODEL),
      aiKey: localStorage.getItem(STORAGE_KEY.AI_KEY),
      aiProxy: localStorage.getItem(STORAGE_KEY.AI_PROXY),
      aiModelPolicy: localStorage.getItem(STORAGE_KEY.AI_MODEL_POLICY),
      aiMaxTokens: localStorage.getItem(STORAGE_KEY.AI_MAX_TOKENS),
      yuqueProxy: localStorage.getItem(STORAGE_KEY.YUQUE_PROXY),
      yuqueToken: localStorage.getItem(STORAGE_KEY.YUQUE_TOKEN),
      yuqueUrl: localStorage.getItem(STORAGE_KEY.YUQUE_URL),
      parseMode: localStorage.getItem(STORAGE_KEY.PARSE_MODE),
      sbCollapsed: localStorage.getItem(STORAGE_KEY.SB_COLLAPSED),
      // 导出本地文件目录信息（只能导出名称，不能导出句柄）
      fsRootName: window.fsRootHandle ? window.fsRootHandle.name : null
    };
    
    const exportData = {
      projects: projects,
      recycleBin: recycleBin,
      config: config,
      exportDate: new Date().toISOString(),
      version: '1.4' // 增加版本号
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
          
          // 构建确认消息
          let msg = `确定要导入数据吗？这将会覆盖当前的${importData.projects.length}个项目和${importData.recycleBin ? importData.recycleBin.length : 0}个回收站项目。`;
          if (importData.config) {
            msg += '\n同时会导入配置信息。';
            if (importData.config.fsRootName) {
              msg += `\n导出时使用的本地文件目录：${importData.config.fsRootName}`;
              msg += '\n注意：由于浏览器安全限制，需要手动重新选择根目录。';
            }
          }
          
          showConfirm({ 
            icon: '📤', 
            title: '导入数据', 
            msg: msg, 
            okText: '导入',
            onOk: async () => {
              // 更新内存中的数据
              projects = importData.projects;
              recycleBin = importData.recycleBin || [];
              
              // 导入配置信息
              if (importData.config) {
                try {
                  // 保存配置到 localStorage
                  if (importData.config.aiProvider) localStorage.setItem(STORAGE_KEY.AI_PROVIDER, importData.config.aiProvider);
                  if (importData.config.aiModel) localStorage.setItem(STORAGE_KEY.AI_MODEL, importData.config.aiModel);
                  if (importData.config.aiKey) localStorage.setItem(STORAGE_KEY.AI_KEY, importData.config.aiKey);
                  if (importData.config.aiProxy) localStorage.setItem(STORAGE_KEY.AI_PROXY, importData.config.aiProxy);
                  if (importData.config.aiModelPolicy) localStorage.setItem(STORAGE_KEY.AI_MODEL_POLICY, importData.config.aiModelPolicy);
                  if (importData.config.aiMaxTokens) localStorage.setItem(STORAGE_KEY.AI_MAX_TOKENS, importData.config.aiMaxTokens);
                  if (importData.config.yuqueProxy) localStorage.setItem(STORAGE_KEY.YUQUE_PROXY, importData.config.yuqueProxy);
                  if (importData.config.yuqueToken) localStorage.setItem(STORAGE_KEY.YUQUE_TOKEN, importData.config.yuqueToken);
                  if (importData.config.yuqueUrl) localStorage.setItem(STORAGE_KEY.YUQUE_URL, importData.config.yuqueUrl);
                  if (importData.config.parseMode) localStorage.setItem(STORAGE_KEY.PARSE_MODE, importData.config.parseMode);
                  if (importData.config.sbCollapsed) localStorage.setItem(STORAGE_KEY.SB_COLLAPSED, importData.config.sbCollapsed);
                } catch (configError) {
                  if (DEBUG) console.error('导入配置信息失败：', configError);
                }
              }
              
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

// 存入缓存（将当前数据保存到localStorage）
function importFromLocalStorage() {
  try {
    showConfirm({ 
      icon: '💾', 
      title: '存入缓存', 
      msg: '确定要将当前数据保存到localStorage缓存吗？这将覆盖原有的缓存数据。', 
      okText: '保存',
      onOk: () => {
        try {
          localStorage.setItem(STORAGE_KEY.PROJECTS, JSON.stringify(projects));
          localStorage.setItem(STORAGE_KEY.RECYCLE, JSON.stringify(recycleBin));
          showToast('数据已存入缓存');
        } catch (saveError) {
          if (DEBUG) console.error('存入缓存失败：', saveError);
          showToast('存入缓存失败：' + saveError.message);
        }
      }
    });
  } catch (error) {
    if (DEBUG) console.error('存入缓存失败：', error);
    showToast('存入缓存失败：' + error.message);
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

// ═══════════════════════════════════════════════════
// 项目编号生成
// ═══════════════════════════════════════════════════

// 生成4位随机字符（数字0-9 + 大写字母A-Z）
function genIdCode() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// 生成项目编号
function genProjectCode(stage, contractDate) {
  const now = new Date();
  let ym;
  if (stage === STAGE.NEGOTIATING) {
    ym = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,'0');
  } else {
    const d = contractDate ? new Date(contractDate) : now;
    ym = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0');
  }
  const prefix = stage === STAGE.NEGOTIATING ? 'C' : 'P';

  // 检查是否已存在相同代码，存在则重新生成
  const existingCodes = new Set(projects.map(p => p.projectCode).filter(Boolean));
  let uniqueCode, attempt = 0;
  do {
    uniqueCode = genIdCode();
    attempt++;
  } while (existingCodes.has(prefix + ym + uniqueCode) && attempt < 100);

  return prefix + ym + uniqueCode;
}

// 更新项目编号前缀（合同阶段变更时，唯一代码保持不变）
function updateCodePrefix(code, newStage, contractDate) {
  if (!code) return null;
  if (!code.startsWith('C') && !code.startsWith('P')) return code;
  const newPrefix = newStage === STAGE.NEGOTIATING ? 'C' : 'P';
  const uniqueCode = code.slice(-4);
  let ym = code.slice(1, 5);
  if (newStage !== STAGE.NEGOTIATING && contractDate) {
    const d = new Date(contractDate);
    ym = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0');
  }
  return newPrefix + ym + uniqueCode;
}

// 获取项目目录名（文件夹命名规则：{项目来源}{日期}-{项目名称}）
function getProjectDirName(p) {
  const channel = p.channel || '';
  let dateStr = '';

  if (p.contractDate) {
    const d = new Date(p.contractDate);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateStr = `${yyyy}${mm}${dd}`;
  } else {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    dateStr = `${yyyy}${mm}${dd}`;
  }

  const name = (p.name || '未命名').replace(/[\\/:*?"<>|]/g, '_');
  return channel + dateStr + '-' + name;
}

// 添加默认回款节点（验收后100%回款）
function addDefaultPaymentNode(p) {
  if (!p.paymentNodes || p.paymentNodes.length === 0) {
    p.paymentNodes = [{
      condition: '验收后结清',
      ratio: '100%',
      amount: '',
      actualAmount: '',
      done: false,
      deliverDone: false
    }];
  }
}

// 更新项目活跃度
// isNew: true 表示本次导入新增的项目，没有进度记录时设为活跃
function updateProjectActivity(project, isNew = false) {
  // 如果是执行中或已完成项目，始终设为活跃
  if (project.stage === STAGE.DELIVERING || project.stage === STAGE.COMPLETED) {
    project.active = 'active';
    return;
  }

  // 对于洽谈中项目，根据最近进度更新时间判断
  if (project.stage === STAGE.NEGOTIATING) {
    const progress = project.monthlyProgress || [];
    if (progress.length === 0) {
      // 新增项目没有进度记录是正常的 → 活跃
      // 已有项目没有进度记录 → 不活跃
      project.active = isNew ? 'active' : 'inactive';
      return;
    }

    const sortedProgress = [...progress].sort((a, b) => {
      const [yearA, monthA] = a.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
      const [yearB, monthB] = b.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
      return yearB - yearA || monthB - monthA;
    });

    const [latestYear, latestMonth] = sortedProgress[0].month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    const now = new Date();
    const monthDiff = (now.getFullYear() - latestYear) * 12 + (now.getMonth() + 1 - latestMonth);
    project.active = monthDiff > 1 ? 'inactive' : 'active';
  }
}

// 变更项目合同阶段
function moveStage(id, newStage) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  const oldStage   = p.stage;
  const oldDirName = getProjectDirName(p);
  p.stage = newStage;
  const ts = new Date();
  p.updatedAt = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
  if (p.projectCode) {
    const newCode = updateCodePrefix(p.projectCode, newStage, p.contractDate);
    if (newCode !== p.projectCode) {
      p.projectCode = newCode;
      renameProjectDir(oldDirName, getProjectDirName(p));
    }
  }
  if (oldStage === STAGE.NEGOTIATING && newStage === STAGE.DELIVERING) {
    organizeFilesForProjectStart(p.id);
    addDefaultPaymentNode(p);
  }
  // 如果切换到执行中或已完成，自动设置为活跃
  if (newStage === STAGE.DELIVERING || newStage === STAGE.COMPLETED) {
    p.active = "active";
  }
  markProjectModified(id);
  save();
  refreshView();
  if (newStage !== STAGE.NEGOTIATING && !p.contractDate) {
    showToast('⚠️ 请补填合同签署日期（点击卡片→基本信息Tab）');
  }
}

// 删除项目（移动至回收站）
function deleteProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  showConfirm({ icon:'🗑', title:'删除项目', msg:`确认将「${p.name}」移至回收站？您可以在回收站中恢复此项目。`, okText:'移至回收站',
    onOk: async () => { await moveToRecycleBin(id); }
  });
}

// 清空所有项目（包括回收站）
async function clearAll() {
  showConfirm({ icon:'🗑', title:'清空所有项目', msg:'将删除全部项目数据，不可撤销。', okText:'全部清空',
    onOk: async () => {
      projects = [];
      recycleBin = [];
      await db.clearRecycleBin();
      const allProjects = await db.getProjects();
      for (const project of allProjects) await db.deleteProject(project.id);
      saveToLocalStorage();
      save();
      refreshView();
      showToast('已清空');
    }
  });
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
  closeRecycleBin,
  genIdCode,
  genProjectCode,
  updateCodePrefix,
  getProjectDirName,
  moveStage,
  addDefaultPaymentNode,
  updateProjectActivity,
  deleteProject,
  clearAll,
};