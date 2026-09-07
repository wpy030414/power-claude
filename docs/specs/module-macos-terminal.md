# Spec — macOS Terminal.app 安装器（src/terminal/macos.ts + macos.swift）

## 要构建什么

- 目标：全自动安装 Terminal.app 的 `powerclaude` profile（启动即 claude + Sakura Pink + 背景图），全程无弹窗、无 `open` 导入。

## 行为

- 预期行为（`installPowerClaudeMacOS()` 编排顺序）：
  1. 定位 claude 绝对路径（/usr/local/bin → ~/.local/bin → /opt/homebrew/bin → `which`）
  2. 校验 Terminal 偏好 plist 存在
  3. 背景图拷贝到 `~/.claude/powerclaude-background.<ext>`
  4. Terminal 运行中则优雅退出（osascript quit 保留会话，killall 兜底）
  5. `killall cfprefsd` 丢弃偏好缓存
  6. 调 Swift 脚本：生成 `~/.claude/powerclaude.terminal` 产物 + 合成背景 PNG（樱花粉底 + 18% 原图适应模式居中，画布比例 = 字符网格 × 字体度量）+ 构造 security-scoped bookmark + `--plist` 直写偏好
  7. 再次 `killall cfprefsd`；`defaults write` 将 Default / Startup Window Settings 设为 `powerclaude`
  8. `open -a Terminal` 冷启动加载新配置

## 输入 / 输出

- 输入：`~/Library/Preferences/com.apple.Terminal.plist`、背景图源文件
- 输出：更新后的 plist（合并写入，其他键不动）、`.terminal` 产物、`powerclaude-background-blended.png`

## 约束

- Terminal.app 必须在直写前退出（内存旧 profile 会回写覆盖），这是硬前提
- Swift 调用超时 120s（冷编译 60–90s）
- profile 名为小写 `powerclaude`；启动命令键名大小写双写（`CommandString`/`commandString`）
- plist 不存在视为 Terminal 从未运行过，直接报错

## 边界条件

- bookmark 构造失败：降级为仅写路径（新版 Terminal 可能不认，记录警告）
- 背景图合成失败：降级用原图路径
- 无背景图：不写任何背景键

## 验收标准

- [ ] 安装全程无需人工确认、无系统弹窗
- [ ] 冷启动 Terminal.app：新窗口即 claude、樱花粉配色、背景图经 bookmark 生效
- [ ] plist 中除 `Window Settings.powerclaude` 与 Default / Startup 两键外，用户原有配置不变

## 完成定义

- 重启 Terminal 后配置持久生效；`defaults read com.apple.Terminal "Default Window Settings"` 返回 `powerclaude`
