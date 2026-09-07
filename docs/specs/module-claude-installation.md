# Spec — CLI 探测领域服务（src/claude-installation.ts）

## 要构建什么

- 目标：跨安装源探测 Claude Code CLI 的可执行文件路径，覆盖官方原生安装（irm / curl）、npm 全局安装与仅 PATH 可解析三类来源；纯逻辑、环境全注入、不启动 claude 进程。

## 行为

- 预期行为（`detectClaudeInstallation(env)`）：
  1. 候选路径：Windows 依次为 `~/.local/bin/claude.exe`（native）→ `%APPDATA%/npm/` 下包内 exe → `claude.cmd` → `claude.ps1`（npm）；macOS / Linux 为 `~/.local/bin/claude`（native）
  2. PATH 扫描：按 PATHEXT 顺序匹配 `claude<ext>`，末尾追加无扩展名兜底（Git Bash shim）；命中来源记为 `path`
  3. 全部未命中返回 `null`
- 返回结构化结果 `{ executablePath, source }`（source ∈ `native | npm | path`）：向导用来展示来源标签，Windows 安装链路复用路径作为 profile 图标

## 输入 / 输出

- 输入：`DetectionEnvironment`（platform / homeDir / appDataDir / PATH 原始值 / PATHEXT 拆分 / exists 谓词），由 `node-system.ts` 从真实进程环境组装
- 输出：`ClaudeInstallation | null`

## 约束

- 不 import fs / os / process：一切环境信息经注入获得
- 路径分隔符跟随目标平台（env.platform），与宿主运行平台无关
- 候选路径优先于 PATH 扫描；PATHEXT 按给定顺序匹配
- 不执行 claude 进程（无 `--version` 探活），探测无副作用

## 边界条件

- PATH 含空段或带引号条目：跳过或去引号，不报错
- `appDataDir` 缺失：跳过 npm 候选，其余照常
- PATHEXT 为空（类 Unix 平台）：仅匹配无扩展名 `claude`

## 验收标准

- [x] irm 原生安装的机器探测返回 native + `~/.local/bin/claude.exe`（真机只读探针已验证）
- [x] npm 三类落点（包内 exe / cmd / ps1）各自探测为 npm
- [x] 仅 PATH 可解析时探测为 path；无任何痕迹时返回 null

## 完成定义

- 真机验证：native / npm / path / 未安装四种场景
