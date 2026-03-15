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
  async transaction(storeNames, mode, callback) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(storeNames, mode);
        
        // 为每个存储对象创建store实例
        const stores = {};
        if (typeof storeNames === 'string') {
          stores[storeNames] = transaction.objectStore(storeNames);
        } else {
          storeNames.forEach(name => {
            stores[name] = transaction.objectStore(name);
          });
        }

        const result = callback(stores);

        // 检查result是否为Promise
        if (result && typeof result.then === 'function') {
          // 如果是Promise，等待它完成
          result.then(resolvedResult => {
            transaction.oncomplete = () => resolve(resolvedResult);
          }).catch(error => {
            transaction.abort();
            reject(error);
          });
        } else {
          // 如果不是Promise，直接resolve
          transaction.oncomplete = () => resolve(result);
        }

        transaction.onerror = (event) => {
          transaction.abort();
          reject(event.target.error);
        };
        
        transaction.onabort = (event) => {
          reject(new Error('事务被中止'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // 项目相关操作
  async saveProject(project) {
    try {
      // 使用单个事务处理所有操作，提高性能
      await this.transaction(['projects', 'paymentNodes', 'collectTasks', 'todos', 'logs'], 'readwrite', async (stores) => {
        // 保存项目基本信息
        stores.projects.put(project);

        // 保存回款节点
        if (project.paymentNodes && project.paymentNodes.length) {
          // 先删除该项目的所有回款节点
          const nodeIndex = stores.paymentNodes.index('projectId');
          const nodeCursorRequest = nodeIndex.openCursor(project.id);
          await new Promise((resolve) => {
            nodeCursorRequest.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                stores.paymentNodes.delete(cursor.value.id);
                cursor.continue();
              } else {
                resolve();
              }
            };
          });

          // 再添加新的回款节点
          for (const node of project.paymentNodes) {
            stores.paymentNodes.add({ ...node, projectId: project.id });
          }
        }

        // 保存催款任务
        if (project.collectTasks && project.collectTasks.length) {
          // 先删除该项目的所有催款任务
          const taskIndex = stores.collectTasks.index('projectId');
          const taskCursorRequest = taskIndex.openCursor(project.id);
          await new Promise((resolve) => {
            taskCursorRequest.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                stores.collectTasks.delete(cursor.value.id);
                cursor.continue();
              } else {
                resolve();
              }
            };
          });

          // 再添加新的催款任务
          for (const task of project.collectTasks) {
            stores.collectTasks.add({ ...task, projectId: project.id });
          }
        }

        // 保存待办事项
        if (project.todos && project.todos.length) {
          // 先删除该项目的所有待办事项
          const todoIndex = stores.todos.index('projectId');
          const todoCursorRequest = todoIndex.openCursor(project.id);
          await new Promise((resolve) => {
            todoCursorRequest.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                stores.todos.delete(cursor.value.id);
                cursor.continue();
              } else {
                resolve();
              }
            };
          });

          // 再添加新的待办事项
          for (const todo of project.todos) {
            stores.todos.add({ ...todo, projectId: project.id });
          }
        }

        // 保存更新日志
        if (project.logs && project.logs.length) {
          for (const log of project.logs) {
            stores.logs.add({ ...log, projectId: project.id });
          }
        }
      });

      return true;
    } catch (error) {
      console.error('保存项目失败:', error);
      return false;
    }
  }

  async getProjects() {
    try {
      // 先获取所有项目
      const projects = await this.transaction('projects', 'readonly', (stores) => {
        const store = stores.projects;
        const request = store.getAll();
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
        });
      });

      if (projects.length === 0) {
        return projects;
      }

      // 批量加载关联数据
      const projectIds = projects.map(p => p.id);
      
      // 创建项目ID到项目对象的映射
      const projectMap = new Map();
      projects.forEach(project => {
        project.paymentNodes = [];
        project.collectTasks = [];
        project.todos = [];
        project.logs = [];
        projectMap.set(project.id, project);
      });

      // 加载回款节点
      await this.transaction('paymentNodes', 'readonly', (stores) => {
        const store = stores.paymentNodes;
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
      await this.transaction('collectTasks', 'readonly', (stores) => {
        const store = stores.collectTasks;
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
      await this.transaction('todos', 'readonly', (stores) => {
        const store = stores.todos;
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
      await this.transaction('logs', 'readonly', (stores) => {
        const store = stores.logs;
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
      // 使用单个事务处理所有删除操作，提高性能
      await this.transaction(['projects', 'paymentNodes', 'collectTasks', 'todos', 'logs'], 'readwrite', async (stores) => {
        // 从项目表中删除
        stores.projects.delete(id);

        // 删除关联的回款节点
        const nodeIndex = stores.paymentNodes.index('projectId');
        const nodeCursorRequest = nodeIndex.openCursor(id);
        await new Promise((resolve) => {
          nodeCursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              stores.paymentNodes.delete(cursor.value.id);
              cursor.continue();
            } else {
              resolve();
            }
          };
        });

        // 删除关联的催款任务
        const taskIndex = stores.collectTasks.index('projectId');
        const taskCursorRequest = taskIndex.openCursor(id);
        await new Promise((resolve) => {
          taskCursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              stores.collectTasks.delete(cursor.value.id);
              cursor.continue();
            } else {
              resolve();
            }
          };
        });

        // 删除关联的待办事项
        const todoIndex = stores.todos.index('projectId');
        const todoCursorRequest = todoIndex.openCursor(id);
        await new Promise((resolve) => {
          todoCursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              stores.todos.delete(cursor.value.id);
              cursor.continue();
            } else {
              resolve();
            }
          };
        });

        // 删除关联的更新日志
        const logIndex = stores.logs.index('projectId');
        const logCursorRequest = logIndex.openCursor(id);
        await new Promise((resolve) => {
          logCursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              stores.logs.delete(cursor.value.id);
              cursor.continue();
            } else {
              resolve();
            }
          };
        });
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