// 主入口脚本，使用动态导入实现代码拆分和懒加载

// 全局变量
window.projects = [];
window.recycleBin = [];
window.editingId = null;
window.currentEditProjectId = null;
window.statsFilter = 'thisYear'; // all 或 thisYear
window.db = null;
window.DEBUG = false;

// 动态导入各个模块
async function loadModules() {
  try {
    // 加载数据库模块
    const { default: dbModule } = await import('./db.js');
    window.db = dbModule;
    
    // 加载项目管理模块
    const projectModule = await import('./project-module.js');
    Object.assign(window, projectModule);
    
    // 加载渲染模块
    const renderModule = await import('./render-module.js');
    Object.assign(window, renderModule);
    
    // 加载AI模块
    const aiModule = await import('./ai-module.js');
    Object.assign(window, aiModule);
    
    // 加载文件系统模块
    const fsModule = await import('./file-system-module.js');
    Object.assign(window, fsModule);
    
    console.log('模块加载成功');
    return true;
  } catch (error) {
    console.error('模块加载失败:', error);
    return false;
  }
}

// 初始化应用
async function initApp() {
  const loadingElement = showLoading();
  
  try {
    // 加载所有模块
    const loadSuccess = await loadModules();
    
    if (loadSuccess) {
      // 初始化数据库
      await initDatabase();
    } else {
      // 模块加载失败，显示错误信息
      showToast('模块加载失败，请刷新页面重试');
    }
  } catch (error) {
    console.error('初始化应用失败:', error);
    showToast('初始化失败，请刷新页面重试');
  } finally {
    hideLoading(loadingElement);
  }
}

// 显示加载状态
function showLoading() {
  const loadingElement = document.createElement('div');
  loadingElement.id = 'loading-overlay';
  loadingElement.style.cssText = `
    position: fixed;
    inset: 0;
    background: var(--paper);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: opacity 0.3s ease;
  `;
  loadingElement.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: 20px;">📊</div>
    <div style="font-size: 1.2rem; font-weight: 600; color: var(--ink); margin-bottom: 10px;">加载中...</div>
    <div style="font-size: 0.9rem; color: var(--ink-light);">正在初始化数据，请稍候</div>
    <div style="margin-top: 30px; display: flex; gap: 8px;">
      <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1.4s infinite;"></div>
      <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1.4s infinite 0.2s;"></div>
      <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1.4s infinite 0.4s;"></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
      }
    </style>
  `;
  document.body.appendChild(loadingElement);
  return loadingElement;
}

// 隐藏加载状态
function hideLoading(loadingElement) {
  if (loadingElement) {
    loadingElement.style.opacity = '0';
    setTimeout(() => {
      if (loadingElement.parentNode) {
        loadingElement.parentNode.removeChild(loadingElement);
      }
    }, 300);
  }
}

// 页面加载时初始化应用
window.addEventListener('DOMContentLoaded', initApp);
