// ╔══════════════════════════════════════════╗
// ║  MODULE: store（统一状态管理）            ║
// ╚══════════════════════════════════════════╝

// 核心状态对象
export const store = {
  projects: [],
  recycleBin: [],
  statsFilter: 'thisYear',
  currentEditProjectId: null,
  editingId: null,
  db: null,
  fsRootHandle: null,
  projectDirMap: {},
  DEBUG: false,
};

// 设置状态
export function setState(key, value) {
  if (key in store) {
    store[key] = value;
    return true;
  }
  console.warn(`store: 未知的状态键 "${key}"`);
  return false;
}

// 获取状态
export function getState(key) {
  if (key in store) {
    return store[key];
  }
  console.warn(`store: 未知的状态键 "${key}"`);
  return undefined;
}

// 初始化状态（从 window 对象迁移）
export function initStoreFromWindow() {
  if (window.projects !== undefined) store.projects = window.projects;
  if (window.recycleBin !== undefined) store.recycleBin = window.recycleBin;
  if (window.statsFilter !== undefined) store.statsFilter = window.statsFilter;
  if (window.currentEditProjectId !== undefined) store.currentEditProjectId = window.currentEditProjectId;
  if (window.editingId !== undefined) store.editingId = window.editingId;
  if (window.db !== undefined) store.db = window.db;
  if (window.fsRootHandle !== undefined) store.fsRootHandle = window.fsRootHandle;
  if (window.projectDirMap !== undefined) store.projectDirMap = window.projectDirMap;
  if (window.DEBUG !== undefined) store.DEBUG = window.DEBUG;
}

// 同步状态到 window（向后兼容）
export function syncStoreToWindow() {
  window.projects = store.projects;
  window.recycleBin = store.recycleBin;
  window.statsFilter = store.statsFilter;
  window.currentEditProjectId = store.currentEditProjectId;
  window.editingId = store.editingId;
  window.db = store.db;
  window.fsRootHandle = store.fsRootHandle;
  window.projectDirMap = store.projectDirMap;
  window.DEBUG = store.DEBUG;
}