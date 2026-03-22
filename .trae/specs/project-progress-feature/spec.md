# 项目进度导入与管理功能 - 产品需求文档

## Overview
- **Summary**: 实现从语雀表格导入项目进度记录并在项目管理系统中展示的功能，支持月度进度的自动识别、同步和展示。
- **Purpose**: 解决项目进度信息的自动同步问题，避免手动录入，确保进度数据与语雀表格保持一致。
- **Target Users**: 项目管理人员，需要跟踪项目月度进度的团队成员。

## Goals
- 从语雀表格自动识别和导入项目月度进度记录
- 在项目编辑面板中展示项目进度历史，支持折叠/展开
- 实现进度数据的单向同步（语雀→本地）
- 提供进度更新检测和导入完成提示

## Non-Goals (Out of Scope)
- 手动编辑项目进度记录
- 本地进度数据同步回语雀
- 支持Excel导入时的进度识别（仅语雀导入）

## Background & Context
- 项目管理系统已支持语雀表格导入功能
- 语雀表格中使用月度列存储项目进度
- 每月会新增一列记录当月进度，当月内进度会覆盖更新
- 希望通过LLM模型提高进度列识别的准确性和容错性

## Functional Requirements
- **FR-1**: 语雀表格列名识别，使用LLM识别进度列并标准化为YYYY年M月格式
- **FR-2**: 从语雀表格提取项目进度内容，支持空单元格跳过
- **FR-3**: 合并语雀进度与本地进度，同月覆盖，新月追加
- **FR-4**: 在项目编辑面板新增"项目进度"Tab，按阶段动态调整Tab顺序
- **FR-5**: 倒序展示项目进度，支持超过3行时的折叠/展开
- **FR-6**: 导入完成后统计并提示进度更新情况

## Non-Functional Requirements
- **NFR-1**: LLM调用优化，仅在读取语雀文档时调用一次，结果缓存复用
- **NFR-2**: 界面响应速度，预览阶段即可看到进度识别结果
- **NFR-3**: 数据一致性，确保本地进度数据与语雀表格保持同步

## Constraints
- **Technical**: 依赖LLM API进行列名识别
- **Business**: 进度数据仅支持从语雀同步，不支持手动编辑
- **Dependencies**: 语雀API、现有项目管理系统架构

## Assumptions
- 语雀表格中进度列的命名遵循一定规律，可被LLM识别
- 项目数据结构中已包含必要字段支持进度记录
- 系统已具备调用LLM API的能力

## Acceptance Criteria

### AC-1: 语雀进度列识别
- **Given**: 语雀表格包含进度相关列
- **When**: 调用fetchYuqueDoc获取文档内容
- **Then**: LLM应正确识别进度列并标准化为YYYY年M月格式
- **Verification**: `programmatic`
- **Notes**: 结果应缓存到window.yuqueProgressColMap供后续使用

### AC-2: 进度内容提取与合并
- **Given**: 语雀表格包含项目进度数据
- **When**: 确认导入语雀数据
- **Then**: 系统应提取进度内容并与本地数据合并，同月覆盖，新月追加
- **Verification**: `programmatic`
- **Notes**: 合并后数据应按月份升序存储

### AC-3: 项目进度Tab展示
- **Given**: 项目包含进度记录
- **When**: 打开项目编辑面板
- **Then**: 应显示"项目进度"Tab，按倒序展示进度记录
- **Verification**: `human-judgment`
- **Notes**: Tab顺序应根据项目阶段动态调整

### AC-4: 进度内容折叠/展开
- **Given**: 进度内容超过3行
- **When**: 查看项目进度Tab
- **Then**: 应显示折叠状态和"展开"按钮，点击后展开并显示"收起"按钮
- **Verification**: `human-judgment`

### AC-5: 导入完成提示
- **Given**: 导入语雀数据包含进度更新
- **When**: 导入完成
- **Then**: 应在toast中提示有进度更新的项目数量
- **Verification**: `human-judgment`

## Open Questions
- [ ] LLM API调用失败时的容错处理
- [ ] 进度内容的最大长度限制
- [ ] 历史进度数据的迁移策略