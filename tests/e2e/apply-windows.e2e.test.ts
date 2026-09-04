// E2E：以子进程跑真实 CLI（src/index.ts），在完全沙箱化的环境里验证 Windows 安装链路。
//
// 沙箱要点：
// - USERPROFILE / APPDATA / LOCALAPPDATA 指向临时目录，真实配置零接触
// - PATH 收窄到只含桩目录：detection 只看得见桩 claude；
//   同时 tasklist/taskkill 解析不到，daemon 重启步骤静默失效（既有 try/catch 吞掉），
//   不会误杀宿主机上正在运行的 claude.exe
// - cwd 指向沙箱 work/：public/ 背景图查找可控
// - 交互：clack confirm 在非 TTY 下以「y\n」选 Yes、「n\n」选 No（已探针验证）
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POWER_CLAUDE_GUID } from '../../src/theme.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// tsx CLI 入口（直接用 node 跑，避免 shell shim 与 PATH 依赖）
const require = createRequire(import.meta.url);
const TSX_CLI = join(dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
const ENTRY = join(REPO_ROOT, 'src', 'index.ts');

type WtVariant = 'stable' | 'preview' | 'unpackaged';
const WT_SETTINGS_DIRS: Record<WtVariant, string> = {
  stable: join('Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState'),
  preview: join('Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState'),
  unpackaged: join('Microsoft', 'Windows Terminal'),
};
const USER_PROFILE = {
  guid: '{11111111-2222-3333-4444-555555555555}',
  name: 'PowerShell',
  commandline: 'powershell.exe',
};

// ── 沙箱 ──

interface Sandbox {
  root: string;
  home: string;
  localAppData: string;
  roamingAppData: string;
  bin: string;
  work: string;
}

function makeSandbox(t: TestContext): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'powerclaude-e2e-'));
  const sb: Sandbox = {
    root,
    home: join(root, 'home'),
    localAppData: join(root, 'LocalAppData'),
    roamingAppData: join(root, 'RoamingAppData'),
    bin: join(root, 'bin'),
    work: join(root, 'work'),
  };
  for (const dir of Object.values(sb)) mkdirSync(dir, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return sb;
}

/** 放一份最小可用的 Windows Terminal settings.json fixture */
function installTerminalFixture(sb: Sandbox, variant: WtVariant = 'stable'): void {
  const dir = join(sb.localAppData, WT_SETTINGS_DIRS[variant]);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'settings.json'),
    JSON.stringify({ profiles: { defaults: {}, list: [{ ...USER_PROFILE }] } }, null, 4),
    'utf-8',
  );
}

function stubNativeInstall(sb: Sandbox): string {
  const exe = join(sb.home, '.local', 'bin', 'claude.exe');
  mkdirSync(dirname(exe), { recursive: true });
  writeFileSync(exe, 'MZ-stub');
  return exe;
}

function stubNpmInstall(sb: Sandbox): string {
  const cmd = join(sb.roamingAppData, 'npm', 'claude.cmd');
  mkdirSync(dirname(cmd), { recursive: true });
  writeFileSync(cmd, '@echo off\r\n');
  return cmd;
}

function stubPathInstall(sb: Sandbox): string {
  const exe = join(sb.bin, 'claude.exe');
  writeFileSync(exe, 'MZ-stub');
  return exe;
}

// ── 运行真实 CLI ──

interface CliResult {
  code: number | null;
  output: string;
}

