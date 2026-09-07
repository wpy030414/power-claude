// 领域：Claude Code CLI 安装探测（纯逻辑）
// 不直接触碰文件系统 / 环境变量，全部经由 DetectionEnvironment 注入，保证可测试性。
import { win32, posix } from 'node:path';

// ── 类型 ──

/** 安装来源：native = 官方 irm/curl 原生安装；npm = npm 全局安装；path = 仅 PATH 可解析 */
export type ClaudeInstallSource = 'native' | 'npm' | 'path';

export interface ClaudeInstallation {
  executablePath: string;
  source: ClaudeInstallSource;
}

export interface DetectionEnvironment {
  platform: string;
  homeDir: string;
  /** %APPDATA%（Roaming）；仅 Windows 的 npm 候选需要，缺省时跳过 npm 候选 */
  appDataDir?: string | undefined;
  /** PATH 原始值（未拆分） */
  pathValue: string;
  /** 可执行扩展名列表（Windows 取 PATHEXT 拆分结果；类 Unix 传 []） */
  pathExts: string[];
  exists: (path: string) => boolean;
}

// ── 内部：按平台选路径 API（darwin/linux 用正斜杠，与宿主运行平台无关）──
function pathApiFor(platform: string) {
  return platform === 'win32' ? win32 : posix;
}

// ── 内部：已知安装源的候选路径（优先级从上到下）──
function candidatePaths(env: DetectionEnvironment): Array<{ path: string; source: ClaudeInstallSource }> {
  const p = pathApiFor(env.platform);
  if (env.platform === 'win32') {
    const candidates: Array<{ path: string; source: ClaudeInstallSource }> = [
      // 官方原生安装（irm https://claude.ai/install.ps1 | iex）
      { path: p.join(env.homeDir, '.local', 'bin', 'claude.exe'), source: 'native' },
    ];
    if (env.appDataDir) {
      candidates.push(
        // npm 全局安装：包内 exe → cmd shim → ps1 shim
        { path: p.join(env.appDataDir, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'), source: 'npm' },
        { path: p.join(env.appDataDir, 'npm', 'claude.cmd'), source: 'npm' },
        { path: p.join(env.appDataDir, 'npm', 'claude.ps1'), source: 'npm' },
      );
    }
    return candidates;
  }
  // macOS / Linux：官方原生安装落点
  return [{ path: p.join(env.homeDir, '.local', 'bin', 'claude'), source: 'native' }];
}

// ── 内部：规范化扩展名（小写、带点、去重），末尾追加无扩展名兜底（Git Bash shim）──
function normalizeExts(pathExts: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of pathExts) {
    if (!raw) continue;
    const ext = raw.startsWith('.') ? raw.toLowerCase() : `.${raw.toLowerCase()}`;
    seen.add(ext);
  }
  seen.add('');
  return [...seen];
}

// ── 内部：PATH 扫描 ──
function findOnPath(env: DetectionEnvironment): string | null {
  const p = pathApiFor(env.platform);
  const separator = env.platform === 'win32' ? ';' : ':';
  const exts = normalizeExts(env.pathExts);
  for (const rawDir of env.pathValue.split(separator)) {
    // 跳过空段；容忍带引号的 PATH 条目
    const dir = rawDir.replace(/^"|"$/g, '');
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = p.join(dir, `claude${ext}`);
      if (env.exists(candidate)) return candidate;
    }
  }
  return null;
}

// ── 探测入口：候选路径优先，PATH 扫描兜底 ──
export function detectClaudeInstallation(env: DetectionEnvironment): ClaudeInstallation | null {
  for (const candidate of candidatePaths(env)) {
    if (env.exists(candidate.path)) {
      return { executablePath: candidate.path, source: candidate.source };
    }
  }
  const onPath = findOnPath(env);
  if (onPath) return { executablePath: onPath, source: 'path' };
  return null;
}
