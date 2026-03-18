// 主入口脚本，使用动态导入实现代码拆分和懒加载

// 全局变量
window.projects = [];
window.recycleBin = [];
window.editingId = null;
window.currentEditProjectId = null;
window.statsFilter = 'thisYear'; // all 或 thisYear
window.db = null;
window.DEBUG = false;
window.fsRootHandle = null; // 根目录句柄
window.fsCurrentProjectId = null; // 当前文件操作的项目ID

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

    // 加载待办分析面板模块
    const todosModule = await import('./todos-panel.js');
    Object.assign(window, todosModule);

    // 加载台账模块
    const ledgerModule = await import('./ledger.js');
    Object.assign(window, ledgerModule); 

    // 加载 AI 界面控制模块
    const aiUiModule = await import('./ai-ui.js');
    Object.assign(window, aiUiModule);

    // 加载导入模块
    const importModule = await import('./import-module.js');
    Object.assign(window, importModule);

    // 加载 Modal 表单模块
    const modalModule = await import('./modal-form.js');
    Object.assign(window, modalModule);

    // 加载文件识别分析模块
    const fileAnalysisModule = await import('./file-analysis.js?v=2');
    Object.assign(window, fileAnalysisModule);
    
    console.log('模块加载成功');
    return true;
  } catch (error) {
    console.error('模块加载失败:', error);
    return false;
  }
}

// 初始化应用
async function initApp() {
  try {
    // 加载所有模块
    const loadSuccess = await loadModules();
    
    if (loadSuccess) {
      // 初始化数据库
      await window.initDatabase();
      
      // 初始化侧边栏状态（需要在 STORAGE_KEY 加载后执行）
      if (typeof initSidebar === 'function') initSidebar();

      // 初始化导入模块
      initImportDropZone();
      loadYuqueSettings();
      loadParseMode();
      document.getElementById('importOverlay').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeImport(); });
      document.getElementById('overlay').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeModal(); });

      // 尝试恢复根目录
      const saved = await loadRootHandle();
      if (saved) {
        try {
          const perm = await saved.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') { window.fsRootHandle = saved; updateRootBar(); await initProjectDirMap(); }
        } catch(e) {}
      }
    } else {
      // 模块加载失败，显示错误信息
      showToast('模块加载失败，请刷新页面重试');
    }
  } catch (error) {
    console.error('初始化应用失败:', error);
    showToast('初始化失败，请刷新页面重试');
  }
}

// 页面加载时初始化应用
window.addEventListener('DOMContentLoaded', initApp);
