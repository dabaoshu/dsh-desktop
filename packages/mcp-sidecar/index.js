/**
 * Phase 0 本机 MCP sidecar 公共入口。
 *
 * 当前实现为 Node stdio MCP（不连 AutoCAD）。生产路径应以 Windows 上的
 * .NET / COM 自动化替换本进程，仍通过本机 stdio 或 loopback 暴露 MCP。
 *
 * @module mcp-sidecar
 */

export {
  SERVER_INFO,
  TOOL_AUTOCAD_PING,
  listTools,
  callTool,
  handleJsonRpcRequest,
} from './server.js'

export {
  encodeMessage,
  createFramedReader,
} from './protocol.js'
