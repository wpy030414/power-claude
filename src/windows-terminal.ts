import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import {
  type TerminalScheme,
  type TerminalTheme,
  SAKURA_PINK_SCHEME,
  SAKURA_PINK_TERMINAL_THEME,
  POWER_CLAUDE_GUID,
  createPowerClaudeProfile,
  getPowerClaudeBackground,
} from './theme.js';

// ── 路径 ──
function getSettingsPath(): string {
  if (platform() === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(
      localAppData,
      'Packages',
      'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
      'LocalState',
      'settings.json',
    );
  }
  // macOS / Linux: ~/.config/terminal/settings.json-like path
  // For now, Windows only for the terminal part
  throw new Error('Windows Terminal 配置仅支持 Windows');
}

// ── 类型 ──
interface TerminalSettings {
  $schema?: string;
  $help?: string;
  actions?: unknown[];
  copyFormatting?: string;
  copyOnSelect?: boolean;
  defaultProfile?: string;
  keybindings?: unknown[];
  newTabMenu?: unknown[];
  profiles: {
    defaults: Record<string, unknown>;
    list: unknown[];
  };
  schemes?: TerminalScheme[];
  theme?: string;
  themes?: TerminalTheme[];
  tabSwitcherMode?: string;
  [key: string]: unknown;
}

// ── 读取 ──
export function readSettings(): TerminalSettings {
  const path = getSettingsPath();
  if (!existsSync(path)) {
    throw new Error(`未找到 Windows Terminal 配置文件: ${path}\n  请先安装 Windows Terminal。`);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as TerminalSettings;
}

// ── 写入 ──
export function writeSettings(config: TerminalSettings): void {
  const path = getSettingsPath();
  writeFileSync(path, JSON.stringify(config, null, 4) + '\n', 'utf-8');
}

// ── 备份 ──
export function backupSettings(): string {
  const path = getSettingsPath();
  const backup = path.replace('settings.json', `settings.json.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  copyFileSync(path, backup);
  return backup;
}

// ── 检测 Claude Code 安装位置 ──
export function findClaudeExe(): string | null {
  const candidates = [
    join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.ps1'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Check PATH
  try {
    const which = process.env.PATH?.split(';').find(p => existsSync(join(p, 'claude')));
    if (which) return join(which, 'claude');
  } catch {
    // ignore
  }
  return null;
}

// ── 安装 PowerClaude 核心配置 ──
export function installPowerClaude(): TerminalSettings {
  const config = readSettings();
  const claudeExe = findClaudeExe();

  // 背景图：把 public/ 里的图片拷到固定位置，再作为背景写入
  const bg = getPowerClaudeBackground();
  if (bg) {
    try {
      const dest = bg.dest;
      if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(bg.source, dest);
    } catch (e) {
      // 图片拷贝失败不应阻断整个安装
      console.warn(`背景图拷贝失败，已跳过背景: ${String(e)}`);
    }
  }

  // 创建 PowerClaude profile（传入背景图绝对路径）
  const profile = createPowerClaudeProfile(claudeExe, bg ? bg.dest : null);

  // 清理所有已有同名 GUID 的 profile（避免重复），再添加新的
  // 注意：GUID 比较必须忽略大小写（Windows Terminal 可能写入小写）
  const guidLower = POWER_CLAUDE_GUID.toLowerCase();
  const list = config.profiles.list as Array<Record<string, unknown>>;
  const filtered = list.filter(p => {
    const g = p.guid as string | undefined;
    return !g || g.toLowerCase() !== guidLower;
  });
  filtered.push(profile as unknown as Record<string, unknown>);
  config.profiles.list = filtered;

  // 设为默认
  config.defaultProfile = POWER_CLAUDE_GUID;

  // Tab 切换器
  config.tabSwitcherMode = 'mru';

  // 新标签菜单置顶（GUID 比较忽略大小写）
  if (!config.newTabMenu) config.newTabMenu = [];
  const menu = config.newTabMenu as Array<Record<string, unknown>>;
  const hasPowerClaude = menu.some(m => {
    const g = m.profile as string | undefined;
    return g?.toLowerCase() === guidLower || m.profile === 'PowerClaude';
  });
  if (!hasPowerClaude) {
    menu.push({ type: 'profile', profile: POWER_CLAUDE_GUID });
  }

  writeSettings(config);
  return config;
}

// ── 应用 Windows Terminal 主题 ──
export function applyTerminalTheme(): TerminalSettings {
  const config = readSettings();

  // 配色方案
  if (!config.schemes) config.schemes = [];
  const hasScheme = config.schemes.some(s => s.name === 'Sakura Pink');
  if (!hasScheme) {
    config.schemes.push(SAKURA_PINK_SCHEME);
  }

  // 默认配色
  config.profiles.defaults.colorScheme = 'Sakura Pink';

  // 主题
  if (!config.themes) config.themes = [];
  const hasTheme = config.themes.some(t => t.name === 'Sakura Pink');
  if (!hasTheme) {
    config.themes.push(SAKURA_PINK_TERMINAL_THEME);
  }
  config.theme = 'Sakura Pink';

  // PowerClaude 配置单独设配色（GUID 比较忽略大小写）
  const list = config.profiles.list as Array<Record<string, unknown>>;
  const pc = list.find(p => {
    const g = p.guid as string | undefined;
    return g?.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase();
  });
  if (pc) pc.colorScheme = 'Sakura Pink';

  writeSettings(config);
  return config;
}

// ── 检测是否已安装 PowerClaude ──
export function isPowerClaudeInstalled(): boolean {
  try {
    const config = readSettings();
    const list = config.profiles.list as Array<Record<string, unknown>>;
    return list.some(p => {
      const g = p.guid as string | undefined;
      return g?.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase();
    });
  } catch {
    return false;
  }
}