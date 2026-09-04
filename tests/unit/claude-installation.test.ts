import { test } from 'node:test';
import assert from 'node:assert/strict';
import { win32, posix } from 'node:path';
import {
  detectClaudeInstallation,
  type DetectionEnvironment,
} from '../../src/domain/claude-installation.js';

// ── 测试工具 ──

/** 构造一个假环境：existing 集合内的路径视为存在（统一用 / 分隔以便跨平台书写断言） */
function fakeEnv(overrides: Partial<DetectionEnvironment> & { existing?: string[] } = {}): DetectionEnvironment {
  const { existing = [], ...rest } = overrides;
  const normalized = new Set(existing.map(p => p.replace(/\//g, '\\')));
  return {
    platform: 'win32',
    homeDir: 'C:\\Users\\tester',
    appDataDir: 'C:\\Users\\tester\\AppData\\Roaming',
    pathValue: '',
    pathExts: ['.COM', '.EXE', '.BAT', '.CMD'],
    exists: (p: string) => normalized.has(p.replace(/\//g, '\\')),
    ...rest,
  };
}

const NATIVE_EXE = win32.join('C:\\Users\\tester', '.local', 'bin', 'claude.exe');
const NPM_EXE = win32.join('C:\\Users\\tester\\AppData\\Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
const NPM_CMD = win32.join('C:\\Users\\tester\\AppData\\Roaming', 'npm', 'claude.cmd');
const NPM_PS1 = win32.join('C:\\Users\\tester\\AppData\\Roaming', 'npm', 'claude.ps1');

// ── Windows：候选路径优先级 ──

test('win32: irm 原生安装（~/.local/bin/claude.exe）探测为 native', () => {
  const result = detectClaudeInstallation(fakeEnv({ existing: [NATIVE_EXE] }));
  assert.deepEqual(result, { executablePath: NATIVE_EXE, source: 'native' });
});

test('win32: npm 全局安装（node_modules 内 claude.exe）探测为 npm', () => {
  const result = detectClaudeInstallation(fakeEnv({ existing: [NPM_EXE] }));
  assert.deepEqual(result, { executablePath: NPM_EXE, source: 'npm' });
});

test('win32: npm 仅有 cmd shim 时探测为 npm', () => {
  const result = detectClaudeInstallation(fakeEnv({ existing: [NPM_CMD] }));
  assert.deepEqual(result, { executablePath: NPM_CMD, source: 'npm' });
});

test('win32: npm 仅有 ps1 shim 时探测为 npm', () => {
  const result = detectClaudeInstallation(fakeEnv({ existing: [NPM_PS1] }));
  assert.deepEqual(result, { executablePath: NPM_PS1, source: 'npm' });
});

test('win32: native 优先于 npm 与 PATH', () => {
  const result = detectClaudeInstallation(fakeEnv({
    existing: [NATIVE_EXE, NPM_CMD, win32.join('D:\\tools', 'claude.exe')],
    pathValue: 'D:\\tools',
  }));
  assert.deepEqual(result, { executablePath: NATIVE_EXE, source: 'native' });
});

test('win32: npm 优先于 PATH', () => {
  const result = detectClaudeInstallation(fakeEnv({
    existing: [NPM_CMD, win32.join('D:\\tools', 'claude.exe')],
    pathValue: 'D:\\tools',
  }));
  assert.deepEqual(result, { executablePath: NPM_CMD, source: 'npm' });
});

// ── Windows：PATH 扫描（PATHEXT 感知）──

test('win32: PATH 中的 claude.exe 探测为 path（本仓库历史 bug 的核心场景）', () => {
  const exe = win32.join('D:\\tools', 'claude.exe');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [exe],
    pathValue: 'C:\\Windows;D:\\tools',
  }));
  assert.deepEqual(result, { executablePath: exe, source: 'path' });
});

test('win32: PATH 中的 claude.cmd 也能探测到', () => {
  const cmd = win32.join('D:\\tools', 'claude.cmd');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [cmd],
    pathValue: 'D:\\tools',
  }));
  assert.deepEqual(result, { executablePath: cmd, source: 'path' });
});

test('win32: 无扩展名的 claude（Git Bash shim）作为兜底也能探测到', () => {
  const shim = win32.join('D:\\tools', 'claude');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [shim],
    pathValue: 'D:\\tools',
  }));
  assert.deepEqual(result, { executablePath: shim, source: 'path' });
});

test('win32: PATHEXT 按给定顺序匹配（.EXE 先于 .CMD）', () => {
  const exe = win32.join('D:\\tools', 'claude.exe');
  const cmd = win32.join('D:\\tools', 'claude.cmd');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [cmd, exe],
    pathValue: 'D:\\tools',
    pathExts: ['.EXE', '.CMD'],
  }));
  assert.deepEqual(result, { executablePath: exe, source: 'path' });
});

test('win32: PATH 中多个目录时按顺序命中', () => {
  const exe = win32.join('E:\\later', 'claude.exe');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [exe],
    pathValue: 'D:\\nope;E:\\later',
  }));
  assert.deepEqual(result, { executablePath: exe, source: 'path' });
});

test('win32: PATH 含空段时跳过不报错', () => {
  const exe = win32.join('D:\\tools', 'claude.exe');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [exe],
    pathValue: ';D:\\tools;',
  }));
  assert.deepEqual(result, { executablePath: exe, source: 'path' });
});

// ── 未安装 ──

test('win32: 无任何安装痕迹时返回 null', () => {
  const result = detectClaudeInstallation(fakeEnv({ pathValue: 'C:\\Windows' }));
  assert.equal(result, null);
});

test('win32: appDataDir 缺失时跳过 npm 候选仍可走 PATH', () => {
  const exe = win32.join('D:\\tools', 'claude.exe');
  const result = detectClaudeInstallation(fakeEnv({
    existing: [exe],
    appDataDir: undefined,
    pathValue: 'D:\\tools',
  }));
  assert.deepEqual(result, { executablePath: exe, source: 'path' });
});

// ── macOS（领域层跨平台形态；macOS 链路本切片不改接线）──

test('darwin: ~/.local/bin/claude 探测为 native，路径用正斜杠', () => {
  const env = fakeEnv({
    platform: 'darwin',
    homeDir: '/Users/tester',
    appDataDir: undefined,
    pathValue: '',
    pathExts: [],
    existing: ['/Users/tester/.local/bin/claude'],
  });
  // darwin 下假环境的 exists 不做反斜杠归一
  const normalized = new Set(['/Users/tester/.local/bin/claude']);
  env.exists = (p: string) => normalized.has(p);
  const result = detectClaudeInstallation(env);
  assert.deepEqual(result, {
    executablePath: posix.join('/Users/tester', '.local', 'bin', 'claude'),
    source: 'native',
  });
});

test('darwin: PATH 中的 claude 探测为 path（无扩展名）', () => {
  const env = fakeEnv({
    platform: 'darwin',
    homeDir: '/Users/tester',
    appDataDir: undefined,
    pathValue: '/usr/local/bin:/opt/homebrew/bin',
    pathExts: [],
  });
  const normalized = new Set(['/opt/homebrew/bin/claude']);
  env.exists = (p: string) => normalized.has(p);
  const result = detectClaudeInstallation(env);
  assert.deepEqual(result, { executablePath: '/opt/homebrew/bin/claude', source: 'path' });
});
