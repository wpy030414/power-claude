# Spec — Windows 安装链路（内聚于 `src/terminal/windows.ts`）

## 要构建什么

- 目标：在 Windows Terminal 中安装 / 更新 PowerClaude profile 与 Sakura Pink 主题，全部操作幂等；定位、变换、读写、编排全部内聚于单文件，位于 `src/terminal/` 目录。

## 行为

- 配置定位与读写（`src/terminal/windows.ts`）：
  - settings.json 定位、读写（4 空格缩进 + 尾换行）、备份（`settings.json.bak-<时间戳>` 同目录副本）
- 纯变换（`src/terminal/windows.ts`，无 IO）：
  - `upsertPowerClaudeProfile(config, profile)`：按固定 GUID 去重（忽略大小写）→ 追加 → 设 `defaultProfile` → `tabSwitcherMode: "mru"` → 新标签菜单置顶
  - `applySakuraPinkTheme(config)`：scheme / theme 按名去重；`profiles.defaults.colorScheme` 与全局 `theme` 设为 Sakura Pink；PowerClaude profile 单独再设配色
- 应用编排（`src/terminal/windows.ts`）：
  - `detectWindowsClaudeCli()`：经领域探测服务识别 native / npm / path 来源（见 module-claude-installation spec）
  - `installPowerClaudeCore(installation)`：读配置 → 背景图拷贝到 `~/.claude/`（失败仅警告不阻断）→ profile 工厂（图标复用探测到的可执行路径）→ 纯变换 → 写回
  - `applyWindowsTerminalTheme()` / `isPowerClaudeInstalled()` / `backupWindowsTerminal()`

## 输入 / 输出

- 输入：Windows Terminal `settings.json`，按候选优先级定位（ADR-010）：
  1. `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\`（商店稳定版）
  2. `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\`（商店 Preview 版）
  3. `%LOCALAPPDATA%\Microsoft\Windows Terminal\`（免安装版）
- 输出：同文件（4 空格缩进 JSON + 尾换行）

## 约束

- 仅支持 Windows；非 Windows 调用 store 的路径相关函数直接抛错
- GUID 比较必须忽略大小写（Windows Terminal 可能写成小写）
- 不得删除或改写用户已有 profile / scheme / theme
- 文件读写与变换内聚于单文件，不依赖除 claude-installation.ts 外的其他模块

## 边界条件

- settings.json 不存在（未安装或从未启动）：明确报错并列出全部已查找位置，提示先安装或先启动一次；备份失败即停 spinner、exit 1，进程不得挂死
- 多版本共存：写入先命中的候选（stable 优先于 Preview）
- 背景图拷贝失败：警告并跳过背景，不阻断安装
- JSON 解析失败：交由上层报错，不静默重建配置

## 验收标准

- [x] 连续运行两次核心安装，profiles.list 中只有一个 PowerClaude GUID
- [x] 重复主题应用不产生重复 scheme / theme 条目
- [x] 用户已有 profile 在安装前后保持不变
- [x] 仅 Preview 版的机器全链路写入 Preview 路径（E2E 回归）
- [x] 无任何配置时 exit 1 + 明确报错，进程不挂死（E2E 回归）

## 完成定义

- 真机 Windows Terminal 安装后新开默认标签即启动 claude，配色 / 标签栏 / 背景生效，备份文件存在
