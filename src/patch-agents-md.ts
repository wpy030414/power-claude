// 二进制补丁：CLAUDE.md → AGENTS.md（5 组等长替换，offset 不变，纯 Node.js 零依赖）
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// 5 组等长替换——最长优先，避免 CLAUDE_MD 误匹配 CLAUDE_MDS 的前 9 字节
export const REPLACEMENTS: ReadonlyArray<readonly [Buffer, Buffer]> = [
  [Buffer.from('CLAUDE_MDS'), Buffer.from('AGENTS_MDS')], // 10→10
  [Buffer.from('CLAUDE.md'), Buffer.from('AGENTS.md')],   // 9→9
  [Buffer.from('claude.md'), Buffer.from('agents.md')],   // 9→9
  [Buffer.from('CLAUDE_MD'), Buffer.from('AGENTS_MD')],   // 9→9
  [Buffer.from('claudeMd'), Buffer.from('agentsMd')],     // 8→8
];

// 实体二进制的最小体积阈值（真实的 claude 单文件可执行约 200+ MB；shim/脚本远小于此）
const MIN_BINARY_SIZE = 10_000_000;

/**
 * 跨平台定位 claude 实体二进制（可用于 patch 的目标）。
 * 优先 npm 全局安装路径（bin/claude.exe 实体），其次官方原生安装落点；
 * 体积小于阈值的（.cmd/.ps1/shell shim）一律排除。
 */
export function findClaudeBinary(): string | null {
  const home = homedir();
  const candidates: string[] = [];
  if (platform() === 'win32') {
    if (process.env.APPDATA) {
      candidates.push(
        join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
      );
    }
    candidates.push(join(home, '.local', 'bin', 'claude.exe'));
  } else {
    // npm 全局前缀无法静默探测，覆盖常见三种布局 + 官方原生落点
    candidates.push(
      join(home, '.local', 'bin', 'claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      join(home, '.npm-global', 'bin', 'claude'),
    );
  }
  for (const c of candidates) {
    try {
      if (existsSync(c) && statSync(c).size >= MIN_BINARY_SIZE) return c;
    } catch {
      // stat 失败（权限等）视为不可用
    }
  }
  return null;
}

/** 检查 claude 进程是否存活（Windows: tasklist；macOS/Linux: ps） */
export function isClaudeProcessRunning(): boolean {
  try {
    if (platform() === 'win32') {
      const out = execSync('tasklist /FI "IMAGENAME eq claude.exe" /FO CSV /NH', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10_000,
      });
      return out.toLowerCase().includes('claude.exe');
    }
    const out = execSync('ps -ax -o comm= | grep -E "(^|/)claude$" | grep -v grep', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    });
    return out.trim().length > 0;
  } catch {
    // tasklist 无匹配时 Windows 返回非零——视为无进程
    return false;
  }
}

/** 强杀所有 claude 进程（Windows: taskkill /F；macOS/Linux: pkill） */
export function killAllClaudeProcesses(): void {
  try {
    if (platform() === 'win32') {
      execSync('taskkill /F /IM claude.exe', { stdio: 'ignore', timeout: 15_000 });
    } else {
      execSync('pkill -f claude', { stdio: 'ignore', timeout: 15_000 });
    }
  } catch {
    // 无进程可杀 / 权限不足——忽略
  }
}

/**
 * 核心：对二进制做 5 组等长替换并写回。
 * 返回命中总数；0 表示已经是 patched 状态（或本来就没有匹配）。
 * 文件被占用（EBUSY/EPERM）时抛出，由上层转译为可读错误。
 */
export function patchAgentsMdBinary(binaryPath: string): number {
  const data = readFileSync(binaryPath);
  const buf = Buffer.from(data);
  let count = 0;
  for (const [needle, replacement] of REPLACEMENTS) {
    let offset = 0;
    for (;;) {
      const idx = buf.indexOf(needle, offset);
      if (idx === -1) break;
      // 双确认：该位置仍是目标字节（未被前序替换改动）
      if (buf.subarray(idx, idx + needle.length).equals(needle)) {
        replacement.copy(buf, idx);
        count++;
      }
      offset = idx + needle.length;
    }
  }
  if (count > 0) writeFileSync(binaryPath, buf);
  return count;
}
