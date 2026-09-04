# Spec — Windows Terminal 安装器（src/windows-terminal.ts）

## 要构建什么

- 目标：在 Windows Terminal 中安装 / 更新 PowerClaude profile 与 Sakura Pink 主题，全部操作幂等。

## 行为

- 预期行为：
  - 备份：`settings.json` 原地复制为 `settings.json.bak-<时间戳>`
  - `installPowerClaude()`：读配置 → 按固定 GUID 去重（忽略大小写）→ 追加 PowerClaude profile → 设为 `defaultProfile` → `tabSwitcherMode: "mru"` → 新标签菜单置顶 → 背景图拷贝到 `~/.claude/` 后写入 profile
  - `applyTerminalTheme()`：按名去重添加 scheme 与 theme；`profiles.defaults.colorScheme` 与全局 `theme` 设为 Sakura Pink；PowerClaude profile 单独再设一次配色
  - `isPowerClaudeInstalled()` / `findClaudeExe()`：安装检测与 Claude CLI 定位

## 输入 / 输出

- 输入：`%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json`
- 输出：同文件（4 空格缩进 JSON + 尾换行）

## 约束

- 仅支持 Windows；非 Windows 调用路径相关函数直接抛错
- GUID 比较必须忽略大小写（Windows Terminal 可能写成小写）
- 不得删除或改写用户已有 profile / scheme / theme

## 边界条件

- settings.json 不存在：明确报错提示先安装 Windows Terminal
- 背景图拷贝失败：警告并跳过背景，不阻断安装
- JSON 解析失败：交由上层报错，不静默重建配置

## 验收标准

- [ ] 连续运行两次 `installPowerClaude()`，profiles.list 中只有一个 PowerClaude GUID
- [ ] 重复 `applyTerminalTheme()` 不产生重复 scheme / theme 条目
- [ ] 用户已有 profile 在安装前后保持不变

## 完成定义

- 真机 Windows Terminal 安装后：新开默认标签即启动 claude，配色 / 标签栏 / 背景生效，备份文件存在
