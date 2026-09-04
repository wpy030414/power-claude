# PowerClaude 🌸

> PowerShell 直连 Claude Code — 在粉色终端里和你的人家对话喵♪

## 这是什么？

**PowerClaude** 是一套跨平台配置方案，使用 TypeScript 编写，实现：

- **Windows Terminal** 中新增专属终端配置，PowerShell 直接启动 [Claude Code CLI](https://github.com/anthropics/claude-code)
- **Claude Code CLI** 自定义主题（基于 `light-daltonized` 明亮色盲，只覆盖需要变粉的颜色）
- 交互式安装向导，**macOS 也支持 Claude Code 主题部分**

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

## 前置要求

- **Windows**: Windows 10/11 + [Windows Terminal](https://aka.ms/terminal-download)（推荐 1.20+）
- **macOS**: 仅 Claude Code 主题部分
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- Claude Code CLI：`npm install -g @anthropic-ai/claude-code`

## 项目结构

```
power-claude/
├── src/
│   ├── index.ts               ← 交互式安装向导（入口）
│   ├── windows-terminal.ts    ← Windows Terminal 配置读写
│   ├── claude-settings.ts     ← Claude Code 主题配置
│   └── theme.ts               ← 主题定义与类型
├── install.ps1                ← 备用 PowerShell 脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 声明

本项目与 Claude Code CLI 或 Anthropic 官方无直接关联，仅提供配置方案。