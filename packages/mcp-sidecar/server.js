/**
 * Phase 0 MCP 请求处理：initialize / tools/list / tools/call。
 *
 * 只暴露 `autocad_ping`；不连接 AutoCAD，不发起网络请求。
 *
 * @module mcp-sidecar/server
 */

/** @typedef {{ jsonrpc: '2.0', id?: string | number | null, method?: string, params?: unknown, result?: unknown, error?: { code: number, message: string, data?: unknown } }} JsonRpcMessage */

export const SERVER_INFO = Object.freeze({
  name: 'mcp-sidecar',
  version: '0.0.1',
})

export const PROTOCOL_VERSION = '2024-11-05'

/**
 * 唯一 Phase 0 tool：本机可达性探测（不连 AutoCAD）。
 */
export const TOOL_AUTOCAD_PING = Object.freeze({
  name: 'autocad_ping',
  description:
    'Phase 0 local MCP sidecar liveness probe. Returns ok without contacting AutoCAD. Production will replace this process with a .NET/COM sidecar.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      message: {
        type: 'string',
        description: 'Optional note echoed in the response.',
      },
    },
  },
})

/**
 * @returns {{ tools: typeof TOOL_AUTOCAD_PING[] }}
 */
export function listTools() {
  return { tools: [TOOL_AUTOCAD_PING] }
}

/**
 * 执行 `autocad_ping`（或拒绝未知 tool）。
 *
 * @param {string} name
 * @param {unknown} args
 * @returns {{ content: { type: 'text', text: string }[], isError?: boolean }}
 */
export function callTool(name, args) {
  if (name !== 'autocad_ping') {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    }
  }

  const message =
    args && typeof args === 'object' && typeof /** @type {{ message?: unknown }} */ (args).message === 'string'
      ? /** @type {{ message: string }} */ (args).message
      : ''

  const payload = {
    ok: true,
    tool: 'autocad_ping',
    server: SERVER_INFO.name,
    version: SERVER_INFO.version,
    autocadConnected: false,
    note: 'Phase 0 Node stdio scaffold — replace with .NET/COM AutoCAD automation for production.',
    message,
    at: new Date().toISOString(),
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  }
}

/**
 * @param {unknown} error
 * @returns {{ code: number, message: string }}
 */
function toRpcError(error) {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const coded = /** @type {{ code: unknown, message: unknown }} */ (error)
    return {
      code: typeof coded.code === 'number' ? coded.code : -32603,
      message: typeof coded.message === 'string' ? coded.message : 'Internal error',
    }
  }
  return {
    code: -32603,
    message: error instanceof Error ? error.message : String(error),
  }
}

/**
 * 处理一条 JSON-RPC 请求；通知（无 id）返回 `null`。
 *
 * @param {JsonRpcMessage} message
 * @returns {JsonRpcMessage | null}
 */
export function handleJsonRpcRequest(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id: message?.id ?? null,
      error: { code: -32600, message: 'Invalid Request' },
    }
  }

  const { id, method, params } = message
  const isNotification = id === undefined

  try {
    /** @type {unknown} */
    let result

    switch (method) {
      case 'initialize': {
        result = {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        }
        break
      }
      case 'notifications/initialized':
      case 'initialized': {
        if (isNotification) return null
        result = {}
        break
      }
      case 'tools/list': {
        result = listTools()
        break
      }
      case 'tools/call': {
        const callParams = /** @type {{ name?: unknown, arguments?: unknown }} */ (params ?? {})
        const name = typeof callParams.name === 'string' ? callParams.name : ''
        result = callTool(name, callParams.arguments ?? {})
        break
      }
      case 'ping': {
        result = {}
        break
      }
      default: {
        if (isNotification) return null
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32601, message: `Method not found: ${method}` },
        }
      }
    }

    if (isNotification) return null
    return { jsonrpc: '2.0', id: id ?? null, result }
  } catch (error) {
    if (isNotification) return null
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: toRpcError(error),
    }
  }
}
