# DECISIONS

记录本项目已采纳的关键决策（ADR）。新决策追加在文件末尾、编号递增；被取代的决策改为「已废弃」并指向新编号。

## ADR-001：直接改写目标应用的配置文件，而非注入 shell 脚本或包装命令

- 日期：2026-09-04
- 状态：已采纳
- 背景（遇到了什么问题）：要实现「打开终端即进入 Claude Code」并统一主题，可选 shell profile 注入、手动导入配置文件，或直接改写终端自身配置
- 考虑过的方案：
  - shell profile 注入：不动终端配置，但配色 / 标签栏 / 背景等外观无法生效
  - 手工导入 .terminal / settings.json：用户步骤多、易错、不可重复
- 决策：直接读写 Windows Terminal `settings.json`、macOS Terminal 偏好 plist、`~/.claude/settings.json`
- 为什么选这个：主题与启动行为都能完整生效，且可程序化幂等更新
- 为什么不选其他：profile 注入覆盖不了终端外观；手动导入无法自动化
- 后果：写入前必须备份；必须保证幂等与去重；对目标应用版本敏感（键名 / token 变化需跟随适配）
- 何时重新审视：目标应用配置格式发生破坏性变更时

## ADR-002：只保留交互式向导，不做 CLI 参数自动安装

- 日期：2026-09-04
- 状态：已采纳
- 背景：曾实现 `apply:yes` 一类免确认参数，实际场景价值低且增加维护面
- 考虑过的方案：保留无人值守模式；完全交互式
- 决策：移除自动安装参数，仅保留 `pnpm run apply` 交互推进（唯一参数 `-h/--help`）
- 为什么选这个：个人工具场景交互一次成本低；少一条链路少一类 bug
- 为什么不选其他：无人值守模式没有真实调用方
- 后果：CI / 脚本化场景无法直接使用
- 何时重新审视：出现真实的无人值守需求时

## ADR-003：主题应用强绑定「终端 + Claude Code」一起安装

- 日期：2026-09-04
- 状态：已采纳
- 背景：早期允许终端 / Claude Code 二选一，实际只装一边体验割裂（一粉一白）
- 考虑过的方案：维持两个独立选项；合并为一次确认
- 决策：向导只问一次「是否应用 Sakura Pink」，可装终端的平台两侧同时应用
- 为什么选这个：保证成品体验一致，砍掉无意义的组合状态
- 为什么不选其他：细粒度选择没有对应需求
- 后果：不能只给终端或只给 Claude Code 单独换主题（Claude Code 内可用 `/theme` 临时切换）
- 何时重新审视：出现「只要 Claude Code 主题」的真实需求

## ADR-004：Claude Code 主题以 light-daltonized 为 base、只覆盖粉色令牌，经 themes/ 目录引用

- 日期：2026-09-04（同日随新版 token 修订）
- 状态：已采纳
- 背景：Claude Code 支持自定义主题文件（`~/.claude/themes/*.json`，`settings.json` 以 `custom:<名称>` 引用）；新版 token 命名有变化（如 dangerColor→error、infoColor→suggestion）
- 考虑过的方案：全量手写整套主题；基于现有明亮预设做最小覆盖
- 决策：`base: light-daltonized` + 仅覆盖需要变粉的令牌（`SAKURA_PINK_CLAUDE_THEME.overrides`）
- 为什么选这个：保留上游预设的可读性基线，升级时只需维护覆盖集
- 为什么不选其他：全量手写维护成本高且易与上游脱节
- 后果：上游预设或 token 更名时需同步适配（已发生过一次全面重写）
- 何时重新审视：Claude Code 主题格式再次变更时

## ADR-005：备份一律自动执行，不再询问

- 日期：2026-09-04
- 状态：已采纳
- 背景：询问「是否备份」对用户是无效决策点，而跳过备份的风险却由用户承担
- 考虑过的方案：保留询问；无条件自动备份
- 决策：向导在安装前无条件备份（Windows：settings.json 时间戳副本；macOS：`defaults export` 时间戳 plist）
- 为什么选这个：备份成本低、收益不可逆，不该交给用户选择
- 为什么不选其他：保留询问就有人选否，出事无回退
- 后果：备份文件随安装次数累积，暂不自动清理
- 何时重新审视：备份文件数量 / 体积成为实际负担时

## ADR-006：背景图统一从 public/ 自动查找，双平台共用

- 日期：2026-09-04
- 状态：已采纳
- 背景：两平台各自配背景图路径繁琐，需要「换图即生效」的简单约定
- 考虑过的方案：CLI 参数指定图片；固定单一路径约定
- 决策：取仓库 `public/` 按文件名排序的第一张支持格式图片（webp/png/jpg/jpeg/bmp/gif/svg），拷贝缓存到 `~/.claude/powerclaude-background.<ext>`；public/ 无图时复用已有缓存；都没有则不写背景字段
- 为什么选这个：换图 = 丢图进目录重跑，零参数；落点扩展名跟随源文件，避免「内容与扩展名不符」的识别问题
- 为什么不选其他：CLI 参数违背「一条命令」定位；固定单一路径对图片格式不宽容
- 后果：`public/` 被 gitignore，图片属本机素材；多图时只取第一张（按文件名序）
- 何时重新审视：出现多图 / 指定图的真实需求时

## ADR-007：macOS 采用直写 Terminal 偏好 plist 安装（bookmark + 预烘焙透明度）

- 日期：2026-09-05
- 状态：已采纳
- 背景：早期 macOS 走「生成 .terminal → `open` 导入」流程，有系统弹窗、无法全自动；且实测（macOS 26）新版 Terminal.app 冷启动只认 `BackgroundImageBookmark`（security-scoped bookmark），外部直写明文 `BackgroundImagePath` 不生效；背景透明度没有 GUI 滑块可编程设置
- 考虑过的方案：
  - 继续 `open` 导入：弹窗破坏自动化
  - AppleScript 驱动 GUI：脆弱且需辅助功能权限
- 决策：
  - Swift 生成 profile 后以 `--plist` 直接并入 `com.apple.Terminal.plist`（合并写入，不动其他键）
  - 外部构造与 GUI 同构的 security-scoped bookmark 作为背景图引用
  - 透明度预烘焙：合成「樱花粉底色 + 18% 原图（适应模式居中）」的不透明 PNG；画布比例取字符网格 × 字体度量（内容区比例，无形变）
  - 启动命令键名大小写双写（`CommandString`/`commandString`、`RunCommandAsShell`/`runCommandAsShell`），兼容持久化与导入两条链路
- 为什么选这个：冷启动实测生效，全程无弹窗无人工
- 为什么不选其他：导入流程无法自动化；GUI 自动化脆弱
- 后果：硬前提是 Terminal.app 必须先退出（内存旧 profile 会回写覆盖），流程会主动退出并冷启动 Terminal；写入前后需 `killall cfprefsd` 刷新缓存；Swift 冷编译慢（超时 120s）；bookmark 构造失败降级为仅写路径
- 何时重新审视：Terminal.app 偏好结构再次变化（macOS 大版本更新）时
