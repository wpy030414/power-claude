import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SWIFT_SCRIPT = join(__dirname, 'macos-terminal.swift');
const PROFILE_NAME = 'PowerClaude';

// ── 路径 ──

function getTempProfilePath(): string {
  return join(homedir(), '.claude', 'powerclaude.terminal');
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
// 生成 Sakura Pink .terminal 配置文件 → 导入 Terminal.app → 设为默认

export function installPowerClaudeMacOS(): void {
  const claudePath = findClaudeExeMacOS();
  if (!claudePath) {
    throw new Error('未找到 Claude Code CLI');
  }

  const tempPath = getTempProfilePath();
  const tempDir = dirname(tempPath);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // 运行 Swift 脚本生成 .terminal 配置文件（传入 claude 绝对路径）
  execSync(`swift "${SWIFT_SCRIPT}" "${tempPath}" "${claudePath}"`, {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });

  // 导入到 Terminal.app
  execSync(`open "${tempPath}"`, { stdio: 'ignore' });

  // 等待 Terminal.app 处理导入
  execSync('sleep 2', { stdio: 'ignore' });

  // 设为默认启动配置 + 新窗口配置
  execSync(`defaults write com.apple.Terminal "Default Window Settings" -string "${PROFILE_NAME}"`, {
    stdio: 'ignore',
  });
  execSync(`defaults write com.apple.Terminal "Startup Window Settings" -string "${PROFILE_NAME}"`, {
    stdio: 'ignore',
  });
}

// ── 应用终端主题（macOS — 与 install 相同，主题嵌入在配置文件中） ──

export function applyTerminalThemeMacOS(): void {
  installPowerClaudeMacOS();
}
