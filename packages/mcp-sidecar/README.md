# mcp-sidecar（Phase 0 本机 MCP 脚手架）

autoCad AI 的**本机 MCP sidecar**最小骨架。当前用 **Node stdio** 实现一条探测 tool `autocad_ping`，**不连接 AutoCAD**。

> **生产替换说明：** 可交付 DWG 主路径要求 Windows 上的 **.NET / COM → AutoCAD**。本包仅供 Phase 0 在无 Windows/.NET 的环境证明「本机 MCP 能通一条」。上线时应用 .NET sidecar 替换本进程，仍走本机 stdio 或 loopback，**不以远程/云端 MCP 冒充**。

## 本机启动

需要 Node ≥ 20。在仓库根或包目录：

```sh
# 直接跑 stdio server（保持前台；stdout 是 MCP 帧，日志在 stderr）
node packages/mcp-sidecar/bin/mcp-sidecar.js

# 或
npm start --prefix packages/mcp-sidecar
```

自检（子进程握手 + `autocad_ping`）：

```sh
npm run ping-self --prefix packages/mcp-sidecar
# 或
node packages/mcp-sidecar/scripts/stdio-smoke.js
```

成功时 stderr 出现 `mcp-sidecar smoke: ok`。

### 用 MCP Inspector / 其它客户端（可选）

任何支持 stdio 的 MCP 客户端均可：

```text
command: node
args:    [<repo>/packages/mcp-sidecar/bin/mcp-sidecar.js]
```

调用 tool `autocad_ping`（可选参数 `message`）。期望 `ok: true` 且 `autocadConnected: false`。

## 将来如何被 `autocad-ai` 拉起（接口占位）

产品路径：`autocad-ai`（Cordis 插件）→ **本机 MCP sidecar** → AutoCAD。

钉死版 `@deepseek-ai/dsh-mcp-client@0.2.2-alpha.2` 已公开支持 stdio 配置（见该包 README）：

| 字段 | Phase 0 占位含义 |
| --- | --- |
| `transport: stdio` | 本机子进程，非远程 HTTP |
| `serverName` | 建议 `autocad_local`（工具公开名 `mcp__autocad_local__autocad_ping`） |
| `command` / `args` | 指向本包 `bin/mcp-sidecar.js`，或日后的 `.NET` 可执行文件 |
| `cwd` / `env` | 可选；生产 .NET 侧再补 AutoCAD 相关环境 |

完整 YAML 样例见 [`examples/dsh-mcp-client.placeholder.yml`](./examples/dsh-mcp-client.placeholder.yml)。

**本阶段明确不做（避免编造未见 API）：**

- 不在 `autocad-ai` 内调用未见的 harness 私有启动 API
- 不把本条目写入 `build/dsh-desktop.patch.yml` 或根生产依赖
- 不在此包内注册 Cordis `defineTool`（那是插件面；MCP tool 由 `dsh-mcp-client` 桥接进 `ctx.tools`）

插件侧 hook 注释见 `packages/autocad-ai/index.js`（指向本目录）。待 Profile / patch 接线时，按上表用公开 `dsh-mcp-client` 配置拉起即可。

## 包契约摘要

| 项 | 值 |
| --- | --- |
| npm `name` | `mcp-sidecar` |
| 入口 | `bin/mcp-sidecar.js`（stdio） |
| MCP tool | `autocad_ping` |
| 传输 | stdio（Content-Length 帧） |
| AutoCAD | 未连接（`autocadConnected: false`） |
| 内置 Desktop patch | **否** |

## 验证

```sh
node packages/mcp-sidecar/scripts/stdio-smoke.js
npx vitest run test/mcp-sidecar-scaffold.test.ts
```
