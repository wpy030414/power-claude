// 应用层：Windows 安装链路编排
// 组合领域纯逻辑（探测 / settings 变换）与基础设施适配器（环境 / 文件读写），
// 向向导暴露「检测 → 已安装检查 → 备份 → 核心安装 → 主题应用」的步骤级 API。
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { detectClaudeInstallation, type ClaudeInstallation } from '../domain/claude-installation.js';
import { upsertPowerClaudeProfile, applySakuraPinkTheme } from '../domain/windows-terminal-settings.js';
import { createPowerClaudeProfile, getPowerClaudeBackground, POWER_CLAUDE_GUID } from '../theme.js';
import { currentDetectionEnvironment } from '../infrastructure/node-system.js';
import {
  readWindowsTerminalSettings,
  writeWindowsTerminalSettings,
  backupWindowsTerminalSettings,
} from '../infrastructure/windows-terminal-store.js';

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
