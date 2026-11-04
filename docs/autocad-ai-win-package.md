# autoCad AI：Windows x64 打包验收说明

本文说明如何在 **Windows x64** 上对本 fork（[dabaoshu/dsh-desktop](https://github.com/dabaoshu/dsh-desktop)）做依赖安装、测试、类型检查与打包验收。脚本名以仓库根目录 `package.json` 与 [development.md](development.md) 为准；正式发版流程另见 [release-runbook.md](release-runbook.md)。

> Phase 0 目标是「在 Windows x64 上能按本文跑通打包命令，并确认 Safe Mode / 品牌隔离后的数据目录」——**不**要求本机已有 AutoCAD、真实内部登录 API 或自有更新源上线。

## 1. 环境前提

| 项 | 要求 |
| --- | --- |
| 操作系统 / 架构 | **Windows x64**（`win32` / `x64`） |
| Node.js | 22 或更高（见 [development.md](development.md) Prerequisites） |
| 包管理 | 仓库开发使用 **npm** 与 `package-lock.json`；勿另增竞争锁文件 |
| 机器角色 | `package:win` / `package:dev:win` **必须**在 Windows x64 本机或同架构 CI runner 上执行 |

Harness 基线见 `package.json` 钉死的 `@deepseek-ai/dsh` 版本（development.md 当前文档为 `0.2.2-alpha.2`）。Windows 包内 Harness 走 Electron Node mode；这与用来跑 `npm` 命令的本机 Node 版本无关。

## 2. 安装与日常检查

在仓库根目录（PowerShell 或 cmd）：

```powershell
git clone https://github.com/dabaoshu/dsh-desktop.git
cd dsh-desktop
npm ci
```

- 推荐 **`npm ci`**（与 [development.md](development.md) Local setup 一致）：会跑 `postinstall`（`patch-package`、品牌资源、Electron）。
- 若仅做本地试装且无完整锁文件对齐需求，可用 `npm install`；交付与 CI 仍以 `npm ci` + 锁文件为准，并确认 **postinstall 完整成功**。

提交前核心检查（development.md Validation）：

```powershell
npm test
npm run typecheck
npm run build
```

说明：

- `npm test` → `vitest run`；`pretest` 会先跑 `office:prepare` 与 `ppt:build`。
- `npm run typecheck` → `tsc --noEmit -p tsconfig.node.json`（覆盖配置与 `src/main`、`src/preload`、`src/shared`、TS 测试；插件 JS / 脚本 / HTML 不在其范围）。
- 静态检查不能替代启动、Profile、插件、打包等真实流程验收。

本地开发启动（不打包）：

```powershell
npm run dev
```

多 worktree 并行时，按 development.md 用独立目录名与端口，例如：

```powershell
$env:DSH_DEV_PROFILE="autocad-ai-dev-workbench"
$env:DSH_DEV_HARNESS_PORT="43132"
$env:DSH_DEV_MOBILE_PORT="43133"
npm run dev
```

（品牌隔离合入后，默认开发 Profile 目录名为 `autocad-ai-dev`，见下文 §4；未合入前上游默认为 `dsh-desktop-dev`。）

## 3. Windows x64 打包命令

| 场景 | 命令 | 产物方向 |
| --- | --- | --- |
| 本地未签名开发包 | `npm run package:dev:win` | `electron-builder.dev.cjs`，输出目录 `dist-dev` |
| 正式目标 NSIS 安装包（本机未走签名发布流水线） | `npm run package:win` | 生产 electron-builder 配置，输出默认 `dist` |

二者均会：

1. 调用 `node scripts/verify-target.mjs win32 x64`
2. 执行 `npm run build`（含 `office:prepare`、`ppt:build`、`electron-vite build`）
3. 经 `node scripts/electron-builder-windows.mjs --win --x64 --publish never` 打包（开发包额外带 `--config electron-builder.dev.cjs`）

```powershell
# 日常 Phase 0 验收优先用开发包
npm run package:dev:win

# 或生产配置的 Windows x64 NSIS（仍须在 win32/x64 上）
npm run package:win
```

打包前可选探针（development.md Packaging；Windows CI 每构建会跑）：

```powershell
node scripts/probe-electron-node-runtime.mjs
```

该脚本用 Electron Node mode 从仓库启动 Harness（临时 `DSH_HOME`），并检查认证后的 HTTP 响应。

### 3.1 `verify-target` 限制（不可跨编）

`scripts/verify-target.mjs` 在宿主平台/架构与期望值不一致时 **直接失败**：

- `package:win` / `package:dev:win` 期望：`win32` + `x64`
- 在 macOS / Linux 或非 x64 Windows 上执行会报错并退出
- **不要**在 macOS/Linux 上直接调 `electron-builder --win` 来产出可分发的 Windows 包（development.md 明确拒绝）

通过后还会探测：当前 Electron 在 Node mode 下能否加载 Harness native loader；失败则包装停，需先对齐 Electron / loader，再谈打包。

### 3.2 打包后最低抽查

- 产物目录：`package:dev:win` → `dist-dev\`；`package:win` → `dist\`（以实际 electron-builder 输出为准）
- 安装或解压后启动一次；确认窗口标题 / 产品名为隔离后的品牌（§4）
- **Safe Mode** 仍可进入（仅加载安装包自带包；不依赖普通 Profile 的 `profiles/node_modules` fallback）
- 包内不应在 `app.asar.unpacked` 下出现独立 `node_modules/node`；Harness / 包管理命令走打包后的 Electron Node mode（见 development.md Packaging）
- 本地 `package:*` **不是**正式发版证据；签名、publication 与 installed-app smoke 走 [release-runbook.md](release-runbook.md)

## 4. 品牌隔离后的 productName / userData

依赖 [PR #1](https://github.com/dabaoshu/dsh-desktop/pull/1)（品牌与 userData 隔离）合入后的权威常量（`src/shared/brand.ts`）：

| 项 | 值 | 注意 |
| --- | --- | --- |
| 生产 `appId` | `ai.autocad.desktop` | 与上游 `io.dsh.desktop` 分离 |
| 开发 `appId` | `ai.autocad.desktop.dev` | 对应 `electron-builder.dev.cjs` |
| 生产 `productName` | `autoCad AI` | 安装包显示名 |
| 开发 `productName` | `autoCad AI Dev` | 开发包显示名 |
| 生产 userData 目录名 | `autocad-ai` | Windows 上约为 `%APPDATA%\autocad-ai` |
| 开发默认 userData / `DSH_DEV_PROFILE` | `autocad-ai-dev` | 约为 `%APPDATA%\autocad-ai-dev` |

验收时务必确认：

1. **不**写入上游 `%APPDATA%\dsh-desktop` / `dsh-desktop-dev`，避免污染正式版数据。
2. 启动前确认实际 `userData` / `DSH_HOME`；多 worktree 默认可能共享同一开发 Profile，勿并行改同一份数据。
3. 更新 feed 在 Phase 0 为占位（`.invalid`）且自动更新关闭；打包验收 **不要** 期望连上上游 dshdesktop.com 更新通道。
4. `DSH_DEV_PROFILE` 必须是合法目录名，且不得等于生产目录名 `autocad-ai`。

未合入 #1 时，本机仍可能看到上游 `DSH Desktop` / `dsh-desktop-dev`；此时以当前检出代码为准，合入后再按上表复验。

## 5. 与 PR #1–#4 的合入顺序建议

Phase 0 相关 PR（截至文档编写时多为 OPEN；以 GitHub 状态为准）：

| 顺序 | PR | 主题 | 建议 |
| --- | --- | --- | --- |
| 1 | [#1](https://github.com/dabaoshu/dsh-desktop/pull/1) | 品牌 / `userData` 隔离 | **最先合入 main**；后续身份与路径均依赖它 |
| 2 | [#3](https://github.com/dabaoshu/dsh-desktop/pull/3) | 内部登录门闩骨架 | 基于 #1 分支；#1 合入后改基到 `main` 再合 |
| 3 | [#2](https://github.com/dabaoshu/dsh-desktop/pull/2) | `autocad-ai` 插件脚手架 | 可与壳登录并行评审；与 #1 冲突面小，建议 #1 后合入 |
| 4 | [#4](https://github.com/dabaoshu/dsh-desktop/pull/4) | 本机 MCP sidecar 脚手架 | 叠在 #2 之上；先合 #2，再合 #4（或 #2 合入后把 #4 base 改回 `main`） |

**本文档 PR**（仅新增本文件）应对 `main` 独立合入，**不阻塞**也不依赖 #1–#4 的代码；但 **Windows 实机按 §4 验收品牌目录** 应在 #1 合入后执行。完整 Phase 0「壳 + 插件 + MCP + Win 包」联验建议在 #1→#3 与 #2→#4 两条线都进入 `main` 之后，在 Windows x64 上按 §2–§3 再跑一轮。

建议依赖关系简图：

```text
#1 品牌隔离 ──► #3 登录门闩
        │
        └──►（文档验收 §4）

#2 autocad-ai 插件 ──► #4 MCP sidecar

本文档 ──► main（可随时合；实机品牌验收等 #1）
```

## 6. Phase 0 简短验收清单

在 **Windows x64** 机器上勾选：

- [ ] `npm ci`（或已对齐锁文件的 `npm install`）且 postinstall 成功
- [ ] `npm run typecheck` 通过
- [ ] `npm test` 通过（或至少跑与本次改动相关的 vitest；完整 suite 含 office pretest）
- [ ] `npm run package:dev:win` **或** `npm run package:win` 成功（失败若为非 win32/x64，属预期）
- [ ] 未在 macOS/Linux 上「跨编」出正式 Windows 分发包
- [ ] 安装/启动后 `productName` / `%APPDATA%` 下目录符合 §4（#1 合入后）
- [ ] Safe Mode 可进入；未误用上游 `dsh-desktop` 数据目录
- [ ] （可选）`node scripts/probe-electron-node-runtime.mjs` 通过

**本阶段不冒充通过：** AutoCAD COM 真连接、远程 MCP、自有更新源上线、正式签名发布流水线、Office/PPT 全量保真。

## 7. 相关文档

- [development.md](development.md) — 本地开发、校验、`package:win` / `verify-target`
- [release-runbook.md](release-runbook.md) — 正式发版、签名、Windows smoke
- [architecture.md](architecture.md) — 进程与 Profile 边界
- 仓库 `AGENTS.md` — 启动目录 / Safe Mode / 加载链路验收要求
