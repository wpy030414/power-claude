# PRD — PowerClaude（终端 + Claude Code 樱花粉一键美化）

## 产品目标

- 用一条命令把「终端 + Claude Code CLI」统一成樱花粉主题，并让终端启动即进入 Claude Code；过程自动备份、随时可恢复、可重复执行。

## 用户与使用场景

- 目标用户：
  - 主要：项目所有者本人——在 Windows 与 macOS 间切换、重度使用 Claude Code 的个人用户
  - 次要：想要同款「粉色终端 + 粉色 Claude Code」的其他 Claude Code 用户
- 典型场景：
  - 新机器 / 重装系统后，一条命令复原整套粉色环境
  - 换背景图：把新图丢进 `public/` 重跑一次安装即可
  - Claude Code 升级导致主题 token 变化后，跟随适配重写调色板

## 核心问题

- Windows Terminal `settings.json`、macOS Terminal.app 偏好、Claude Code 主题三处配置分散，手工改写繁琐易错，且无法跨平台复用
- 新版 macOS Terminal.app 不再认外部导入的明文背景图路径，背景图自动化安装存在真实技术障碍

## 功能及其意义

| 功能 | 解决什么 | 为什么需要 |
|------|----------|------------|
| PowerClaude 终端 profile | 打开终端还要手敲 `claude` | 启动即进入 Claude Code，省一步 |
| 设为默认启动项 | 新开终端不是 PowerClaude | 让粉色环境成为默认体验（Windows 另含 Ctrl+Tab 最近使用优先、新标签菜单置顶） |
| Sakura Pink 主题（终端 + Claude Code 绑定应用） | 两处配色割裂 | 一次确认、两处生效，体验统一 |
| 自动备份 | 配置写坏无法回退 | 安装前强制留底，恢复有据 |
| 背景图（`public/` 自动查找，双平台共用） | 背景图配置门槛高 | 丢图即用，扩展名 / 路径自动处理 |
| macOS 无感安装 | `open` 导入弹窗、需手动操作 | 直写偏好 plist，全自动无弹窗 |

## 功能之间的关系

- 「核心配置安装」是其余功能的前置：主题与背景图都附着在 PowerClaude profile 之上
- 「主题应用」强绑定终端与 Claude Code 两侧，不接受只装一边（见 DECISIONS ADR-003）
- 「背景图」复用同一套查找与缓存逻辑，两平台共用 `public/` 约定

## 范围与非目标

- 范围内：Windows Terminal、macOS Terminal.app、Claude Code CLI 三处配置的安装 / 更新 / 备份
- 范围外：其他终端模拟器、Linux 桌面终端、GUI 安装器、主题分发市场、自动更新
