// Windows Terminal 配置：定位、读写、变换、编排（单文件，对齐 macos-terminal.ts 的组织方式）
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, win32, dirname } from 'node:path';
import {
  type TerminalScheme,
  type TerminalTheme,
  type PowerClaudeProfile,
  SAKURA_PINK_SCHEME,
  SAKURA_PINK_TERMINAL_THEME,
  POWER_CLAUDE_GUID,
  createPowerClaudeProfile,
  getPowerClaudeBackground,
} from '../theme.js';
import { detectClaudeInstallation, type ClaudeInstallation } from '../claude-installation.js';
import { currentDetectionEnvironment } from '../node-system.js';

// ── 类型 ──
export interface TerminalSettings {
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

// ── 配置文件定位（多版本，纯逻辑）──
// 候选优先级：商店稳定版 → 商店 Preview 版 → 免安装（unpackaged）版；多版本共存时取先命中者。
// 固定使用 win32 语义拼接（该配置只存在于 Windows），与宿主运行平台无关。
export function windowsTerminalSettingsCandidates(localAppData: string): string[] {
  return [
    win32.join(localAppData, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    win32.join(localAppData, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    win32.join(localAppData, 'Microsoft', 'Windows Terminal', 'settings.json'),
  ];
}

/** 返回第一个实际存在的候选路径；全部缺失返回 null（由上层给出明确报错） */
export function resolveWindowsTerminalSettingsPath(
  localAppData: string,
  exists: (path: string) => boolean,
): string | null {
  for (const candidate of windowsTerminalSettingsCandidates(localAppData)) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

// ── 文件读写与备份（唯一触碰 settings.json 的地方）──

export function getWindowsTerminalSettingsPath(): string {
  if (platform() !== 'win32') {
    throw new Error('Windows Terminal 配置仅支持 Windows');
  }
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const resolved = resolveWindowsTerminalSettingsPath(localAppData, existsSync);
  if (!resolved) {
    const searched = windowsTerminalSettingsCandidates(localAppData)
      .map(p => `  - ${p}`)
      .join('\n');
    throw new Error(
      `未找到 Windows Terminal 配置文件。已查找：\n${searched}\n` +
        '  请先安装 Windows Terminal（稳定版 / Preview / 免安装版均可）；若已安装，请先启动一次让它生成配置。',
    );
  }
  return resolved;
}

export function readWindowsTerminalSettings(): TerminalSettings {
  const path = getWindowsTerminalSettingsPath();
  if (!existsSync(path)) {
    throw new Error(`未找到 Windows Terminal 配置文件: ${path}\n  请先安装 Windows Terminal。`);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as TerminalSettings;
}

export function writeWindowsTerminalSettings(config: TerminalSettings): void {
  writeFileSync(getWindowsTerminalSettingsPath(), JSON.stringify(config, null, 4) + '\n', 'utf-8');
}

/** 原地复制为 settings.json.bak-<时间戳>，返回备份路径 */
export function backupWindowsTerminalSettings(): string {
  const path = getWindowsTerminalSettingsPath();
  const backup = path.replace('settings.json', `settings.json.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  copyFileSync(path, backup);
  return backup;
}

// ── 安装 PowerClaude profile（原地变换）──
// 按固定 GUID 去重（忽略大小写）→ 追加 → 设为默认 → mru 切换器 → 新标签菜单置顶
export function upsertPowerClaudeProfile(
  config: TerminalSettings,
  profile: PowerClaudeProfile,
): TerminalSettings {
  const guidLower = POWER_CLAUDE_GUID.toLowerCase();

  // 清理所有已有同 GUID 的 profile（避免重复），再追加新的
  // 无 guid 的用户条目一律保留
  const list = config.profiles.list as Array<Record<string, unknown>>;
  const filtered = list.filter(p => {
    const g = p.guid as string | undefined;
    return !g || g.toLowerCase() !== guidLower;
  });
  filtered.push(profile as unknown as Record<string, unknown>);
  config.profiles.list = filtered;

  // 设为默认
  config.defaultProfile = POWER_CLAUDE_GUID;

  // Tab 切换器：最近使用优先
  config.tabSwitcherMode = 'mru';

  // 新标签菜单置顶（GUID 比较忽略大小写；兼容按名字引用的旧条目）
  if (!config.newTabMenu) config.newTabMenu = [];
  const menu = config.newTabMenu as Array<Record<string, unknown>>;
  const hasPowerClaude = menu.some(m => {
    const g = m.profile as string | undefined;
    return g?.toLowerCase() === guidLower || m.profile === 'PowerClaude';
  });
  if (!hasPowerClaude) {
    menu.push({ type: 'profile', profile: POWER_CLAUDE_GUID });
  }

  return config;
}

// ── 应用 Sakura Pink 主题（原地变换）──
// scheme/theme 按名去重；defaults 与全局 theme 设为 Sakura Pink；PowerClaude profile 单独再设一次配色
export function applySakuraPinkTheme(config: TerminalSettings): TerminalSettings {
  // 配色方案
  if (!config.schemes) config.schemes = [];
  const hasScheme = config.schemes.some(s => s.name === 'Sakura Pink');
  if (!hasScheme) {
    config.schemes.push(SAKURA_PINK_SCHEME);
  }

  // 默认配色
  config.profiles.defaults.colorScheme = 'Sakura Pink';

  // 窗口/标签栏主题
  if (!config.themes) config.themes = [];
  const hasTheme = config.themes.some(t => t.name === 'Sakura Pink');
  if (!hasTheme) {
    config.themes.push(SAKURA_PINK_TERMINAL_THEME);
  }
  config.theme = 'Sakura Pink';

  // PowerClaude profile 单独设配色（GUID 比较忽略大小写；找不到则跳过）
  const list = config.profiles.list as Array<Record<string, unknown>>;
  const pc = list.find(p => {
    const g = p.guid as string | undefined;
    return g?.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase();
  });
  if (pc) pc.colorScheme = 'Sakura Pink';

  return config;
}

// ── 应用层编排 ──

/** 检测 Claude Code CLI（native / npm / path 三类来源） */
export function detectWindowsClaudeCli(): ClaudeInstallation | null {
  return detectClaudeInstallation(currentDetectionEnvironment());
}

/** 是否已安装 PowerClaude profile（读配置按 GUID 判断，忽略大小写） */
export function isPowerClaudeInstalled(): boolean {
  try {
    const config = readWindowsTerminalSettings();
    const list = config.profiles.list as Array<Record<string, unknown>>;
    return list.some(p => {
      const g = p.guid as string | undefined;
      return g?.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase();
    });
  } catch {
    return false;
  }
}

/** 备份 settings.json（时间戳副本），返回备份路径 */
export function backupWindowsTerminal(): string {
  return backupWindowsTerminalSettings();
}

/** 安装核心配置：背景图缓存 + PowerClaude profile 去重安装 + 默认项/切换器/新标签菜单 */
export function installPowerClaudeCore(installation: ClaudeInstallation): void {
  const config = readWindowsTerminalSettings();

  // 背景图：把 public/ 里的图片拷到固定位置，再作为背景写入
  const bg = getPowerClaudeBackground();
  if (bg) {
    try {
      if (!existsSync(dirname(bg.dest))) mkdirSync(dirname(bg.dest), { recursive: true });
      copyFileSync(bg.source, bg.dest);
    } catch (e) {
      // 图片拷贝失败不应阻断整个安装
      console.warn(`背景图拷贝失败，已跳过背景: ${String(e)}`);
    }
  }

  // profile 图标复用探测到的 claude 可执行文件路径
  const profile = createPowerClaudeProfile(installation.executablePath, bg ? bg.dest : null);
  upsertPowerClaudeProfile(config, profile);
  writeWindowsTerminalSettings(config);
}

/** 应用 Sakura Pink 终端主题（scheme / theme / 默认配色） */
export function applyWindowsTerminalTheme(): void {
  const config = readWindowsTerminalSettings();
  applySakuraPinkTheme(config);
  writeWindowsTerminalSettings(config);
}