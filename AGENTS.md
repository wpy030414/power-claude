# AGENTS.md

PowerClaude —— 跨平台「终端 + Claude Code」樱花粉主题一键配置工具（TypeScript CLI）。

## 概述

- 本项目是什么：一个本地 CLI（`pnpm run apply`，tsx 直跑 TypeScript），交互式地把 Windows Terminal / macOS Terminal.app 配置成「启动即进入 Claude Code」的 PowerClaude profile，并把终端与 Claude Code CLI 一并换成 Sakura Pink 樱花粉主题；支持背景图与自动备份。

## 边界与范围

- 范围内：
  - Windows Terminal `settings.json`：profile / scheme / theme / 默认启动项 / Tab 切换器 / 新标签菜单
  - macOS Terminal.app 偏好（`com.apple.Terminal.plist`）：profile 直写、背景图 bookmark、启动命令
  - Claude Code 主题文件（`~/.claude/themes/`）与 `~/.claude/settings.json` 的 `theme` 字段
  - 背景图：从仓库 `public/` 自动查找，缓存到 `~/.claude/`
- 非目标（明确排除）：
  - 不修改 Claude Code CLI 本体，不做主题市场分发
  - 不支持 Terminal.app / Windows Terminal 之外的终端（iTerm2、Alacritty、kitty、VS Code 等）
  - 不做 GUI、不做自动更新、不做配置云同步

## Agent 操作指南

- 如何理解本项目：
  - 先读 `docs/ARCHITECTURE.md`（模块图 + 数据流），再按需查 `docs/specs/` 对应模块
  - 行为与需求看 `docs/PRD.md`；历史取舍看 `docs/DECISIONS.md`
- 全局规则 / 约定：
  - 包管理用 pnpm；运行用 `pnpm run apply`；类型检查 `pnpm run typecheck`
  - TypeScript strict + ESM：相对导入必须带 `.js` 后缀
  - `src/theme.ts` 是配色与 profile 的单一事实源——任何色值/键名只在这里改，不得在其他文件硬编码
  - 安装类操作必须先备份、保持幂等（重复运行不产生重复配置）
  - 依赖安装优先使用中国境内镜像
  - 注释与提交信息使用中文，提交信息遵循 conventional commits（feat/fix/refactor）
  - `public/` 被 .gitignore 忽略：背景图是本机素材，不入库，落点一律用 `~/.claude/` 缓存路径
  - 动手改代码前先确认 git 状态并留可回退点

## 目录速查

- `src/index.ts` — 交互式安装向导（CLI 入口，平台分支与交互编排）
- `src/theme.ts` — 主题/配色/profile 定义与背景图查找（双平台共享）
- `src/claude-installation.ts` — 跨平台 CLI 探测纯逻辑（native / npm / path 三来源）
- `src/node-system.ts` — 环境适配器：组装 DetectionEnvironment 传入 claude-installation
- `src/terminal/` — 终端业务逻辑：Windows（windows.ts）、macOS（macos.ts + macos.swift）
- `src/macos-terminal.ts` — macOS 安装编排（退出 Terminal → 刷新 cfprefsd → 调 Swift → 冷启动）
- `src/macos-terminal.swift` — Swift 脚本：生成 .terminal 产物、合成背景图、构造 bookmark、直写偏好 plist
- `src/claude-settings.ts` — Claude Code 主题写入与检测
- `public/` — 本机背景图素材目录（gitignored）
- `docs/` — 项目文档（PRD / ARCHITECTURE / DECISIONS / specs）
