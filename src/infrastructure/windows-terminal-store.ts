// 基础设施：Windows Terminal settings.json 的定位、读写与备份（唯一触碰该文件的地方）
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import {
  type TerminalSettings,
  windowsTerminalSettingsCandidates,
  resolveWindowsTerminalSettingsPath,
} from '../domain/windows-terminal-settings.js';

export function getWindowsTerminalSettingsPath(): string {
  if (platform() !== 'win32') {
    // macOS / Linux 无 Windows Terminal 配置
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
