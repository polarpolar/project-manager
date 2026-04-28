# 项目代码优化 - 实现计划

## [ ] Task 1: 创建统一状态管理模块
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建 `js/core/store.js` 文件
  - 定义统一的状态对象和状态操作函数
  - 包含 projects、recycleBin、statsFilter 等核心状态
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: store.js 文件存在并正确导出 store 对象和 setState/getState 函数
  - `human-judgement` TR-1.2: 代码结构清晰，注释完善
- **Notes**: 需要后续更新其他模块以使用新的状态管理

## [ ] Task 2: 统一 DEBUG 常量定义
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 main.js 顶部统一定义 DEBUG 常量
  - 添加开发环境自动检测逻辑
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: DEBUG 常量正确定义且可被其他模块访问
  - `programmatic` TR-2.2: localhost 和 debug 参数能正确启用调试模式
- **Notes**: 检查所有模块是否使用 `if (DEBUG)` 模式

## [ ] Task 3: 添加全局错误边界处理
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 main.js 中添加 window.error 监听器
  - 添加 window.unhandledrejection 监听器
  - 实现用户友好的错误提示
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-3.1: 全局错误能被捕获并显示提示
  - `programmatic` TR-3.2: Promise 拒绝能被妥善处理
- **Notes**: 需要确保 showToast 函数已存在

## [ ] Task 4: 数据库模块重构 - 提取公共删除方法
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 在 db.js 中添加 `deleteByIndex` 辅助方法
  - 简化 `saveProject` 方法中的重复删除逻辑
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-4.1: deleteByIndex 方法能正确删除指定索引的数据
  - `human-judgement` TR-4.2: saveProject 代码重复率降低
- **Notes**: 需要测试数据完整性

## [ ] Task 5: 渲染缓存优化
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 在 render.js 中添加缓存大小限制常量
  - 实现 LRU 缓存清理策略
  - 添加项目级缓存清理功能
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-5.1: 缓存超过 MAX_CACHE_SIZE 时自动清理
  - `programmatic` TR-5.2: 单个项目缓存可单独清理
- **Notes**: 需要测试性能影响

## [ ] Task 6: 文件系统模块重构
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 重构 `getProjectDirById` 函数
  - 提取 `tryRecoverFromStorage` 子函数
  - 简化多层嵌套逻辑
- **Acceptance Criteria Addressed**: [AC-6]
- **Test Requirements**:
  - `programmatic` TR-6.1: 文件系统操作正常工作
  - `human-judgement` TR-6.2: 代码可读性提升
- **Notes**: 需要测试各种边界情况

## [x] Task 7: 添加 ESLint 配置
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 创建 `.eslintrc.json` 配置文件
  - 添加基本代码规范规则
- **Acceptance Criteria Addressed**: [AC-7]
- **Test Requirements**:
  - `programmatic` TR-7.1: ESLint 配置文件存在且有效
  - `programmatic` TR-7.2: 能检测常见代码问题
- **Notes**: 需要安装 ESLint

## [ ] Task 8: 更新模块导入状态管理
- **Priority**: P1
- **Depends On**: Task 1
- **Description**: 
  - 更新 project.js 使用 store 模块
  - 更新 render.js 使用 store 模块
  - 更新其他相关模块
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-8.1: 所有模块能正确导入和使用 store
  - `programmatic` TR-8.2: 应用功能正常运行
- **Notes**: 需要逐步更新，避免一次性改动过大