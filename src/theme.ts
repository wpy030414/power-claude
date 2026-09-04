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
  foreground: '#A63A6E',
  cursorColor: '#E86A92',
  selectionBackground: '#FFB8CC',
  black: '#4A3640',
  red: '#FF6B8A',
  green: '#5FB77E',
  yellow: '#F0A65E',
  blue: '#6FA9E6',
  purple: '#CC5BA8',
  cyan: '#4FB0C0',
  white: '#995E78',
  brightBlack: '#8A7280',
  brightRed: '#FF85A0',
  brightGreen: '#7CCB98',
  brightYellow: '#F8BE7A',
  brightBlue: '#8DBEF0',
  brightPurple: '#DE74BE',
  brightCyan: '#66C8D6',
  brightWhite: '#E4B4C8',
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
  tabRow: { background: '#FFDCE8', unfocusedBackground: '#F5D6E2' },
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
    // 主色/强调（原 accentColor / primaryColor）
    claude: '#FF6B8A',
    claudeShimmer: '#FF8FA8',
    // 语义色（新版：dangerColor→error、warningColor→warning、infoColor→suggestion）
    error: '#E05A7A',
    warning: '#F0A65E',
    warningShimmer: '#F8BE7A',
    success: '#5FB77E',
    merged: '#CC5BA8',
    suggestion: '#6FA9E6',
    remember: '#FF6B8A',
    permission: '#6FA9E6',
    permissionShimmer: '#8DBEF0',
    // 文本（原 textColor / foreground）
    text: '#A63A6E',
    inverseText: '#FFF0F5',
    inactive: '#D4A0B4',
    inactiveShimmer: '#E4B8C8',
    subtle: '#C08CA8',
    // 背景/选中（原 background / fillColor）
    background: '#FFF0F5',
    selectionBg: '#FFB8CC',
    userMessageBackground: '#FFE1EA',
    userMessageBackgroundHover: '#FBD2E0',
    composerSidebarBackground: '#F5D6E2',
    bashMessageBackgroundColor: '#F5D6E2',
    memoryBackgroundColor: '#F5D6E2',
    // 边框/输入框（原 borderColor / inputColor / linkColor）
    promptBorder: '#FFB8CC',
    promptBorderShimmer: '#FFD0DE',
    bashBorder: '#FFB8CC',
    planMode: '#6FA9E6',
    ide: '#6FA9E6',
    // 模式强调（原 statusColor）
    fastMode: '#FF6B8A',
    fastModeShimmer: '#FF8FA8',
    effortUltra: '#CC5BA8',
    skill: '#FF6B8A',
    autoAccept: '#5FB77E',
    autoAcceptShimmer: '#7CCB98',
    // 速率指示
    rate_limit_fill: '#FF6B8A',
    rate_limit_empty: '#FFB8CC',
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