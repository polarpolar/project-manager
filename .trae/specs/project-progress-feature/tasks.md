# 项目进度导入与管理功能 - 实施计划

## [ ] Task 1: 新增项目数据结构支持
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在项目对象中新增 `monthlyProgress` 字段
  - 设置默认值为 `[]`
  - 确保数据结构符合设计要求
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: 新项目默认包含空的 monthlyProgress 数组
  - `programmatic` TR-1.2: 现有项目升级后包含空的 monthlyProgress 数组
- **Notes**: 需修改 project-module.js 或相关数据处理文件

## [ ] Task 2: 实现进度列识别函数
- **Priority**: P0
- **Depends On**: Task 1
- **Description**:
  - 在 import-module.js 中实现 `identifyProgressColumns(headers)` 函数
  - 调用 LLM 识别进度列并标准化月份格式
  - 结果缓存到 `window.yuqueProgressColMap`
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 正确识别包含年月的列名
  - `programmatic` TR-2.2: 正确识别只有月份的列名并补全年份
  - `programmatic` TR-2.3: 正确过滤非进度列
- **Notes**: 需确保 LLM 调用在 fetchYuqueDoc 阶段执行

## [ ] Task 3: 实现进度提取与合并函数
- **Priority**: P0
- **Depends On**: Task 2
- **Description**:
  - 实现 `extractProgressFromRow(row, colMap)` 函数提取进度内容
  - 实现 `mergeMonthlyProgress(existing, incoming)` 函数合并进度数据
  - 确保合并逻辑正确：同月覆盖，新月追加，按月份升序排列
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-3.1: 正确提取非空进度内容
  - `programmatic` TR-3.2: 正确合并进度数据，处理同月更新和新月追加
  - `programmatic` TR-3.3: 合并后数据按月份升序排列
- **Notes**: 需处理空单元格跳过逻辑

## [ ] Task 4: 集成到语雀导入流程
- **Priority**: P0
- **Depends On**: Task 3
- **Description**:
  - 在 `fetchYuqueDoc` 中调用进度列识别
  - 在 `confirmYuqueImport` 中调用进度提取和合并
  - 统计进度更新数量并在导入完成时提示
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: 语雀导入时正确识别进度列
  - `programmatic` TR-4.2: 进度数据正确合并到项目中
  - `human-judgment` TR-4.3: 导入完成后显示包含进度更新数量的提示
- **Notes**: 确保 LLM 结果缓存复用，避免重复调用

## [ ] Task 5: 新增项目进度Tab HTML
- **Priority**: P1
- **Depends On**: Task 4
- **Description**:
  - 在 project-manager.html 中新增"项目进度"Tab
  - 根据项目阶段动态调整Tab顺序
  - 设计进度展示的HTML结构
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-5.1: 洽谈中项目Tab顺序正确
  - `human-judgment` TR-5.2: 执行中/已完结项目Tab顺序正确
  - `human-judgment` TR-5.3: 进度Tab样式符合设计要求
- **Notes**: 需确保Tab切换功能正常

## [ ] Task 6: 实现进度渲染函数
- **Priority**: P1
- **Depends On**: Task 5
- **Description**:
  - 在 modal-form.js 中实现 `renderMonthlyProgress(project)` 函数
  - 支持倒序展示进度记录
  - 实现超过3行时的折叠/展开功能
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-6.1: 进度记录按倒序展示
  - `human-judgment` TR-6.2: 超过3行的进度内容自动折叠
  - `human-judgment` TR-6.3: 展开/收起按钮功能正常
- **Notes**: 需处理无进度记录时的提示

## [ ] Task 7: 集成到项目编辑面板
- **Priority**: P1
- **Depends On**: Task 6
- **Description**:
  - 在 `switchModalTab` 中支持新的"项目进度"Tab
  - 打开项目编辑面板时根据阶段显示/隐藏"回款管理"Tab
  - 确保进度Tab在不同阶段都能正常显示
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-7.1: 项目编辑面板能正常切换到进度Tab
  - `human-judgment` TR-7.2: 不同阶段的Tab顺序正确
  - `human-judgment` TR-7.3: 无进度记录时显示正确提示
- **Notes**: 需确保与现有Tab切换逻辑兼容

## [ ] Task 8: 测试与优化
- **Priority**: P2
- **Depends On**: Task 7
- **Description**:
  - 测试语雀导入进度识别和同步功能
  - 测试进度展示和折叠/展开功能
  - 优化性能和用户体验
- **Acceptance Criteria Addressed**: 所有AC
- **Test Requirements**:
  - `programmatic` TR-8.1: 语雀导入功能正常，进度数据正确同步
  - `human-judgment` TR-8.2: 界面响应速度快，无明显延迟
  - `human-judgment` TR-8.3: 整体用户体验流畅
- **Notes**: 需测试各种边界情况，如空进度、长进度内容等