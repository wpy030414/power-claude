# ARCHITECTURE — PowerClaude

## 系统概述

- 整体结构：单进程 TypeScript CLI（tsx 直跑），按平台分派到两个终端安装器 + 一个 Claude Code 主题写入器；`theme.ts` 提供双平台共享定义；macOS 终端安装的「最后一公里」由内嵌 Swift 脚本完成。Windows 链路已按 DDD 切片分层（ADR-009）：domain 纯逻辑 / application 编排 / infrastructure 适配，macOS 链路与 claude-settings 暂留原结构。

```
pnpm run apply（tsx src/index.ts）
        │
        ▼
┌───────────────── index.ts 交互式向导 ─────────────────┐
│ 平台检测 → Claude CLI 探测 → 自动备份 → 核心安装      │
│         → 确认主题 → 终端主题 + Claude Code 主题      │
└────┬───────────────────────┬───────────────────┬──────┘
     │ win32                 │ darwin            │ 双平台
     ▼                       ▼                   ▼
application/           macos-terminal.ts    claude-settings.ts
windows-setup.ts        │ execSync swift         │
     │                  ▼                        ▼
     ├─ domain/claude-installation.ts   macos-terminal.swift   ~/.claude/
     │   （候选路径 → PATHEXT 感知        │                   ├─ themes/sakura-pink.json
     │    PATH 扫描，环境注入）            ▼                   └─ settings.json（theme 字段）
     ├─ domain/windows-terminal-settings.ts   com.apple.Terminal.plist
     │   （settings 纯变换，无 IO）            （profile 直写 + bookmark）
     └─ infrastructure/（node-system 环境适配 /
        windows-terminal-store 读写备份）
                    │
                    ▼
        Windows Terminal settings.json
        (profile/scheme/theme/tabSwitcher)

     ▲ ───────── theme.ts（共享：配色 / 终端主题 / Claude 主题 / profile 工厂 / 背景图查找）─────────▲

public/（背景图源，gitignored）──拷贝──▶ ~/.claude/powerclaude-background.*

tests/ ── node:test：tests/unit（领域纯逻辑）+ tests/e2e（子进程沙箱跑真实 CLI）
```

## 核心模块

| 模块 | 职责 |
|------|------|
| `src/index.ts` | CLI 入口：平台检测、前置检查、编排备份 → 安装 → 主题 |
| `src/theme.ts` | 单一事实源：Sakura Pink 配色/主题定义、PowerClaude profile 工厂、背景图查找（路径可注入便于测试） |
| `src/domain/claude-installation.ts` | 领域：CLI 探测纯逻辑（native / npm / path 三来源），环境全注入、不启动 claude 进程 |
| `src/domain/windows-terminal-settings.ts` | 领域：Windows Terminal settings 纯变换（profile 去重安装 / 主题应用），不做 IO |
| `src/infrastructure/node-system.ts` | 基础设施：把真实进程环境组装成探测输入（DetectionEnvironment） |
| `src/infrastructure/windows-terminal-store.ts` | 基础设施：settings.json 定位 / 读写 / 备份 |
| `src/application/windows-setup.ts` | 应用层：Windows 链路编排（检测 → 已安装检查 → 备份 → 核心安装 → 主题） |
| `src/macos-terminal.ts` | macOS 编排：退出 Terminal → 刷新 cfprefsd → 调 Swift → defaults 设默认 → 冷启动 |
| `src/macos-terminal.swift` | 生成 .terminal 产物；合成背景图（樱花粉底 + 18% 原图）；构造 security-scoped bookmark；`--plist` 直写偏好 |
| `src/claude-settings.ts` | 写 `~/.claude/themes/sakura-pink.json`、改 `settings.json` 的 `theme`、Windows 下重启 daemon |
| `tests/` | node:test：`tests/unit/` 领域纯逻辑单测；`tests/e2e/` 子进程沙箱跑真实 CLI |

## 模块关系

- `index.ts` 只做编排与交互，不含平台配置细节；平台细节全部下沉到两个安装器
- 两个终端安装器互不依赖，只共享 `theme.ts`
- `macos-terminal.ts` 与 `macos-terminal.swift` 是「编排器 + 执行器」：TS 负责流程与前置条件（退出 Terminal、刷 cfprefsd、超时控制），Swift 负责 plist 结构与 AppKit 图像处理
- Claude Code 主题写入器与终端安装器完全解耦，可独立执行（不支持终端的平台只有这一部分可用）

## 数据流

- 主题定义流：`theme.ts` 常量 → Windows 写入 settings.json（scheme + themes + defaults）；macOS 由 Swift 编码进 profile；Claude 侧写 `themes/sakura-pink.json` + `theme: "custom:sakura-pink"`
- 背景图流：`public/` 第一张图（按文件名序）→ 拷贝到 `~/.claude/powerclaude-background.<ext>` → Windows 直接作为 `backgroundImage`；macOS 由 Swift 合成为 `powerclaude-background-blended.png` 并构造 bookmark 指向
- 备份流：Windows `settings.json.bak-<时间戳>` 同目录副本；macOS `defaults export` 到 `~/com.apple.Terminal.bak-<时间戳>.plist`

## 外部系统

- Windows Terminal：读写 `%LOCALAPPDATA%` 下的 `settings.json`，按候选优先级定位（商店稳定版 → 商店 Preview 版 → 免安装版，ADR-010）
- macOS Terminal.app：直写 `~/Library/Preferences/com.apple.Terminal.plist`，依赖 `cfprefsd` 缓存刷新与冷启动加载
- Claude Code CLI：`~/.claude/settings.json` + `~/.claude/themes/` 目录约定（`custom:` 前缀引用）；Windows 下通过重启 daemon 生效
- Swift 运行时 / AppKit：macOS 图像合成与 plist 序列化

## 重要技术边界

- Windows Terminal 配置路径按候选优先级解析（稳定版 → Preview → 免安装版），全部缺失时明确报错且进程不得挂死；非 Windows 调用直接抛错（ADR-010）
- CLI 探测优先级：候选路径（native `~/.local/bin` → npm shim/exe）→ PATHEXT 感知 PATH 扫描；探测不启动 claude 进程（ADR-008）
- macOS 直写 plist 的硬前提：Terminal.app 必须已退出（否则其内存里的旧 profile 会回写覆盖），因此安装流程会主动退出并冷启动 Terminal
- Swift 脚本冷编译可达 60–90s，调用超时设 120s
- `POWER_CLAUDE_GUID` 是 Windows profile 的稳定身份，一经发布不可更改（否则产生重复 profile）
- 所有安装操作要求幂等：GUID / scheme / theme 均按名去重，不删除用户已有配置
- `public/` 在 .gitignore 中：背景图属本机素材，不入库
- E2E 沙箱把子进程 PATH 收窄到只含桩目录：除提供桩 claude 外，还令 daemon 重启（taskkill）解析失败并被既有 try/catch 吞掉，避免误杀宿主机运行中的 claude.exe（ADR-009）
