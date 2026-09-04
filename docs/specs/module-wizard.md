# Spec — 交互式安装向导（src/index.ts）

## 要构建什么

- 目标：跨平台 CLI 入口，编排「备份 → 核心安装 → 主题应用」的完整安装流程，只收集一次用户确认。

## 行为

- 预期行为：
  - 参数：仅支持 `-h/--help`（parseArgs strict=false，其余透传忽略）
  - 平台检测：非 Windows/macOS 仅执行 Claude Code 主题部分并提示；macOS 提示将配置 Terminal.app
  - 前置检查：未检测到 Claude Code CLI 时给出安装命令并退出（exit 1）
  - 已安装检测：提示「将更新配置」
  - 备份：无条件自动执行（平台各自备份，不询问）
  - 核心安装：失败即报错退出（exit 1）
  - 主题确认：唯一交互确认（默认 Yes）；终端主题与 Claude Code 主题绑定应用（DECISIONS ADR-003）
  - 收尾：打印摘要（默认终端 / 主题 / 背景图状态）与后续提示

## 输入 / 输出

- 输入：stdin 交互（一次 confirm）、平台环境
- 输出：终端交互界面（@clack/prompts + picocolors）；退出码 0 / 1

## 约束

- 不提供无人值守参数（DECISIONS ADR-002）
- Ctrl+C / 取消确认：立即退出，不做半截操作

## 边界条件

- 平台不支持：跳过终端部分，但不阻塞 Claude Code 主题
- 主题应用失败：报告错误，不影响已完成的核心安装与收尾输出

## 验收标准

- [ ] 无 Claude Code CLI 的环境运行：输出安装指引且退出码为 1
- [ ] 全新 Windows / macOS 各跑一遍：摘要与实际生效情况一致
- [ ] 主题确认选 No：不改动任何主题配置，备份与核心安装照常完成

## 完成定义

- win32 / darwin / 其他三类平台分支行为均符合上述预期，`pnpm run typecheck` 通过