function runCli(sb: Sandbox, stdinText: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, ENTRY], {
      cwd: sb.work,
      env: {
        USERPROFILE: sb.home,
        HOME: sb.home,
        APPDATA: sb.roamingAppData,
        LOCALAPPDATA: sb.localAppData,
        PATH: sb.bin,
        PATHEXT: '.COM;.EXE;.BAT;.CMD',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString('utf-8')));
    child.stderr.on('data', (d: Buffer) => (output += d.toString('utf-8')));
    const killer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI 60s 未退出，输出：\n${output}`));
    }, 60000);
    child.on('error', err => {
      clearTimeout(killer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(killer);
      resolve({ code, output });
    });
    // 等 clack 挂上 stdin 监听后再喂答案（管道有缓冲，稍延迟即可）
    setTimeout(() => {
      child.stdin.write(stdinText);
      child.stdin.end();
    }, 300);
  });
}

// ── 断言辅助 ──

interface WrittenSettings {
  defaultProfile?: string;
  tabSwitcherMode?: string;
  theme?: string;
  newTabMenu?: Array<Record<string, unknown>>;
  schemes?: Array<{ name: string }>;
  themes?: Array<{ name: string }>;
  profiles: { defaults: Record<string, unknown>; list: Array<Record<string, unknown>> };
}

function readWrittenSettings(sb: Sandbox, variant: WtVariant = 'stable'): WrittenSettings {
  return JSON.parse(readFileSync(join(sb.localAppData, WT_SETTINGS_DIRS[variant], 'settings.json'), 'utf-8')) as WrittenSettings;
}

function powerClaudeProfiles(settings: WrittenSettings): Array<Record<string, unknown>> {
  return settings.profiles.list.filter(
    p => (p.guid as string | undefined)?.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase(),
  );
}

function backupFiles(sb: Sandbox, variant: WtVariant = 'stable'): string[] {
  return readdirSync(join(sb.localAppData, WT_SETTINGS_DIRS[variant])).filter(f => f.includes('.bak-'));
}

// Windows 专属链路：其他平台跑不出 LOCALAPPDATA 语义，整体跳过
const winOnly = { skip: process.platform !== 'win32' };

// ── 场景 ──

test('未安装任何 CLI：退出码 1，指引同时给出 irm 与 npm 两种安装方式', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 1);
  assert.ok(output.includes('未检测到 Claude Code CLI'), '应报告未检测到');
  assert.ok(output.includes('irm https://claude.ai/install.ps1'), '应给出 irm 原生安装指引');
  assert.ok(output.includes('npm install -g @anthropic-ai/claude-code'), '应保留 npm 安装指引');
  assert.equal(backupFiles(sb).length, 0, '检测失败不应产生备份');
});

test('irm 原生安装：检测为 native，全链路写出正确配置', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);
  const nativeExe = stubNativeInstall(sb);

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 0, `输出：\n${output}`);
  assert.ok(output.includes('官方原生安装'), '成功行应标注安装来源');

  const settings = readWrittenSettings(sb);
  assert.equal(settings.defaultProfile, POWER_CLAUDE_GUID);
  assert.equal(settings.tabSwitcherMode, 'mru');
  assert.equal(settings.theme, 'Sakura Pink');
  assert.deepEqual(settings.newTabMenu, [{ type: 'profile', profile: POWER_CLAUDE_GUID }]);

  const pcs = powerClaudeProfiles(settings);
  assert.equal(pcs.length, 1);
  const pcProfile = pcs[0]!;
  assert.equal(pcProfile.commandline, 'powershell.exe -NoLogo -NoExit -Command "claude"');
  assert.equal(pcProfile.icon, nativeExe, '图标复用探测到的可执行文件路径');
  assert.equal(pcProfile.startingDirectory, sb.home);
  assert.equal(pcProfile.colorScheme, 'Sakura Pink');
  assert.equal(pcProfile.backgroundImage, undefined, '无背景图时不写背景字段');

  // 用户已有 profile 不被改写
  const user = settings.profiles.list.find(p => p.guid === USER_PROFILE.guid);
  assert.deepEqual(user, USER_PROFILE);

  assert.equal(settings.schemes?.length, 1);
  assert.equal(settings.schemes?.[0]?.name, 'Sakura Pink');
  assert.equal(settings.themes?.length, 1);
  assert.equal(settings.profiles.defaults.colorScheme, 'Sakura Pink');

  // 备份 + Claude Code 主题文件
  assert.equal(backupFiles(sb).length, 1);
  const themeFile = JSON.parse(
    readFileSync(join(sb.home, '.claude', 'themes', 'sakura-pink.json'), 'utf-8'),
  ) as { base: string };
  assert.equal(themeFile.base, 'light-daltonized');
  const claudeSettings = JSON.parse(
    readFileSync(join(sb.home, '.claude', 'settings.json'), 'utf-8'),
  ) as { theme: string };
  assert.equal(claudeSettings.theme, 'custom:sakura-pink');
});

test('npm 安装：检测为 npm 来源并完成安装', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);
  const npmCmd = stubNpmInstall(sb);

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 0, `输出：\n${output}`);
  assert.ok(output.includes('npm 全局安装'));
  const pcs = powerClaudeProfiles(readWrittenSettings(sb));
  assert.equal(pcs[0]?.icon, npmCmd);
});

test('仅 PATH 可解析（非常见目录）：检测为 PATH 来源', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);
  const pathExe = stubPathInstall(sb);

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 0, `输出：\n${output}`);
  assert.ok(output.includes('（PATH）'));
  const pcs = powerClaudeProfiles(readWrittenSettings(sb));
  assert.equal(pcs[0]?.icon, pathExe);
});

test('幂等：连续两次运行不产生重复 profile / scheme / theme', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);
  stubNativeInstall(sb);

  const first = await runCli(sb, 'y\n');
  assert.equal(first.code, 0, `第一次输出：\n${first.output}`);
  const second = await runCli(sb, 'y\n');
  assert.equal(second.code, 0, `第二次输出：\n${second.output}`);

  const settings = readWrittenSettings(sb);
  assert.equal(powerClaudeProfiles(settings).length, 1);
  assert.equal(settings.schemes?.length, 1);
  assert.equal(settings.themes?.length, 1);
  assert.equal(
    (settings.newTabMenu ?? []).filter(
      m => (m.profile as string | undefined)?.toLowerCase() === POWER_CLAUDE_GUID.toLowerCase(),
    ).length,
    1,
  );
  assert.equal(backupFiles(sb).length, 2, '每次运行各自备份一次');
});

test('主题确认选 No：核心安装照做，但不写任何主题配置', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);
  stubNativeInstall(sb);

  const { code, output } = await runCli(sb, 'n\n');

  assert.equal(code, 0, `输出：\n${output}`);
  const settings = readWrittenSettings(sb);
  const pcs = powerClaudeProfiles(settings);
  assert.equal(pcs.length, 1, '核心 profile 仍应安装');
  assert.equal(settings.defaultProfile, POWER_CLAUDE_GUID);
  assert.equal(settings.schemes, undefined, '不应写入配色方案');
  assert.equal(settings.theme, undefined, '不应写入全局主题');
  assert.equal(pcs[0]?.colorScheme, undefined);
  assert.ok(!existsSync(join(sb.home, '.claude')), '不应创建 ~/.claude（无背景图且不应用主题）');
});

test('背景图：public/ 有图时缓存到 ~/.claude 并写入 profile 背景字段', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb);
  stubNativeInstall(sb);
  const publicDir = join(sb.work, 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'sakura.png'), 'PNG-STUB');

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 0, `输出：\n${output}`);
  const dest = join(sb.home, '.claude', 'powerclaude-background.png');
  assert.ok(existsSync(dest), '背景图应缓存到 ~/.claude');
  assert.equal(readFileSync(dest, 'utf-8'), 'PNG-STUB');
  const pcs = powerClaudeProfiles(readWrittenSettings(sb));
  assert.equal(pcs[0]?.backgroundImage, dest);
  assert.equal(pcs[0]?.backgroundImageOpacity, 0.18);
  assert.equal(pcs[0]?.backgroundImageStretchMode, 'uniformToFill');
});

// ── 回归：2026-09-05 真机事故（Preview 版路径不存在 → 备份 ENOENT → spinner 挂死）──

test('回归：无任何 Windows Terminal 配置时明确报错退出，不挂死', winOnly, async t => {
  const sb = makeSandbox(t);
  stubNativeInstall(sb);
  // 故意不放任何 settings.json fixture

  // 进程若能正常退出即证明未挂死（挂死会触发 runCli 的 60s 超时使测试失败）
  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 1);
  assert.ok(output.includes('备份失败'), '应明确标记备份步骤失败');
  assert.ok(output.includes('未找到 Windows Terminal 配置文件'), '应给出明确原因');
  assert.ok(output.includes('Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe'), '报错应列出已查找的位置');
  assert.ok(output.includes('Microsoft\\Windows Terminal'), '免安装版路径也应在查找列表中');
});

test('回归：仅安装 Preview 版时，全链路写入 Preview 包路径', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb, 'preview');
  stubNativeInstall(sb);

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 0, `输出：\n${output}`);
  const settings = readWrittenSettings(sb, 'preview');
  assert.equal(settings.defaultProfile, POWER_CLAUDE_GUID);
  assert.equal(powerClaudeProfiles(settings).length, 1);
  assert.equal(backupFiles(sb, 'preview').length, 1, '备份应落在 Preview 配置同目录');
});

test('回归：stable 与 Preview 双装时只写 stable，Preview 配置不动', winOnly, async t => {
  const sb = makeSandbox(t);
  installTerminalFixture(sb, 'stable');
  installTerminalFixture(sb, 'preview');
  stubNativeInstall(sb);

  const { code, output } = await runCli(sb, 'y\n');

  assert.equal(code, 0, `输出：\n${output}`);
  assert.equal(readWrittenSettings(sb, 'stable').defaultProfile, POWER_CLAUDE_GUID);
  const preview = readWrittenSettings(sb, 'preview');
  assert.equal(preview.defaultProfile, undefined, 'Preview 配置不应被改写');
  assert.equal(powerClaudeProfiles(preview).length, 0);
});
