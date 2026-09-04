import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertPowerClaudeProfile,
  applySakuraPinkTheme,
  type TerminalSettings,
} from '../../src/domain/windows-terminal-settings.js';
import {
  POWER_CLAUDE_GUID,
  SAKURA_PINK_SCHEME,
  SAKURA_PINK_TERMINAL_THEME,
  createPowerClaudeProfile,
} from '../../src/theme.js';

// ── 测试工具 ──

const USER_PROFILE = {
  guid: '{11111111-2222-3333-4444-555555555555}',
  name: 'PowerShell',
  commandline: 'powershell.exe',
};

function minimalSettings(): TerminalSettings {
  return {
    profiles: {
      defaults: {},
      list: [{ ...USER_PROFILE }],
    },
  };
}

function profileGuids(config: TerminalSettings): string[] {
  return (config.profiles.list as Array<{ guid?: string }>).map(p => p.guid ?? '');
}

// ── upsertPowerClaudeProfile ──

test('upsert: 全新配置追加 profile、设默认、mru、新标签菜单置顶', () => {
  const config = minimalSettings();
  const profile = createPowerClaudeProfile('C:\\icon.exe', null);
  upsertPowerClaudeProfile(config, profile);

  const guids = profileGuids(config);
  assert.equal(guids.length, 2);
  assert.equal(guids[0], USER_PROFILE.guid, '用户已有 profile 保持在前面不动');
  assert.equal(guids[1], POWER_CLAUDE_GUID);
  assert.equal(config.defaultProfile, POWER_CLAUDE_GUID);
  assert.equal(config.tabSwitcherMode, 'mru');
  assert.deepEqual(config.newTabMenu, [{ type: 'profile', profile: POWER_CLAUDE_GUID }]);
});

test('upsert: 已有小写 GUID 的旧 PowerClaude profile 被替换而非重复', () => {
  const config = minimalSettings();
  const stale = { guid: POWER_CLAUDE_GUID.toLowerCase(), name: 'PowerClaude', commandline: 'old' };
  (config.profiles.list as unknown[]).push(stale);

  const profile = createPowerClaudeProfile('C:\\icon.exe', null);
  upsertPowerClaudeProfile(config, profile);

  const matches = profileGuids(config).filter(g => g.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase());
  assert.equal(matches.length, 1, '同 GUID 只保留一个');
  const list = config.profiles.list as Array<Record<string, unknown>>;
  const current = list.find(p => (p.guid as string).toLowerCase() === POWER_CLAUDE_GUID.toLowerCase());
  assert.equal(current?.commandline, profile.commandline, '保留的是新 profile');
});

test('upsert: newTabMenu 已有按名字引用的 PowerClaude 条目时不重复添加', () => {
  const config = minimalSettings();
  config.newTabMenu = [{ type: 'profile', profile: 'PowerClaude' }];

  upsertPowerClaudeProfile(config, createPowerClaudeProfile(null, null));

  assert.equal((config.newTabMenu as unknown[]).length, 1);
});

test('upsert: 重复执行幂等（第二次不产生任何差异）', () => {
  const config = minimalSettings();
  const profile = createPowerClaudeProfile('C:\\icon.exe', 'C:\\bg.png');
  upsertPowerClaudeProfile(config, profile);
  const first = JSON.parse(JSON.stringify(config)) as TerminalSettings;

  upsertPowerClaudeProfile(config, profile);
  assert.deepEqual(config, first);
});

// ── applySakuraPinkTheme ──

test('theme: 全新配置追加 scheme/theme、设置默认配色与全局主题', () => {
  const config = minimalSettings();
  (config.profiles.list as unknown[]).push(createPowerClaudeProfile(null, null));

  applySakuraPinkTheme(config);

  assert.deepEqual(config.schemes, [SAKURA_PINK_SCHEME]);
  assert.deepEqual(config.themes, [SAKURA_PINK_TERMINAL_THEME]);
  assert.equal(config.profiles.defaults.colorScheme, 'Sakura Pink');
  assert.equal(config.theme, 'Sakura Pink');
  const list = config.profiles.list as Array<Record<string, unknown>>;
  const pc = list.find(p => (p.guid as string) === POWER_CLAUDE_GUID);
  assert.equal(pc?.colorScheme, 'Sakura Pink', 'PowerClaude profile 单独设配色');
  const user = list.find(p => (p.guid as string) === USER_PROFILE.guid);
  assert.equal(user?.colorScheme, undefined, '用户 profile 不被改写');
});

test('theme: 已有同名 scheme/theme 不重复添加', () => {
  const config = minimalSettings();
  config.schemes = [{ ...SAKURA_PINK_SCHEME }];
  config.themes = [{ ...SAKURA_PINK_TERMINAL_THEME }];

  applySakuraPinkTheme(config);

  assert.equal(config.schemes.length, 1);
  assert.equal(config.themes.length, 1);
});

test('theme: PowerClaude profile 不存在时不报错', () => {
  const config = minimalSettings();
  applySakuraPinkTheme(config);
  assert.equal(config.theme, 'Sakura Pink');
});

test('theme: 重复执行幂等', () => {
  const config = minimalSettings();
  (config.profiles.list as unknown[]).push(createPowerClaudeProfile(null, null));
  applySakuraPinkTheme(config);
  const first = JSON.parse(JSON.stringify(config)) as TerminalSettings;

  applySakuraPinkTheme(config);
  assert.deepEqual(config, first);
});
