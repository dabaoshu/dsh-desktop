# autocad-ai（Phase 0 脚手架）

DSH / Cordis 插件脚手架，插件条目 **id = `autocad-ai`**。本阶段只注册一个 echo 工具 `autocad_ai_echo`，用于证明包可安装、可挂进 Profile、工具面可达。

**本阶段不做：** AutoCAD COM/.NET、本机 MCP sidecar、OCCT 预览、物料单解析、登录/鉴权。相关接缝只在 `index.js` 以 hook 注释保留。

勿占用 `dsh-cad` 或 npm 裸名 `dsh-pilot`。

## 安装路径（优先：本地 `dsh plugin add`）

本包**不**写入 Desktop 内置 `build/dsh-desktop.patch.yml`，也不作为根 `package.json` 的生产依赖注入安装包闭包。开发与验收请走本地安装。

### 1. 打包

在仓库根目录：

```sh
npm pack ./packages/autocad-ai --pack-destination /tmp
```

会得到类似 `/tmp/autocad-ai-0.0.1.tgz` 的产物。也可用目录路径直接安装（见下）。

### 2. 安装到 Desktop 使用的 Profile

DSH Desktop 默认 Profile 为 `web`（`$DSH_HOME` 在 `{userData}/harness` 下，与 CLI 的 `~/.dsh` 不同）。先确认实际 `DSH_HOME` / Profile，再执行：

```sh
# 用绝对路径安装目录（开发 worktree）
dsh plugin --profile web add /absolute/path/to/dsh-desktop/packages/autocad-ai

# 或安装打包产物
dsh plugin --profile web add /tmp/autocad-ai-0.0.1.tgz
```

若 Desktop 内嵌的 CLI 入口不同，以本机 `dsh plugin --help` 为准；安装成功后按宿主提示重启 Harness，再在「设置 → 插件」确认 `autocad-ai` 可见并可启停。

### 3. 冒烟

Harness 就绪后，在对话中让模型调用 `autocad_ai_echo`（参数 `message`），应得到原样回显及 `plugin: "autocad-ai"`。这只证明插件加载与工具注册；**不等于** AutoCAD / MCP 已接通。

## 可选：经 Desktop patch 注入（本 PR 未启用）

若日后要把本包做成安装包内置能力，需要**同时**完成（缺一会导致 Profile 找不到包）：

1. 根 `package.json` 增加 `"autocad-ai": "file:packages/autocad-ai"`；
2. `@deepseek-ai/dsh` 的 patch-package 闭包注入同名依赖；
3. 在 `build/dsh-desktop.patch.yml`（及 Safe Mode 对应文件，若需要）增加 `insert` 行。

Phase 0 验收优先走上一节的本地 `dsh plugin add`，避免与登录 PR、内置闭包改动纠缠。

## 包契约摘要

| 项 | 值 |
| --- | --- |
| npm `name` | `autocad-ai` |
| 插件 `id` | `autocad-ai`（`cordis.patch.yml`） |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| 服务端入口 | `index.js`（`main` / `exports["."]`） |
| 工具 | `autocad_ai_echo` |

## 验证

```sh
npm test -- test/autocad-ai-scaffold.test.ts
```
