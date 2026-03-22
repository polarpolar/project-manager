# 项目活跃度系统实施计划

## 一、项目现状分析

### 现有数据结构
- 项目数据中已有 `active` 字段，值为 "active" 或 "inactive"
- HTML 表单中已有活跃度选择器
- 项目进度功能已实现，包括从语雀导入进度数据
- 导入功能在 `import-module.js` 中实现

### 需求分析
1. 活跃度状态分为活跃和不活跃两种状态
2. 新增项目默认是活跃的
3. 活跃项目如果近1个月没有发生进度更新，则更新状态为"不活跃"
4. 不活跃的项目如果检测到进度更新，则更新状态为"活跃"
5. 每次导入yuque或excel时检测一次更新
6. 执行中和已完成的项目的活跃度默认为活跃

## 二、实施计划

### [ ] 任务1：实现活跃度检测核心函数
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 创建一个 `updateProjectActivity` 函数，用于检测和更新项目活跃度
  - 函数需要根据项目阶段和最近进度更新时间来判断活跃度状态
- **Success Criteria**:
  - 函数能够正确判断项目的活跃度状态
  - 函数能够处理不同项目阶段的活跃度逻辑
- **Test Requirements**:
  - `programmatic` TR-1.1: 函数能够正确识别近1个月内有进度更新的项目
  - `programmatic` TR-1.2: 函数能够正确识别近1个月内无进度更新的项目
  - `programmatic` TR-1.3: 函数能够正确处理执行中和已完成项目的活跃度

### [ ] 任务2：集成到语雀导入流程
- **Priority**: P0
- **Depends On**: 任务1
- **Description**:
  - 在 `confirmYuqueImport` 函数中集成活跃度检测逻辑
  - 在导入完成后，对所有项目进行活跃度检测和更新
- **Success Criteria**:
  - 语雀导入时能够自动检测和更新项目活跃度
  - 导入完成后，项目活跃度状态正确
- **Test Requirements**:
  - `programmatic` TR-2.1: 导入语雀数据后，活跃度状态正确更新
  - `human-judgement` TR-2.2: 导入过程流畅，无明显延迟

### [ ] 任务3：集成到Excel导入流程
- **Priority**: P0
- **Depends On**: 任务1
- **Description**:
  - 在 `confirmImport` 函数中集成活跃度检测逻辑
  - 在导入完成后，对所有项目进行活跃度检测和更新
- **Success Criteria**:
  - Excel导入时能够自动检测和更新项目活跃度
  - 导入完成后，项目活跃度状态正确
- **Test Requirements**:
  - `programmatic` TR-3.1: 导入Excel数据后，活跃度状态正确更新
  - `human-judgement` TR-3.2: 导入过程流畅，无明显延迟

### [ ] 任务4：更新项目创建逻辑
- **Priority**: P1
- **Depends On**: None
- **Description**:
  - 确保新增项目默认设置为活跃状态
  - 在项目创建时设置 `active: "active"`
- **Success Criteria**:
  - 新增项目默认活跃度为活跃
- **Test Requirements**:
  - `programmatic` TR-4.1: 新增项目的 `active` 字段默认值为 "active"

### [ ] 任务5：更新项目阶段切换逻辑
- **Priority**: P1
- **Depends On**: None
- **Description**:
  - 当项目阶段切换为执行中或已完成时，自动将活跃度设置为活跃
  - 在 `onStageChange` 函数中添加相关逻辑
- **Success Criteria**:
  - 执行中和已完成的项目活跃度始终为活跃
- **Test Requirements**:
  - `programmatic` TR-5.1: 项目阶段切换为执行中时，活跃度自动设置为活跃
  - `programmatic` TR-5.2: 项目阶段切换为已完成时，活跃度自动设置为活跃

### [ ] 任务6：测试和验证
- **Priority**: P0
- **Depends On**: 任务1-5
- **Description**:
  - 测试各种场景下的活跃度检测逻辑
  - 验证导入流程中的活跃度更新
  - 确保UI显示正确
- **Success Criteria**:
  - 所有测试场景都能正确处理
  - 活跃度状态在UI中正确显示
- **Test Requirements**:
  - `programmatic` TR-6.1: 所有测试场景都能正确处理
  - `human-judgement` TR-6.2: UI显示正确，用户体验良好

## 三、技术实现细节

### 核心函数设计
```javascript
function updateProjectActivity(project) {
  // 如果是执行中或已完成项目，始终设为活跃
  if (project.stage === STAGE.DELIVERING || project.stage === STAGE.COMPLETED) {
    project.active = "active";
    return;
  }
  
  // 对于洽谈中项目，根据最近进度更新时间判断
  if (project.stage === STAGE.NEGOTIATING) {
    const progress = project.monthlyProgress || [];
    if (progress.length === 0) {
      // 没有进度记录，保持当前状态
      return;
    }
    
    // 找到最近的进度记录
    const sortedProgress = [...progress].sort((a, b) => {
      const [yearA, monthA] = a.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
      const [yearB, monthB] = b.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
      return yearB - yearA || monthB - monthA;
    });
    
    const latestProgress = sortedProgress[0];
    const [latestYear, latestMonth] = latestProgress.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    
    // 获取当前日期
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 月份从0开始，需要加1
    
    // 计算月份差
    const monthDiff = (currentYear - latestYear) * 12 + (currentMonth - latestMonth);
    
    if (monthDiff > 1) {
      // 超过1个月没有更新，设为不活跃
      project.active = "inactive";
    } else {
      // 1个月内有更新，设为活跃
      project.active = "active";
    }
  }
}
```

### 导入流程集成
在 `confirmYuqueImport` 和 `confirmImport` 函数中，导入完成后添加：

```javascript
// 更新所有项目的活跃度
projects.forEach(project => {
  updateProjectActivity(project);
});

// 保存到本地存储
saveToLocalStorage();
```

### 项目创建逻辑更新
在项目创建时，确保设置默认活跃度：

```javascript
const newProject = {
  // 其他字段...
  active: "active",
  // 其他字段...
};
```

### 项目阶段切换逻辑更新
在 `onStageChange` 函数中添加：

```javascript
// 如果切换到执行中或已完成，自动设置为活跃
if (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) {
  const project = projects.find(p => p.id === editingId);
  if (project) {
    project.active = "active";
  }
}
```

## 四、预期效果

1. **自动检测**：系统能够自动检测项目活跃度，无需手动干预
2. **及时更新**：每次导入数据时都会更新活跃度状态
3. **智能判断**：根据项目阶段和最近进度更新时间智能判断活跃度
4. **用户友好**：UI中清晰显示项目活跃度状态
5. **稳定可靠**：逻辑稳定，不会出现误判情况

## 五、风险评估

1. **风险**：进度日期解析错误
   **应对措施**：添加日期解析错误处理，确保即使日期格式不正确也能正常运行

2. **风险**：导入过程中性能问题
   **应对措施**：优化算法，避免不必要的计算，确保导入过程流畅

3. **风险**：UI显示不一致
   **应对措施**：确保数据更新后UI能够及时反映最新状态

## 六、总结

本计划通过实现一个智能的活跃度检测系统，能够自动判断项目的活跃状态，提高项目管理的效率和准确性。系统将根据项目的实际活动情况，自动更新活跃度状态，为项目管理者提供更直观的项目状态信息。