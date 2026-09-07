import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPowerClaudeBackground } from '../theme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SWIFT_SCRIPT = join(__dirname, 'macos.swift');
const PROFILE_NAME = 'powerclaude';

// ── 路径 ──

function getTempProfilePath(): string {
  return join(homedir(), '.claude', 'powerclaude.terminal');
}

// 合成图固定落点（bookmark 指向此文件，覆盖式更新不影响引用）
function getBlendedBackgroundPath(): string {
  return join(homedir(), '.claude', 'powerclaude-background-blended.png');
}

// Terminal.app 偏好 plist 路径
function getTerminalPlistPath(): string {
  return join(homedir(), 'Library', 'Preferences', 'com.apple.Terminal.plist');
}

// 检测 Terminal.app 是否正在运行
// 实测：Terminal 运行中时，其内存里的旧 profile 会在任意时机回写磁盘，
// 覆盖外部写入的新配置。因此直写 plist 前 Terminal 必须退出。
function isTerminalAppRunning(): boolean {
  try {
    // 不用 pgrep：部分沙盒环境下 pgrep 的进程枚举被限制，ps 可正常工作
    const out = execSync(
      `ps -ax -o comm= | grep "Terminal.app/Contents/MacOS/Terminal$" | wc -l`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return parseInt(out, 10) > 0;
  } catch {
    return false;
  }
}

// 优雅退出 Terminal.app（osascript quit 保留窗口状态，重启后恢复；killall 兜底）
function quitTerminalApp(): void {
  try {
    execSync(`osascript -e 'tell application "Terminal" to quit'`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // ignore
  }
  execSync('sleep 3', { stdio: 'ignore' });
  try {
    execSync('killall Terminal 2>/dev/null || true', { stdio: 'ignore' });
  } catch {
    // ignore
  }
  execSync('sleep 1', { stdio: 'ignore' });
}

// ── 类型 ──

export interface MacOSBackupInfo {
  path: string;
}

// ── 查找 Claude 可执行文件（macOS 版） ──

export function findClaudeExeMacOS(): string | null {
  const candidates = [
    '/usr/local/bin/claude',
    join(homedir(), '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  try {
    const which = execSync('which claude 2>/dev/null', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (which && existsSync(which)) return which;
  } catch {
    // ignore
  }
  return null;
}

export function isClaudeInstalledMacOS(): boolean {
  return findClaudeExeMacOS() !== null;
}

// ── 备份 Terminal.app 偏好设置 ──

export function backupMacOSTerminal(): MacOSBackupInfo {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(homedir(), `com.apple.Terminal.bak-${timestamp}.plist`);
  try {
    execSync(`defaults export com.apple.Terminal "${backupPath}"`, { stdio: 'ignore' });
  } catch {
    // Terminal 从未打开过时 export 可能失败
    execSync(`defaults read com.apple.Terminal > "${backupPath}" 2>/dev/null || true`, {
      stdio: 'ignore',
    });
  }
  return { path: backupPath };
}

// ── 检测 PowerClaude 是否已安装 ──

export function isPowerClaudeInstalledMacOS(): boolean {
  try {
    const out = execSync('defaults read com.apple.Terminal "Default Window Settings" 2>/dev/null', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out === PROFILE_NAME;
  } catch {
    return false;
  }
}

// ── 检测 Sakura Pink 主题是否已应用 ──

export function isTerminalThemeAppliedMacOS(): boolean {
  return isPowerClaudeInstalledMacOS();
}

// ── 安装 PowerClaude 核心配置（macOS Terminal.app 版） ──
// Swift 合成背景图 + 构造 bookmark → 直写 Terminal.app 偏好 → 冷启动
// 全程无需 open 导入、无弹窗。

export function installPowerClaudeMacOS(wrapperPath?: string): void {
  const claudePath = wrapperPath ?? findClaudeExeMacOS();
  if (!claudePath) {
    throw new Error('未找到 Claude Code CLI');
  }

  const tempPath = getTempProfilePath();
  const tempDir = dirname(tempPath);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const plistPath = getTerminalPlistPath();
  if (!existsSync(plistPath)) {
    throw new Error('未找到 Terminal.app 偏好文件（Terminal 从未运行过？）');
  }

  // 背景图：与 Windows 共用同一套查找（public/ 第一张图，public/ 优先，扩展名跟随）
  let bgPath: string | null = null;
  const bg = getPowerClaudeBackground();
  if (bg) {
    try {
      // 拷贝到固定落点，避免直接引用 public/ 里随时可能挪动的路径
      const dest = bg.dest;
      if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(bg.source, dest);
      bgPath = dest;  // 传原图给 Swift，Swift 会合成 18% 适应模式 PNG 并构造 bookmark
    } catch (e) {
      console.warn(`背景图处理失败，已跳过背景: ${String(e)}`);
    }
  }

  // 关键前提（实验验证）：直写 plist 时 Terminal 必须处于关闭状态，
  // 否则其内存里的旧 profile 会回写磁盘覆盖新配置。
  // osascript quit 为优雅退出（保存窗口状态，重启后恢复会话）。
  if (isTerminalAppRunning()) {
    console.warn('检测到 Terminal.app 正在运行，将退出以写入配置（重新打开后会话可恢复）...');
    quitTerminalApp();
  }

  // 写入前刷新 cfprefsd：丢弃缓存，防止旧值回写覆盖直写内容
  execSync('killall cfprefsd 2>/dev/null || true', { stdio: 'ignore' });

  // Swift：合成背景图（覆盖同路径）+ 生成 .terminal 产物 + 直写偏好 plist（含 bookmark）
  let cmd = `swift "${SWIFT_SCRIPT}" "${tempPath}" "${claudePath}"`;
  if (bgPath) cmd += ` "${bgPath}"`;
  cmd += ` --plist "${plistPath}"`;
  // Swift 冷编译 + AppKit 链接首次可达 60-90s，给足余量
  execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  // 写入后再次刷新 cfprefsd：确保 Terminal 冷启动时从磁盘读到新配置
  execSync('killall cfprefsd 2>/dev/null || true', { stdio: 'ignore' });

  // 设为默认启动配置 + 新窗口配置
  execSync(`defaults write com.apple.Terminal "Default Window Settings" -string "${PROFILE_NAME}"`, {
    stdio: 'ignore',
  });
  execSync(`defaults write com.apple.Terminal "Startup Window Settings" -string "${PROFILE_NAME}"`, {
    stdio: 'ignore',
  });

  // 冷启动 Terminal.app：加载新配置（背景图 bookmark、启动命令即刻生效）
  execSync('open -a Terminal', { stdio: 'ignore' });
}

// ── 应用终端主题（macOS — 与 install 相同，主题嵌入在配置文件中） ──

export function applyTerminalThemeMacOS(): void {
  installPowerClaudeMacOS();
}
