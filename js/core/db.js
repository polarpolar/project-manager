// ╔══════════════════════════════════════════╗
// ║  MODULE: db（数据库管理）                 ║
// ╚══════════════════════════════════════════╝

class Database {
  constructor(dbName = 'project_manager.db') {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    try {
      if (!('indexedDB' in window)) {
        if (window.DEBUG) console.error('浏览器不支持IndexedDB');
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = (event) => {
          this.db = event.target.result;
          this.createTables();
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(true);
        };

        request.onerror = (event) => {
          if (window.DEBUG) console.error('数据库打开失败:', event.target.error);
          reject(false);
        };
      });
    } catch (error) {
      if (window.DEBUG) console.error('数据库初始化失败:', error);
      return false;
    }
  }

  createTables() {
    // 项目表
    if (!this.db.objectStoreNames.contains('projects')) {
      const projectStore = this.db.createObjectStore('projects', { keyPath: 'id' });
      projectStore.createIndex('stage', 'stage');
      projectStore.createIndex('createdAt', 'createdAt');
    }

    // 回款节点表
    if (!this.db.objectStoreNames.contains('paymentNodes')) {
      const nodeStore = this.db.createObjectStore('paymentNodes', { keyPath: 'id', autoIncrement: true });
      nodeStore.createIndex('projectId', 'projectId');
    }

    // 催款任务表
    if (!this.db.objectStoreNames.contains('collectTasks')) {
      const taskStore = this.db.createObjectStore('collectTasks', { keyPath: 'id', autoIncrement: true });
      taskStore.createIndex('projectId', 'projectId');
      taskStore.createIndex('done', 'done');
    }

    // 待办事项表
    if (!this.db.objectStoreNames.contains('todos')) {
      const todoStore = this.db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
      todoStore.createIndex('projectId', 'projectId');
      todoStore.createIndex('done', 'done');
    }

    // 更新日志表
    if (!this.db.objectStoreNames.contains('logs')) {
      const logStore = this.db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      logStore.createIndex('projectId', 'projectId');
      logStore.createIndex('time', 'time');
    }

    // 回收站表
    if (!this.db.objectStoreNames.contains('recycleBin')) {
      this.db.createObjectStore('recycleBin', { keyPath: 'id' });
    }
  }

  // ────────────────────────────────────────────
  // 辅助方法：通过索引批量删除数据
  // ────────────────────────────────────────────
  async deleteByIndex(store, indexName, value) {
    return new Promise((resolve) => {
      const index = store.index(indexName);
      const cursorRequest = index.openCursor(value);
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.value.id);
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  // 通用事务方法
  async transaction(storeNames, mode, callback) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(storeNames, mode);

        let callbackArg;
        if (typeof storeNames === 'string') {
          callbackArg = transaction.objectStore(storeNames);
        } else {
          callbackArg = {};
          storeNames.forEach(name => {
            callbackArg[name] = transaction.objectStore(name);
          });
        }

        const result = callback(callbackArg);

        if (result && typeof result.then === 'function') {
          result.then(resolvedResult => {
            transaction.oncomplete = () => resolve(resolvedResult);
          }).catch(error => {
            transaction.abort();
            reject(error);
          });
        } else {
          transaction.oncomplete = () => resolve(result);
        }

        transaction.onerror = (event) => {
          transaction.abort();
          reject(event.target.error);
        };

        transaction.onabort = () => {
          reject(new Error('事务被中止'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // ────────────────────────────────────────────
  // 项目相关操作
  // ────────────────────────────────────────────
  async saveProject(project) {
    try {
      await this.transaction(
        ['projects', 'paymentNodes', 'collectTasks', 'todos', 'logs'],
        'readwrite',
        async (stores) => {
          // 保存项目基本信息
          stores.projects.put(project);

          // 保存回款节点（先删后写）
          if (project.paymentNodes && project.paymentNodes.length) {
            await this.deleteByIndex(stores.paymentNodes, 'projectId', project.id);
            for (const node of project.paymentNodes) {
              stores.paymentNodes.add({ ...node, projectId: project.id });
            }
          }

          // 保存催款任务（先删后写）
          if (project.collectTasks && project.collectTasks.length) {
            await this.deleteByIndex(stores.collectTasks, 'projectId', project.id);
            for (const task of project.collectTasks) {
              stores.collectTasks.add({ ...task, projectId: project.id });
            }
          }

          // 保存待办事项（先删后写）
          if (project.todos && project.todos.length) {
            await this.deleteByIndex(stores.todos, 'projectId', project.id);
            for (const todo of project.todos) {
              stores.todos.add({ ...todo, projectId: project.id });
            }
          }

          // 保存更新日志（先删后写）
          await this.deleteByIndex(stores.logs, 'projectId', project.id);
          if (project.logs && project.logs.length) {
            for (const log of project.logs) {
              stores.logs.add({ ...log, projectId: project.id });
            }
          }
        }
      );
      return true;
    } catch (error) {
      if (window.DEBUG) console.error('保存项目失败:', error);
      return false;
    }
  }

  async getProjects() {
    try {
      const projects = await this.transaction('projects', 'readonly', (store) => {
        const request = store.getAll();
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
        });
      });

      if (projects.length === 0) return projects;

      const projectMap = new Map();
      projects.forEach(project => {
        project.paymentNodes = [];
        project.collectTasks = [];
        project.todos = [];
        project.logs = [];
        projectMap.set(project.id, project);
      });

      // 加载回款节点
      await this.transaction('paymentNodes', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor();
        return new Promise((resolve) => {
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const node = cursor.value;
              const project = projectMap.get(node.projectId);
              if (project) {
                delete node.projectId;
                delete node.id;
                project.paymentNodes.push(node);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
        });
      });

      // 加载催款任务
      await this.transaction('collectTasks', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor();
        return new Promise((resolve) => {
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const task = cursor.value;
              const project = projectMap.get(task.projectId);
              if (project) {
                delete task.projectId;
                delete task.id;
                project.collectTasks.push(task);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
        });
      });

      // 加载待办事项
      await this.transaction('todos', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor();
        return new Promise((resolve) => {
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const todo = cursor.value;
              const project = projectMap.get(todo.projectId);
              if (project) {
                delete todo.projectId;
                delete todo.id;
                project.todos.push(todo);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
        });
      });

      // 加载更新日志
      await this.transaction('logs', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor();
        return new Promise((resolve) => {
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const log = cursor.value;
              const project = projectMap.get(log.projectId);
              if (project) {
                delete log.projectId;
                delete log.id;
                project.logs.push(log);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
        });
      });

      return projects;
    } catch (error) {
      if (window.DEBUG) console.error('获取项目失败:', error);
      return [];
    }
  }

  async getProjectById(id) {
    try {
      const project = await this.transaction('projects', 'readonly', (store) => {
        const request = store.get(id);
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
        });
      });

      if (!project) return null;

      project.paymentNodes = await this.transaction('paymentNodes', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.getAll(id);
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result.map(node => {
            delete node.projectId;
            delete node.id;
            return node;
          }));
        });
      });

      project.collectTasks = await this.transaction('collectTasks', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.getAll(id);
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result.map(task => {
            delete task.projectId;
            delete task.id;
            return task;
          }));
        });
      });

      project.todos = await this.transaction('todos', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.getAll(id);
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result.map(todo => {
            delete todo.projectId;
            delete todo.id;
            return todo;
          }));
        });
      });

      project.logs = await this.transaction('logs', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.getAll(id);
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result.map(log => {
            delete log.projectId;
            delete log.id;
            return log;
          }));
        });
      });

      return project;
    } catch (error) {
      if (window.DEBUG) console.error('获取项目失败:', error);
      return null;
    }
  }

  async deleteProject(id) {
    try {
      await this.transaction(
        ['projects', 'paymentNodes', 'collectTasks', 'todos', 'logs'],
        'readwrite',
        async (stores) => {
          stores.projects.delete(id);
          await this.deleteByIndex(stores.paymentNodes, 'projectId', id);
          await this.deleteByIndex(stores.collectTasks, 'projectId', id);
          await this.deleteByIndex(stores.todos, 'projectId', id);
          await this.deleteByIndex(stores.logs, 'projectId', id);
        }
      );
      return true;
    } catch (error) {
      if (window.DEBUG) console.error('删除项目失败:', error);
      return false;
    }
  }

  // ────────────────────────────────────────────
  // 回收站操作
  // ────────────────────────────────────────────
  async saveToRecycleBin(project) {
    try {
      await this.transaction('recycleBin', 'readwrite', (store) => {
        store.put(project);
      });
      return true;
    } catch (error) {
      if (window.DEBUG) console.error('保存到回收站失败:', error);
      return false;
    }
  }

  async getRecycleBin() {
    try {
      return await this.transaction('recycleBin', 'readonly', (store) => {
        const request = store.getAll();
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
        });
      });
    } catch (error) {
      if (window.DEBUG) console.error('获取回收站失败:', error);
      return [];
    }
  }

  async deleteFromRecycleBin(id) {
    try {
      await this.transaction('recycleBin', 'readwrite', (store) => {
        store.delete(id);
      });
      return true;
    } catch (error) {
      if (window.DEBUG) console.error('从回收站删除失败:', error);
      return false;
    }
  }

  async clearRecycleBin() {
    try {
      await this.transaction('recycleBin', 'readwrite', (store) => {
        store.clear();
      });
      return true;
    } catch (error) {
      if (window.DEBUG) console.error('清空回收站失败:', error);
      return false;
    }
  }
}

// 导出数据库实例
const db = new Database();
export default db;