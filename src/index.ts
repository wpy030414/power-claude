import { intro, outro, confirm, log, spinner, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { platform } from 'node:os';
import { parseArgs } from 'node:util';
import {
  detectWindowsClaudeCli,
  isPowerClaudeInstalled,
  backupWindowsTerminal,
  installPowerClaudeCore,
  applyWindowsTerminalTheme,
} from './application/windows-setup.js';
import {
  installPowerClaudeMacOS,
  applyTerminalThemeMacOS,
  backupMacOSTerminal,
  isClaudeInstalledMacOS,
  isPowerClaudeInstalledMacOS,
} from './macos-terminal.js';
import { applyClaudeTheme } from './claude-settings.js';
import { getPowerClaudeBackground } from './theme.js';
import type { ClaudeInstallSource } from './domain/claude-installation.js';

// ── CLI 参数 ──
const { values } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: false,
});

if (values.help) {
  console.log(`
${pc.bold('PowerClaude 安装向导')}

${pc.dim('用法:')}
  pnpm run apply         交互式安装

${pc.dim('选项:')}
  -h, --help  显示帮助
`);
  process.exit(0);
}

// ── 检测平台 ──
const IS_WINDOWS = platform() === 'win32';
const IS_MACOS = platform() === 'darwin';

// ── 安装来源的可读标签 ──
const SOURCE_LABELS: Record<ClaudeInstallSource, string> = {
  native: '官方原生安装',
  npm: 'npm 全局安装',
  path: 'PATH',
};

/** 未检测到 CLI 时的安装指引（按平台给出对应的原生安装命令） */
function printInstallGuidance(): void {
  log.error('未检测到 Claude Code CLI。请先安装（任选其一）：');
  if (IS_WINDOWS) {
    log.step('irm https://claude.ai/install.ps1 | iex    （官方原生安装）');
    log.step('npm install -g @anthropic-ai/claude-code （npm 全局安装）');
  } else {
    log.step('curl -fsSL https://claude.ai/install.sh | bash （官方原生安装）');
    log.step('npm install -g @anthropic-ai/claude-code     （npm 全局安装）');
  }
}

