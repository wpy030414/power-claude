// 基础设施：Node 环境适配器——把真实进程环境组装成领域层需要的 DetectionEnvironment
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import type { DetectionEnvironment } from './claude-installation.js';

// Windows PATHEXT 缺省值（环境变量缺失时的兜底）
const DEFAULT_WINDOWS_PATH_EXTS = ['.COM', '.EXE', '.BAT', '.CMD'];

export function currentDetectionEnvironment(): DetectionEnvironment {
  const rawPathExt = process.env.PATHEXT;
  const pathExts = rawPathExt
    ? rawPathExt.split(';').map(e => e.trim()).filter(Boolean)
    : platform() === 'win32'
      ? DEFAULT_WINDOWS_PATH_EXTS
      : [];

  return {
    platform: platform(),
    homeDir: homedir(),
    appDataDir: process.env.APPDATA,
    pathValue: process.env.PATH ?? '',
    pathExts,
    exists: existsSync,
  };
}
