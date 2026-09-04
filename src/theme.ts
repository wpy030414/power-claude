export const POWER_CLAUDE_GUID = '{BCC127B2-DCA0-4287-BA8A-0BEF9AA9015D}';

// ── Windows Terminal 配色方案 ──
export interface TerminalScheme {
  name: string;
  background: string;
  foreground: string;
  cursorColor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  purple: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightPurple: string;
  brightCyan: string;
  brightWhite: string;
}

export const SAKURA_PINK_SCHEME: TerminalScheme = {
  name: 'Sakura Pink',
  background: '#FFF0F5',
  foreground: '#8B2252',
  cursorColor: '#C07080',
  selectionBackground: '#F0C8D8',
  black: '#5A3A4A',
  red: '#C07080',
  green: '#6B8E6B',
  yellow: '#B8865A',
  blue: '#6A7FA8',
  purple: '#A8658A',
  cyan: '#5A8A8A',
  white: '#8B5A6A',
  brightBlack: '#8B7A80',
  brightRed: '#C07080',
  brightGreen: '#80A080',
  brightYellow: '#D4A060',
  brightBlue: '#8090C0',
  brightPurple: '#C080A0',
  brightCyan: '#70A0A0',
  brightWhite: '#D4A8B8',
};

// ── Windows Terminal 主题（标签栏、窗口） ──
export interface TerminalTheme {
  name: string;
  tab: { background: string; showCloseButton: string };
  tabRow: { background: string; unfocusedBackground: string };
  window: { applicationTheme: string; useMica: boolean };
}

export const SAKURA_PINK_TERMINAL_THEME: TerminalTheme = {
  name: 'Sakura Pink',
  tab: { background: '#FFF0F5', showCloseButton: 'always' },
  tabRow: { background: '#FFE4EC', unfocusedBackground: '#F5E0E8' },
  window: { applicationTheme: 'light', useMica: true },
};

// ── Claude Code 主题文件（基于 light-daltonized） ──
export interface ClaudeThemeFile {
  name: string;
  base: string;
  overrides: Record<string, string>;
}

export const SAKURA_PINK_CLAUDE_THEME: ClaudeThemeFile = {
  name: 'Sakura Pink',
  base: 'light-daltonized',
  overrides: {
    accentColor: '#C07080',
    dangerColor: '#B08090',
    warningColor: '#D4A060',
    infoColor: '#8090C0',
    primaryColor: '#C07080',
    linkColor: '#6A7FA8',
    borderColor: '#F0C8D8',
    textColor: '#8B2252',
    background: '#FFF0F5',
    foreground: '#8B2252',
    inputColor: '#FFE4EC',
    statusColor: '#C07080',
    fillColor: '#F0C8D8',
  },
};

// ── PowerClaude 终端配置 ──
export interface PowerClaudeProfile {
  guid: string;
  name: string;
  commandline: string;
  icon: string | null;
  hidden: boolean;
  startingDirectory: string;
  colorScheme?: string;
}

export function createPowerClaudeProfile(iconPath: string | null): PowerClaudeProfile {
  return {
    guid: POWER_CLAUDE_GUID,
    name: 'PowerClaude',
    commandline: 'powershell.exe -NoLogo -NoExit -Command "claude"',
    icon: iconPath,
    hidden: false,
    startingDirectory: process.env.USERPROFILE || process.env.HOME || '~',
  };
}