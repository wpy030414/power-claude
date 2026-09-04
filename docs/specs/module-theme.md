# Spec — 主题与共享定义（src/theme.ts）

## 要构建什么

- 目标：作为双平台单一事实源，提供 Sakura Pink 全部配色定义、PowerClaude profile 工厂与背景图查找逻辑；自身不做任何写入（背景图查找只读）。

## 行为

- 预期行为：
  - 导出 `SAKURA_PINK_SCHEME`（Windows Terminal 16 色 + 背景/前景/光标/选中）
  - 导出 `SAKURA_PINK_TERMINAL_THEME`（Windows Terminal 标签栏/窗口主题：light + Mica）
  - 导出 `SAKURA_PINK_CLAUDE_THEME`（Claude Code 主题：base `light-daltonized` + 粉色覆盖集）
  - `createPowerClaudeProfile(iconPath, backgroundImage?)`：生成固定 GUID 的 Windows profile（PowerShell `-NoLogo -NoExit` 启动 `claude`）；仅当传入背景图时才写背景字段（opacity 0.18、uniformToFill）
  - `getPowerClaudeBackground(homeDir?, publicDir?)`：`public/` 下按文件名序取第一张支持格式图片（.webp/.png/.jpg/.jpeg/.bmp/.gif/.svg），落点扩展名跟随源文件；public/ 无图时回退复用 `~/.claude/` 已有缓存；都没有返回 `null`

## 输入 / 输出

- 输入：可选注入 `homeDir` / `publicDir`（默认取真实环境），便于测试与复用
- 输出：主题常量对象 / profile 对象 / `{ source, dest } | null`

## 约束

- `POWER_CLAUDE_GUID` 固定不变——它是 Windows profile 的稳定身份
- 色值只允许在此文件定义，其他模块一律引用，不得硬编码

## 边界条件

- `public/` 目录不存在或读取失败：不抛错，继续走回退链
- 无背景图：产出的 profile 不得包含任何背景字段（避免空路径破坏配置）

## 验收标准

- [ ] 不传背景图时，profile 对象无 `backgroundImage` / `backgroundImageOpacity` / `backgroundImageStretchMode` 键
- [ ] public/ 为空且无缓存时，`getPowerClaudeBackground()` 返回 `null`
- [ ] public/ 有多张图时，取按文件名排序的第一张

## 完成定义

- `pnpm run typecheck` 通过；两个平台安装器的色值与 profile 均只来自本模块
