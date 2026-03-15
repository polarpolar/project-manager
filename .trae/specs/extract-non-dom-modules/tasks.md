# 提取无 DOM 依赖的模块 - 实现计划

## [ ] Task 1: 分析当前 save() 函数的实现
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 查看 save() 函数的当前实现，了解其功能和依赖
  - 识别其中的视图刷新调用
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**: 
  - `human-judgement` TR-1.1: 确认 save() 函数中包含视图刷新调用
  - `human-judgement` TR-1.2: 分析函数的职责边界
- **Notes**: 重点关注函数末尾的 render()、renderTodosPanel()、renderLedger() 调用

## [ ] Task 2: 修改 save() 函数，移除视图刷新调用
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 修改 save() 函数，只保留数据持久化逻辑
  - 移除所有视图刷新相关的代码
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**: 
  - `programmatic` TR-2.1: save() 函数执行后数据正确持久化到 localStorage
  - `programmatic` TR-2.2: save() 函数执行后不触发视图刷新
- **Notes**: 确保函数仍然正确处理数据持久化和存储限制

## [ ] Task 3: 创建统一的视图刷新函数
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 创建 refreshView() 函数，包含原有的视图刷新逻辑
  - 确保函数能够刷新所有相关的视图组件
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**: 
  - `programmatic` TR-3.1: refreshView() 函数能够正确刷新所有视图
  - `human-judgement` TR-3.2: 函数命名清晰，职责明确
- **Notes**: 可以将原 save() 函数中的视图刷新逻辑迁移到这个新函数中

## [ ] Task 4: 更新调用 save() 的地方，添加视图刷新
- **Priority**: P0
- **Depends On**: Task 3
- **Description**: 
  - 找到所有调用 save() 的地方
  - 在需要视图刷新的地方添加 refreshView() 调用
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**: 
  - `programmatic` TR-4.1: 所有需要视图刷新的操作都能正确刷新
  - `human-judgement` TR-4.2: 代码结构清晰，逻辑正确
- **Notes**: 重点关注 saveProject() 等核心函数

## [ ] Task 5: 分析当前 ai-service 模块的实现
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 查看 ai-service 模块的当前实现
  - 识别其中的 DOM 依赖和网络调用逻辑
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**: 
  - `human-judgement` TR-5.1: 确认模块中包含 DOM 操作
  - `human-judgement` TR-5.2: 分析网络调用逻辑的独立性
- **Notes**: 重点关注 openMonitor()、renderMonitor() 等 DOM 操作函数

## [ ] Task 6: 提取 ai-service 模块，移除 DOM 依赖
- **Priority**: P1
- **Depends On**: Task 5
- **Description**: 
  - 将 ai-service 模块中的网络调用逻辑提取出来
  - 移除所有 DOM 相关的代码
  - 确保模块只包含纯粹的网络调用逻辑
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**: 
  - `human-judgement` TR-6.1: 模块代码中不包含 DOM 操作
  - `human-judgement` TR-6.2: 模块只包含网络调用逻辑
- **Notes**: 保留 claudeCall() 和 AI_PROVIDERS 等核心功能

## [ ] Task 7: 验证 AI 调用功能正常
- **Priority**: P1
- **Depends On**: Task 6
- **Description**: 
  - 测试 AI 相关功能
  - 确保 AI 调用能够正常执行
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**: 
  - `programmatic` TR-7.1: AI 调用能够正常发起
  - `programmatic` TR-7.2: AI 调用结果能够正确处理
- **Notes**: 测试台账 AI 筛选等核心功能

## [ ] Task 8: 验证数据保存功能正常
- **Priority**: P1
- **Depends On**: Task 4
- **Description**: 
  - 测试数据保存功能
  - 确保数据能够正确保存和刷新
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**: 
  - `programmatic` TR-8.1: 数据能够正确保存到 localStorage
  - `programmatic` TR-8.2: 视图能够通过 refreshView() 正确刷新
- **Notes**: 测试项目创建、编辑、删除等操作