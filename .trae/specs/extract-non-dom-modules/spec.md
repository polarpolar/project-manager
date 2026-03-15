# 提取无 DOM 依赖的模块 - 产品需求文档

## Overview
- **Summary**: 将项目中的 store 和 ai-service 模块从视图逻辑中解耦，提取为无 DOM 依赖的独立模块
- **Purpose**: 提高代码的可维护性和可测试性，实现关注点分离
- **Target Users**: 开发人员

## Goals
- 将 save() 函数修改为只负责数据持久化，不触发视图刷新
- 将 ai-service 模块的内容（claudeCall、AI_PROVIDERS）单独聚合，移除 DOM 依赖
- 验证 AI 调用和数据保存功能正常

## Non-Goals (Out of Scope)
- 不修改项目的核心业务逻辑
- 不添加新的功能特性
- 不改变现有的 UI 交互

## Background & Context
当前项目中，store 模块和视图层存在耦合，save() 函数不仅负责数据持久化，还会触发视图刷新。同时，ai-service 模块中混合了 DOM 操作逻辑，影响了模块的可复用性和可测试性。

## Functional Requirements
- **FR-1**: 修改 save() 函数，使其只负责数据持久化，移除所有视图刷新调用
- **FR-2**: 提取 ai-service 模块，移除 DOM 依赖，只保留纯粹的网络调用逻辑
- **FR-3**: 添加统一的视图刷新函数，由调用方决定何时刷新

## Non-Functional Requirements
- **NFR-1**: 代码结构清晰，模块职责明确
- **NFR-2**: 保持现有功能的完整性和正确性
- **NFR-3**: 提高代码的可测试性和可维护性

## Constraints
- **Technical**: 保持在单文件结构内进行修改，不引入新的文件
- **Dependencies**: 依赖现有的 localStorage 和浏览器网络 API

## Assumptions
- 项目的核心业务逻辑保持不变
- 现有的 AI 调用逻辑已经足够干净，只需要移除 DOM 操作

## Acceptance Criteria

### AC-1: save() 函数只负责数据持久化
- **Given**: 调用 save() 函数
- **When**: 数据发生变化
- **Then**: 数据被持久化到 localStorage，但不触发视图刷新
- **Verification**: `programmatic`

### AC-2: ai-service 模块无 DOM 依赖
- **Given**: 查看 ai-service 模块代码
- **When**: 分析模块依赖
- **Then**: 模块只包含网络调用逻辑，不依赖 DOM 元素
- **Verification**: `human-judgment`

### AC-3: AI 调用功能正常
- **Given**: 触发 AI 调用
- **When**: 执行 AI 相关操作
- **Then**: AI 调用成功，功能正常
- **Verification**: `programmatic`

### AC-4: 数据保存功能正常
- **Given**: 保存项目数据
- **When**: 执行保存操作
- **Then**: 数据正确保存，视图可以通过手动刷新更新
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要创建新的模块文件来存放提取的代码？
- [ ] 统一的视图刷新函数应该如何实现？