# Spec — Claude Code 主题写入器（src/claude-settings.ts）

## 要构建什么

- 目标：把 Sakura Pink 安装为 Claude Code 自定义主题，且绝不破坏用户 `settings.json` 中的其他配置。

## 行为

- 预期行为（`applyClaudeTheme()`）：
  1. 写 `~/.claude/themes/sakura-pink.json`（内容来自 theme.ts）
  2. `~/.claude/settings.json` 的 `theme` 字段设为 `custom:sakura-pink`（读-改-写，保留其余字段）
  3. Windows 下重启 Claude daemon（taskkill claude.exe）使主题立即生效；非 Windows 跳过
- 检测：`isClaudeThemeApplied()` 识别 `custom:sakura-pink` 及旧版内嵌对象格式；`getCurrentClaudeTheme()` 返回可读状态

## 输入 / 输出

- 输入：`~/.claude/settings.json`（可能不存在）
- 输出：`~/.claude/themes/sakura-pink.json` + 更新后的 settings.json（2 空格缩进 + 尾换行）

## 约束

- settings.json 不存在或解析失败视为空对象，从零构建，绝不清空用户已有键
- daemon 重启仅限 Windows（macOS / Linux 无 daemon 进程）

## 边界条件

- `~/.claude/` 目录不存在：自动创建
- 主题文件写入失败：向上抛错，由向导展示

## 验收标准

- [ ] 应用主题后，settings.json 中用户原有的 permissions / env 等键全部保留
- [ ] settings.json 缺失时，仅生成含 theme 字段的最小配置
- [ ] Windows 下重复应用不产生重复键或残留进程

## 完成定义

- Claude Code 中 `/theme` 列表可见 Sakura Pink，选中后界面为粉色
