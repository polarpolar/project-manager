# 架构优化实施计划 - 第二阶段任务分解

## [x] 任务 1：完成常量提取到文件顶部
- **优先级**：P1
- **依赖**：无
- **描述**：
  - 提取 STORAGE_KEY 和 MAX_STORAGE_BYTES 常量到文件顶部
  - 替换代码中所有裸写的 'pm_projects_v3' 和 'pm_recycle_bin_v1' 字符串
- **成功标准**：
  - 所有存储相关的常量都在文件顶部定义
  - 代码中不再出现裸写的存储键字符串
- **测试要求**：
  - `programmatic` TR-1.1: 搜索代码中不再出现 'pm_projects_v3' 和 'pm_recycle_bin_v1' 字符串
  - `programmatic` TR-1.2: 确认 STORAGE_KEY 和 MAX_STORAGE_BYTES 常量在文件顶部正确定义
- **注意**：确保替换所有出现的位置，包括 localStorage 和 IndexedDB 相关代码

## [x] 任务 2：修复 save() 函数的 db 空指针风险（高优先级）
- **优先级**：P0
- **依赖**：无
- **描述**：
  - 修改 save() 函数，添加 db 是否为 null 的检查
  - 当 db 为 null 时，使用 localStorage 作为备用存储方案
- **成功标准**：
  - save() 函数在 db 为 null 时不会报错
  - 当 db 为 null 时，数据仍能保存到 localStorage
- **测试要求**：
  - `programmatic` TR-2.1: 模拟 db 为 null 的情况，验证 save() 函数不会报错
  - `programmatic` TR-2.2: 验证数据在 db 为 null 时能正确保存到 localStorage
- **注意**：这是高优先级任务，影响系统稳定性

## [x] 任务 3：完成 console.log 替换为 DEBUG 开关
- **优先级**：P1
- **依赖**：无
- **描述**：
  - 为所有裸 console.* 调用添加 DEBUG 开关保护
  - 重点检查 exportData()、renameProjectDir()、parseExcel() 和语雀导入相关函数
- **成功标准**：
  - 代码中所有 console.* 调用都被 DEBUG 开关保护
  - 非 DEBUG 模式下不会输出控制台信息
- **测试要求**：
  - `programmatic` TR-3.1: 搜索代码中不再出现裸 console.* 调用
  - `human-judgement` TR-3.2: 检查关键函数中的 console 调用是否都有 DEBUG 保护
- **注意**：确保不遗漏任何 console 调用，包括 console.log、console.warn、console.error 等

## [x] 任务 4：重命名中文变量名
- **优先级**：P2
- **依赖**：无
- **描述**：
  - 将中文变量名 "立项材料Dir" 重命名为英文变量名 "projectMaterialsDir"
  - 确保所有引用该变量的地方都进行相应修改
- **成功标准**：
  - 代码中不再出现中文变量名 "立项材料Dir"
  - 变量名变更后功能保持不变
- **测试要求**：
  - `programmatic` TR-4.1: 搜索代码中不再出现 "立项材料Dir" 字符串
  - `programmatic` TR-4.2: 验证文件整理功能仍然正常工作
- **注意**：只修改变量名，不改变功能逻辑