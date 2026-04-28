// ╔══════════════════════════════════════════╗
// ║  MODULE: main（应用主入口）              ║
// ╚══════════════════════════════════════════╝

// ────────────────────────────────────────────
// 1. 统一 DEBUG 常量定义
// ────────────────────────────────────────────
window.DEBUG = false;

// 开发环境自动检测
if (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.search.includes('debug')) {
  window.DEBUG = true;
  console.log('🔧 调试模式已启用');
}

// ────────────────────────────────────────────
// 2. 全局错误边界处理
// ────────────────────────────────────────────
window.addEventListener('error', (event) => {
  if (window.DEBUG) console.error('🚨 全局错误:', event.error);
  showToast(`❌ 系统错误：${event.error.message || '未知错误'}`);
});

window.addEventListener('unhandledrejection', (event) => {
  if (window.DEBUG) console.error('🚨 未处理的 Promise 拒绝:', event.reason);
  showToast(`❌ 操作失败：${event.reason?.message || '未知错误'}`);
});

// 通用提示函数
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: #1a1a2e;
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9999;
    font-size: 0.8rem;
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100px); opacity: 0; }
  }
`;
document.head.appendChild(style);

// ────────────────────────────────────────────
// 3. 全局变量（保留向后兼容）
// ────────────────────────────────────────────
window.projects = [];
window.recycleBin = [];
window.editingId = null;
window.currentEditProjectId = null;
window.statsFilter = 'thisYear';
window.db = null;
window.fsRootHandle = null;
window.fsCurrentProjectId = null;

// ────────────────────────────────────────────
// 4. 动态导入各个模块
// ────────────────────────────────────────────
async function loadModules() {
  try {
    // 加载状态管理模块（优先加载）
    const storeModule = await import('./js/core/store.js');
    Object.assign(window, storeModule);
    
    // 加载数据库模块
    const { default: dbModule } = await import('./js/core/db.js');
    window.db = dbModule;
    
    // 加载项目管理模块
    const projectModule = await import('./js/core/project.js');
    Object.assign(window, projectModule);
    
    // 加载渲染模块
    const renderModule = await import('./js/core/render.js');
    Object.assign(window, renderModule);
    
    // 加载AI模块
    const aiModule = await import('./js/ai/engine.js');
    Object.assign(window, aiModule);
    
    // 加载文件系统模块
    const fsModule = await import('./js/file/system.js');
    Object.assign(window, fsModule);

    // 加载待办分析面板模块
    const todosModule = await import('./js/features/todos.js');
    Object.assign(window, todosModule);

    // 加载台账模块
    const ledgerModule = await import('./js/features/ledger.js');
    Object.assign(window, ledgerModule); 

    // 加载 AI 界面控制模块
    const aiUiModule = await import('./js/ai/ui.js');
    Object.assign(window, aiUiModule);

    // 加载导入模块
    const importModule = await import('./js/features/import.js');
    Object.assign(window, importModule);

    // 加载 Modal 表单模块
    const modalModule = await import('./js/ui/modal.js');
    Object.assign(window, modalModule);

    // 加载文件识别分析模块
    const fileAnalysisModule = await import('./js/file/analysis.js');
    Object.assign(window, fileAnalysisModule);

    // 加载 AI 数据分析对话模块
    const aiChatModule = await import('./js/ai/chat.js');
    Object.assign(window, aiChatModule);

    // 加载成本分析模块
    const costModule = await import('./js/features/cost.js');
    Object.assign(window, costModule);

    if (window.DEBUG) console.log('✅ 模块加载成功');
    return true;
  } catch (error) {
    if (window.DEBUG) console.error('❌ 模块加载失败:', error);
    showToast('模块加载失败，请刷新页面重试');
    return false;
  }
}

// ────────────────────────────────────────────
// 5. 初始化应用
// ────────────────────────────────────────────
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
      document.getElementById('importOverlay').addEventListener('click', e => { 
        if (e.target === e.currentTarget) closeImport(); 
      });
      document.getElementById('overlay').addEventListener('click', e => { 
        if (e.target === e.currentTarget) closeModal(); 
      });

      // 初始化 AI 数据分析对话面板
      if (typeof initAiChat === 'function') initAiChat();

      // 尝试恢复根目录
      const saved = await loadRootHandle();
      if (saved) {
        try {
          const perm = await saved.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') { 
            window.fsRootHandle = saved; 
            updateRootBar(); 
            await initProjectDirMap(); 
          }
        } catch(e) {
          if (window.DEBUG) console.warn('恢复根目录权限失败:', e);
        }
      }
    } else {
      showToast('模块加载失败，请刷新页面重试');
    }
  } catch (error) {
    if (window.DEBUG) console.error('❌ 初始化应用失败:', error);
    showToast('初始化失败，请刷新页面重试');
  }
}

// ────────────────────────────────────────────
// 6. 页面加载时初始化应用
// ────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initApp);