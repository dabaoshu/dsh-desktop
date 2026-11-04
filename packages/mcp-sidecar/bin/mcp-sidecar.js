#!/usr/bin/env node
/**
 * 本机 MCP sidecar stdio 入口。
 *
 * 用法：
 *   node packages/mcp-sidecar/bin/mcp-sidecar.js
 *   npm start --prefix packages/mcp-sidecar
 *
 * 日志写到 stderr；stdout 仅承载 Content-Length 帧，供 MCP 客户端消费。
 */

import { createFramedReader, encodeMessage } from '../protocol.js'
import { handleJsonRpcRequest } from '../server.js'

const reader = createFramedReader((message) => {
  const response = handleJsonRpcRequest(
    /** @type {{ jsonrpc: '2.0', id?: string | number | null, method?: string, params?: unknown }} */ (
      message
    )
  )
  if (response == null) return
  process.stdout.write(encodeMessage(response))
})

process.stdin.on('data', (chunk) => {
  try {
    reader.push(chunk)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    process.stderr.write(`mcp-sidecar: frame error: ${reason}\n`)
  }
})

process.stdin.on('end', () => {
  process.exit(0)
})

process.stdin.resume()
process.stderr.write('mcp-sidecar: listening on stdio (Phase 0 Node scaffold; no AutoCAD)\n')
