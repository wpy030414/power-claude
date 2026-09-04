# PowerClaude 🌸

> PowerShell 直连 Claude Code — 在粉色终端里和你的人家对话喵♪

## 这是什么？

**PowerClaude** 是一套跨平台配置方案，使用 TypeScript 编写，实现：

- **Windows Terminal** 中新增专属终端配置，PowerShell 直接启动 [Claude Code CLI](https://github.com/anthropics/claude-code)
- **Claude Code CLI** 自定义主题（基于 `light-daltonized` 明亮色盲，只覆盖需要变粉的颜色）
- 交互式安装向导，**Windows / macOS 双平台**完整支持（终端 + Claude Code 一次配齐）

## 为什么存在？

- 背景 / 动机：终端外观、启动行为、Claude Code 主题分散在三份配置里，手工改写繁琐易错、重装系统后无法快速复原；新版 macOS Terminal.app 又不再认外部导入的明文背景图路径。本项目把这套「粉色环境」沉淀成一条命令——自动备份、幂等可重跑、双平台共用同一份 `public/` 背景图约定。

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 交互式安装
pnpm run apply
```

## 交互式向导

```
🌸 PowerClaude 安装向导

  ◆ 备份中...（自动备份，无需确认）
  ◆ 安装 PowerClaude 核心配置...
  ◆ 是否应用 Sakura Pink 樱花粉主题？ → Yes
  ◆ 应用 Windows Terminal 主题...
  ◆ 应用 Claude Code 主题...

✨ PowerClaude 安装完成！
```

## 效果预览

```
┌─ Windows Terminal ──────────────────────────────────┐
│ [PowerClaude] [Windows PowerShell] [cmd] [Dev]  +  │
│  ↑ 默认启动项                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ❯ claude                                           │
│  Welcome to Claude Code 🎀                          │
│                                                     │
│  (一整个粉色的终端，连光标都是亮粉的 #E86A92)       │
│                                                     │
│  Ctrl+Tab 切换标签（最近使用优先）                    │
│  Mica 磨砂玻璃透出桌面光影                           │
└─────────────────────────────────────────────────────┘
```

## 功能

| 功能 | 说明 |
|---|---|
| 🚀 **PowerClaude 终端** | PowerShell 启动后自动运行 `claude` |
| 🎯 **默认启动** | 安装后自动设为默认终端 |
| 🔀 **Tab 切换器** | `Ctrl+Tab` 弹出标签列表，最近使用优先 |
| 🌸 **Sakura Pink 主题** | 应用主题时终端 + Claude Code 一起应用 |
| 💾 **自动备份** | 安装前自动备份 `settings.json` |
| 📌 **新标签菜单** | PowerClaude 置顶，一键直达 |

## 配色方案

### Sakura Pink 🌸

| 用途 | 色号 | 名称 |
|---|---|---|
| 🖼️ 背景 | `#FFF0F5` | Lavender Blush |
| 📝 前景文字 | `#A63A6E` | 深玫瑰粉 |
| 📌 光标/强调色 | `#E86A92` | 珊瑚粉 |
| 🎯 选中 | `#FFB8CC` | 亮粉色 |
| 📋 标签行 | `#FFDCE8` | 蜜桃粉 |

### Claude Code 自定义主题

基于 `light-daltonized` 明亮预设，只覆盖需要的粉色令牌：

| 令牌 | 色号 | 用途 |
|---|---|---|
| `claude` | `#FF6B8A` | 高亮/选中（亮樱桃粉） |
| `error` | `#E05A7A` | 危险/权限提示（亮玫瑰红） |
| `warning` | `#F0A65E` | 警告（蜜橙） |
| `suggestion` | `#6FA9E6` | 信息/建议（天蓝） |
| `success` | `#5FB77E` | 成功（薄荷绿） |
| `background` | `#FFF0F5` | 背景 |

## 恢复默认

```powershell
# 从备份恢复
Copy-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json.bak-*" `
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
```

```bash
# macOS：从备份恢复（先退出 Terminal.app）
defaults import com.apple.Terminal ~/com.apple.Terminal.bak-<时间戳>.plist
```

## 前置要求

- **Windows**: Windows 10/11 + [Windows Terminal](https://aka.ms/terminal-download)（推荐 1.20+）
- **macOS**: Terminal.app 全套安装 + Claude Code 主题（自动直写偏好，过程中会退出并重启 Terminal）
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- Claude Code CLI：`npm install -g @anthropic-ai/claude-code`

## 项目结构

```
power-claude/
├── src/
│   ├── index.ts               ← 交互式安装向导（入口）
│   ├── theme.ts               ← 主题定义与类型（双平台共享）
│   ├── windows-terminal.ts    ← Windows Terminal 配置读写
│   ├── macos-terminal.ts      ← macOS Terminal.app 安装编排
│   ├── macos-terminal.swift   ← Swift：profile 生成 + 背景图合成 + 偏好直写
│   └── claude-settings.ts     ← Claude Code 主题配置
├── public/                    ← 背景图素材（gitignored，自动查找第一张）
├── docs/                      ← 项目文档（PRD / ARCHITECTURE / DECISIONS / specs）
├── package.json
├── tsconfig.json
└── README.md
```

## 当前状态

- 阶段：开发中（个人工具，随 Claude Code / 终端版本跟进适配）
- 已知限制：
  - 终端部分仅支持 Windows Terminal 与 macOS Terminal.app，不支持 iTerm2 / VS Code 等其他终端
  - macOS 安装会主动退出并冷启动 Terminal.app（直写偏好的硬前提）
  - Claude Code 主题 token 随上游版本变化，可能需要跟随适配
  - 备份文件自动累积，不自动清理

## 核心技术

- 语言 / 运行时：TypeScript（strict + ESM），tsx 直跑，Node.js 18+
- 平台细节：Windows Terminal `settings.json` 读写；macOS 内嵌 Swift 脚本（AppKit 合成背景图 + security-scoped bookmark + 偏好 plist 直写）
- 关键依赖：`@clack/prompts`（交互界面）、`picocolors`（终端着色）、`tsx`、`typescript`

## 声明

本项目与 Claude Code CLI 或 Anthropic 官方无直接关联，仅提供配置方案。