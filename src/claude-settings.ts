import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { SAKURA_PINK_CLAUDE_THEME } from './theme.js';

// ── 路径 ──
function getClaudeSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}

function getClaudeThemesDir(): string {
  return join(homedir(), '.claude', 'themes');
}

// ── 类型 ──
interface ClaudeSettings {
  theme?: string | Record<string, unknown>;
  permissions?: Record<string, unknown>;
  env?: Record<string, string>;
  [key: string]: unknown;
}

// ── 读取 ──
function readClaudeSettings(): ClaudeSettings {
  const path = getClaudeSettingsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ClaudeSettings;
  } catch {
    return {};
  }
}

// ── 写入 ──
function writeClaudeSettings(settings: ClaudeSettings): void {
  const dir = join(homedir(), '.claude');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getClaudeSettingsPath(), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

// ── 重启 Claude Code daemon（仅 Windows，macOS/Linux 无 daemon 进程）──
function restartClaudeDaemon(): void {
  if (platform() !== 'win32') return;
  try {
    // 先找正在运行的 daemon 进程
    const out = execSync(
      `tasklist /FI "IMAGENAME eq claude.exe" /FO CSV /NH 2>nul`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (out.trim()) {
      // 杀死所有 claude.exe 进程（包括 daemon）
      execSync('taskkill /F /IM claude.exe 2>nul', { stdio: 'ignore' });
    }
  } catch {
    // 忽略
  }
}

// ── 应用 Claude Code 主题 ──
export function applyClaudeTheme(): void {
  // 1. 写入主题定义文件
  const themesDir = getClaudeThemesDir();
  if (!existsSync(themesDir)) mkdirSync(themesDir, { recursive: true });

  const themePath = join(themesDir, 'sakura-pink.json');
  writeFileSync(themePath, JSON.stringify(SAKURA_PINK_CLAUDE_THEME, null, 2) + '\n', 'utf-8');

  // 2. 更新 settings.json：用 custom: 前缀引用主题文件名（不含 .json）
  //    例如 "custom:sakura-pink" 对应 ~/.claude/themes/sakura-pink.json
  const settings = readClaudeSettings();
  settings.theme = 'custom:sakura-pink';
  writeClaudeSettings(settings);

  // 3. 重启 daemon 让新主题立即生效
  restartClaudeDaemon();
}

// ── 检测是否已应用主题 ──
export function isClaudeThemeApplied(): boolean {
  const settings = readClaudeSettings();
  // 检测 custom: 引用格式
  if (typeof settings.theme === 'string') {
    return settings.theme === 'custom:sakura-pink';
  }
  if (typeof settings.theme === 'object' && settings.theme !== null) {
    const t = settings.theme as Record<string, unknown>;
    return t.base === 'light' && !!t.overrides;
  }
  return false;
}

// ── 获取当前 Claude Code 主题状态 ──
export function getCurrentClaudeTheme(): string {
  const settings = readClaudeSettings();
  if (typeof settings.theme === 'string') return settings.theme;
  if (typeof settings.theme === 'object' && settings.theme !== null) {
    const t = settings.theme as Record<string, unknown>;
    return `Sakura Pink（嵌入式，base: ${t.base ?? '未知'}）`;
  }
  return '未设置';
}