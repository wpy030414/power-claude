// 领域：Windows Terminal settings.json 的纯变换
// 只操作传入的 settings 对象（原地修改并返回），不做任何文件 IO。
// 行为与历史实现保持一致：GUID 比较忽略大小写、按名去重、不删用户已有配置。
import { win32 } from 'node:path';
import {
  type TerminalScheme,
  type TerminalTheme,
  type PowerClaudeProfile,
  SAKURA_PINK_SCHEME,
  SAKURA_PINK_TERMINAL_THEME,
  POWER_CLAUDE_GUID,
} from '../theme.js';

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
