# OCCT 在线预览（计划短链）

> **壳侧说明：** DSH Desktop / 本 fork 只负责托管 Harness 与插件加载；**不在 Desktop 内核实现 OCCT 运行时。**

## 产品边界

- **可交付 DWG 主路径：** CAD 插件 → 本机 MCP sidecar → AutoCAD（不经 OCCT）。
- **在线可视化辅路径：** 借鉴 [dsh-cad](https://github.com/LAU-MARS/dsh-cad) 的 OCCT 查看器，以 **独立 harness 插件**（勿占用上游 `id: dsh-cad`）挂到 Profile；用于对话/壳内预览与有限草图辅助。
- 公开 dsh-cad README：**DWG 不支持**。预览不得冒充可交付成果。

## Phase

| 阶段 | Desktop / 壳 | 预览插件 |
|------|--------------|----------|
| Phase 0 | 能 `plugin add` / 加载 web 插件即可；**不要求** OCCT | 不做运行时 |
| Phase 1+ | 保持宿主 peer / 客户端槽位兼容 | 独立预览包（查看器优先，全量建模后置） |

## 详细预研

完整集成路径、与 MCP 边界、体积与 LGPL（`occt.ts` / OCCT）风险见 Project 文档：

- `docs/occt-preview-integration.md`（autoCad AI Project store）
- 对照：`product-plan.md`、`reference-dsh-cad-pilot.md`

## 不做清单（本仓）

- 不把 `occt.ts` / cadorange WASM 打进 Desktop `src/` 或默认安装闭包
- 不以 OCCT 导出替代 AutoCAD 落盘验收
- 不在本文件承诺未见 API 或安装包增量实测
