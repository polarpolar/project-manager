// 数据库管理模块
class Database {
  constructor(dbName = 'project_manager.db') {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    try {
      // 检查是否支持IndexedDB
      if (!('indexedDB' in window)) {
        console.error('浏览器不支持IndexedDB');
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
          console.error('数据库打开失败:', event.target.error);
          reject(false);
        };
      });
    } catch (error) {
      console.error('数据库初始化失败:', error);
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

  // 通用事务方法
  async transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      const result = callback(store);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = (event) => reject(event.target.error);
    });
  }

  // 项目相关操作
  async saveProject(project) {
    try {
      // 保存项目基本信息
      await this.transaction('projects', 'readwrite', (store) => {
        store.put(project);
      });

      // 保存回款节点
      if (project.paymentNodes && project.paymentNodes.length) {
        await this.transaction('paymentNodes', 'readwrite', (store) => {
          // 先删除该项目的所有回款节点
          const index = store.index('projectId');
          const request = index.openCursor(project.id);
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              store.delete(cursor.value.id);
              cursor.continue();
            }
          };
        });

        // 再添加新的回款节点
        for (const node of project.paymentNodes) {
          await this.transaction('paymentNodes', 'readwrite', (store) => {
            store.add({ ...node, projectId: project.id });
          });
        }
      }

      // 保存催款任务
      if (project.collectTasks && project.collectTasks.length) {
        await this.transaction('collectTasks', 'readwrite', (store) => {
          // 先删除该项目的所有催款任务
          const index = store.index('projectId');
          const request = index.openCursor(project.id);
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              store.delete(cursor.value.id);
              cursor.continue();
            }
          };
        });

        // 再添加新的催款任务
        for (const task of project.collectTasks) {
          await this.transaction('collectTasks', 'readwrite', (store) => {
            store.add({ ...task, projectId: project.id });
          });
        }
      }

      // 保存待办事项
      if (project.todos && project.todos.length) {
        await this.transaction('todos', 'readwrite', (store) => {
          // 先删除该项目的所有待办事项
          const index = store.index('projectId');
          const request = index.openCursor(project.id);
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              store.delete(cursor.value.id);
              cursor.continue();
            }
          };
        });

        // 再添加新的待办事项
        for (const todo of project.todos) {
          await this.transaction('todos', 'readwrite', (store) => {
            store.add({ ...todo, projectId: project.id });
          });
        }
      }

      // 保存更新日志
      if (project.logs && project.logs.length) {
        for (const log of project.logs) {
          await this.transaction('logs', 'readwrite', (store) => {
            store.add({ ...log, projectId: project.id });
          });
        }
      }

      return true;
    } catch (error) {
      console.error('保存项目失败:', error);
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

      // 为每个项目加载关联数据
      for (const project of projects) {
        // 加载回款节点
        project.paymentNodes = await this.transaction('paymentNodes', 'readonly', (store) => {
          const index = store.index('projectId');
          const request = index.getAll(project.id);
          return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result.map(node => {
              delete node.projectId;
              delete node.id;
              return node;
            }));
          });
        });

        // 加载催款任务
        project.collectTasks = await this.transaction('collectTasks', 'readonly', (store) => {
          const index = store.index('projectId');
          const request = index.getAll(project.id);
          return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result.map(task => {
              delete task.projectId;
              delete task.id;
              return task;
            }));
          });
        });

        // 加载待办事项
        project.todos = await this.transaction('todos', 'readonly', (store) => {
          const index = store.index('projectId');
          const request = index.getAll(project.id);
          return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result.map(todo => {
              delete todo.projectId;
              delete todo.id;
              return todo;
            }));
          });
        });

        // 加载更新日志
        project.logs = await this.transaction('logs', 'readonly', (store) => {
          const index = store.index('projectId');
          const request = index.getAll(project.id);
          return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result.map(log => {
              delete log.projectId;
              delete log.id;
              return log;
            }));
          });
        });
      }

      return projects;
    } catch (error) {
      console.error('获取项目失败:', error);
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

      // 加载关联数据
      project.paymentNodes = await this.transaction('paymentNodes', 'readonly', (store) => {
        const index = store.index('projectId');
        const request = index.getAll(project.id);
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
        const request = index.getAll(project.id);
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
        const request = index.getAll(project.id);
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
        const request = index.getAll(project.id);
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
      console.error('获取项目失败:', error);
      return null;
    }
  }

  async deleteProject(id) {
    try {
      // 从项目表中删除
      await this.transaction('projects', 'readwrite', (store) => {
        store.delete(id);
      });

      // 删除关联的回款节点
      await this.transaction('paymentNodes', 'readwrite', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor(id);
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.value.id);
            cursor.continue();
          }
        };
      });

      // 删除关联的催款任务
      await this.transaction('collectTasks', 'readwrite', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor(id);
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.value.id);
            cursor.continue();
          }
        };
      });

      // 删除关联的待办事项
      await this.transaction('todos', 'readwrite', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor(id);
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.value.id);
            cursor.continue();
          }
        };
      });

      // 删除关联的更新日志
      await this.transaction('logs', 'readwrite', (store) => {
        const index = store.index('projectId');
        const request = index.openCursor(id);
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.value.id);
            cursor.continue();
          }
        };
      });

      return true;
    } catch (error) {
      console.error('删除项目失败:', error);
      return false;
    }
  }

  // 回收站操作
  async saveToRecycleBin(project) {
    try {
      await this.transaction('recycleBin', 'readwrite', (store) => {
        store.put(project);
      });
      return true;
    } catch (error) {
      console.error('保存到回收站失败:', error);
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
      console.error('获取回收站失败:', error);
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
      console.error('从回收站删除失败:', error);
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
      console.error('清空回收站失败:', error);
      return false;
    }
  }
}

// 导出数据库实例
const db = new Database();
export default db;