/**
 * MCP stdio 帧编解码（Content-Length）。
 *
 * 与 `@modelcontextprotocol/client` / `dsh-mcp-client` 的 stdio transport 对齐的
 * 最小实现；不引入 SDK 依赖，便于 Phase 0 脚手架与后续 .NET 替换。
 *
 * @module mcp-sidecar/protocol
 */

/**
 * @param {unknown} value
 * @returns {Buffer}
 */
export function encodeMessage(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8')
  return Buffer.concat([header, body])
}

/**
 * 从字节流中解析 Content-Length 帧。
 *
 * @param {(message: unknown) => void} onMessage
 * @returns {{ push: (chunk: Buffer | string) => void, reset: () => void }}
 */
export function createFramedReader(onMessage) {
  /** @type {Buffer} */
  let buffer = Buffer.alloc(0)

  /**
   * @param {Buffer | string} chunk
   */
  function push(chunk) {
    buffer = Buffer.concat([
      buffer,
      typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk,
    ])

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd < 0) return

      const headerText = buffer.subarray(0, headerEnd).toString('utf8')
      const match = /Content-Length:\s*(\d+)/i.exec(headerText)
      if (!match) {
        throw new Error(`mcp-sidecar: missing Content-Length in header: ${headerText}`)
      }

      const length = Number(match[1])
      if (!Number.isFinite(length) || length < 0) {
        throw new Error(`mcp-sidecar: invalid Content-Length: ${match[1]}`)
      }

      const bodyStart = headerEnd + 4
      const bodyEnd = bodyStart + length
      if (buffer.length < bodyEnd) return

      const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8')
      buffer = buffer.subarray(bodyEnd)

      let parsed
      try {
        parsed = JSON.parse(body)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`mcp-sidecar: invalid JSON body: ${reason}`)
      }
      onMessage(parsed)
    }
  }

  function reset() {
    buffer = Buffer.alloc(0)
  }

  return { push, reset }
}
