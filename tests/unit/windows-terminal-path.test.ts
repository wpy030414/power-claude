import { test } from 'node:test';
import assert from 'node:assert/strict';
import { win32 } from 'node:path';
import {
  windowsTerminalSettingsCandidates,
  resolveWindowsTerminalSettingsPath,
} from '../../src/domain/windows-terminal-settings.js';

const LAD = win32.join('C:\\Users\\tester', 'AppData', 'Local');
const STABLE = win32.join(LAD, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json');
const PREVIEW = win32.join(LAD, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json');
const UNPACKAGED = win32.join(LAD, 'Microsoft', 'Windows Terminal', 'settings.json');

function existsOf(existing: string[]): (p: string) => boolean {
  const set = new Set(existing);
  return (p: string) => set.has(p);
}

test('candidates: 依次为 stable → Preview → 免安装版', () => {
  assert.deepEqual(windowsTerminalSettingsCandidates(LAD), [STABLE, PREVIEW, UNPACKAGED]);
});

test('resolve: 仅 stable 存在时选 stable', () => {
  assert.equal(resolveWindowsTerminalSettingsPath(LAD, existsOf([STABLE])), STABLE);
});

test('resolve: 仅 Preview 存在时选 Preview（irm 机器的真实场景）', () => {
  assert.equal(resolveWindowsTerminalSettingsPath(LAD, existsOf([PREVIEW])), PREVIEW);
});

test('resolve: 仅免安装版存在时选免安装版', () => {
  assert.equal(resolveWindowsTerminalSettingsPath(LAD, existsOf([UNPACKAGED])), UNPACKAGED);
});

test('resolve: stable 与 Preview 双装时优先 stable', () => {
  assert.equal(resolveWindowsTerminalSettingsPath(LAD, existsOf([STABLE, PREVIEW])), STABLE);
});

test('resolve: 全部缺失时返回 null（由上层给出明确报错）', () => {
  assert.equal(resolveWindowsTerminalSettingsPath(LAD, existsOf([])), null);
});