// ── 主流程 ──
async function main() {
  intro(pc.bold(pc.magenta('🌸 PowerClaude 安装向导')));

  // ── 平台提示 ──
  if (!IS_WINDOWS && !IS_MACOS) {
    log.warn('当前平台暂不支持终端配置。');
    log.info('Claude Code 主题配置仍可执行。');
  } else if (IS_MACOS) {
    log.info('检测到 macOS — Terminal.app + Claude Code 主题配置。');
  }

  if (IS_WINDOWS) {
    // ── 前置检查：Claude Code CLI（native / npm / path 三类来源）──
    const installation = detectWindowsClaudeCli();
    if (!installation) {
      printInstallGuidance();
      process.exit(1);
    }
    log.success(`已检测到 Claude Code: ${installation.executablePath}（${SOURCE_LABELS[installation.source]}）`);

    // ── 检查是否已安装 ──
    if (isPowerClaudeInstalled()) {
      log.info('PowerClaude 已安装，将更新配置。');
    }

    // ── 备份（一律备份，不询问）──
    const s1 = spinner();
    s1.start('备份中...');
    const backupPath = backupWindowsTerminal();
    s1.stop(`已备份至: ${backupPath}`);

    // ── 安装核心配置 ──
    const s2 = spinner();
    s2.start('安装 PowerClaude 核心配置...');
    try {
      installPowerClaudeCore(installation);
      s2.stop('PowerClaude 核心配置已安装 ✅');
    } catch (e) {
      s2.stop('安装失败 ❌');
      log.error(String(e));
      process.exit(1);
    }
  } else {
    // macOS / 其他平台：前置检查（沿用 macOS 探测，posix 路径在其他平台同样适用）
    if (!isClaudeInstalledMacOS()) {
      printInstallGuidance();
      process.exit(1);
    }
    log.success('已检测到 Claude Code: claude');

    if (IS_MACOS) {
      // ── 检查是否已安装 ──
      if (isPowerClaudeInstalledMacOS()) {
        log.info('PowerClaude 已安装，将更新配置。');
      }

      // ── 备份（一律备份，不询问）──
      const s1 = spinner();
      s1.start('备份 Terminal.app 偏好设置...');
      const info = backupMacOSTerminal();
      s1.stop(`已备份至: ${info.path}`);

      // ── 安装核心配置 ──
      const s2 = spinner();
      s2.start('安装 PowerClaude 核心配置（Terminal.app + Sakura Pink）...');
      try {
        installPowerClaudeMacOS();
        s2.stop('PowerClaude 核心配置已安装 ✅');
      } catch (e) {
        s2.stop('安装失败 ❌');
        log.error(String(e));
        process.exit(1);
      }
    }
  }

  // ── 询问主题安装 ──
  // 只要应用主题，可装终端的平台必须终端 + Claude Code 一起装，否则没有意义。
  const applyTheme = await confirm({
    message: '是否应用 Sakura Pink 樱花粉主题？',
    initialValue: true,
  });
  if (isCancel(applyTheme)) process.exit(0);

  const installClaude = applyTheme;
  const installTerminal = applyTheme && (IS_WINDOWS || IS_MACOS);

  // ── 执行安装 ──
  if (installTerminal) {
    if (IS_WINDOWS) {
      const s = spinner();
      s.start('应用 Windows Terminal 主题...');
      try {
        applyWindowsTerminalTheme();
        s.stop('🌸 Windows Terminal 主题已应用');
      } catch (e) {
        s.stop('应用失败 ❌');
        log.error(String(e));
      }
    } else if (IS_MACOS) {
      const s = spinner();
      s.start('应用 Terminal.app Sakura Pink 主题...');
      try {
        applyTerminalThemeMacOS();
        s.stop('🌸 Terminal.app 主题已应用');
      } catch (e) {
        s.stop('应用失败 ❌');
        log.error(String(e));
      }
    }
  }

  if (installClaude) {
    const s = spinner();
    s.start('应用 Claude Code 主题...');
    try {
      applyClaudeTheme();
      s.stop('🎨 Claude Code 主题已应用');
    } catch (e) {
      s.stop('应用失败 ❌');
      log.error(String(e));
    }
  }

  // ── 完成 ──
  outro(pc.bold(pc.magenta('✨ PowerClaude 安装完成！')));

  const summary: string[] = [];
  if (IS_WINDOWS) {
    summary.push('  🚀 默认终端: PowerClaude');
    summary.push('  📋 Ctrl+Tab 切换标签（最近使用优先）');
  } else if (IS_MACOS) {
    summary.push('  🚀 Terminal.app 默认配置: PowerClaude');
    summary.push('  ⌨️  新建终端窗口即启动 Claude Code');
  }

  const termName = IS_MACOS ? 'Terminal.app' : 'Windows Terminal';
  if (installTerminal) summary.push(`  🌸 ${termName}: Sakura Pink`);
  if (installClaude) summary.push('  🎨 Claude Code: Sakura Pink（基于 light）');
  if (installTerminal && IS_WINDOWS && getPowerClaudeBackground() !== null) {
    summary.push('  🖼️ Windows Terminal 背景图: 已启用');
  }
  if (installTerminal && IS_MACOS && getPowerClaudeBackground() !== null) {
    summary.push('  🖼️ Terminal.app 背景图: 已启用');
  }
  if (summary.length > 0) {
    log.info(summary.join('\n'));
  }

  if (IS_MACOS) {
    log.step('关闭所有 Terminal.app 窗口后重新打开即可体验');
    log.step('在 Claude Code 中使用 /theme 切换主题');
  } else {
    log.step('打开 Windows Terminal 即可体验，或在 Claude Code 中使用 /theme 切换主题');
  }
}

main().catch(console.error);
