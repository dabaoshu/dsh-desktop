import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { projectRoot } from './patch-path'

const packageRoot = path.join(projectRoot, 'packages', 'mcp-sidecar')

describe('mcp-sidecar Phase 0 scaffold', () => {
  it('declares a private stdio package with bin entry', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, 'package.json'), 'utf8')
    ) as {
      name: string
      private?: boolean
      bin?: Record<string, string>
      main?: string
      exports?: Record<string, string>
    }

    expect(manifest.name).toBe('mcp-sidecar')
    expect(manifest.private).toBe(true)
    expect(manifest.bin?.['mcp-sidecar']).toBe('./bin/mcp-sidecar.js')
    expect(manifest.main).toBe('./index.js')
    expect(manifest.exports?.['.']).toBe('./index.js')
  })

  it('exposes autocad_ping without claiming AutoCAD connectivity', async () => {
    const mod = await import(pathToFileURL(path.join(packageRoot, 'index.js')).href) as {
      TOOL_AUTOCAD_PING: { name: string }
      callTool: (
        name: string,
        args: unknown
      ) => { content: { type: string, text: string }[], isError?: boolean }
      handleJsonRpcRequest: (message: {
        jsonrpc: '2.0'
        id?: number
        method: string
        params?: unknown
      }) => { result?: unknown, error?: unknown } | null
    }

    expect(mod.TOOL_AUTOCAD_PING.name).toBe('autocad_ping')

    const listed = mod.handleJsonRpcRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
    expect(listed?.error).toBeUndefined()
    expect(listed?.result).toEqual({
      tools: [expect.objectContaining({ name: 'autocad_ping' })],
    })

    const called = mod.callTool('autocad_ping', { message: 'probe' })
    expect(called.isError).toBeUndefined()
    const payload = JSON.parse(called.content[0]?.text ?? '{}') as {
      ok: boolean
      autocadConnected: boolean
      message: string
      tool: string
    }
    expect(payload).toMatchObject({
      ok: true,
      autocadConnected: false,
      message: 'probe',
      tool: 'autocad_ping',
    })
  })

  it('speaks Content-Length framed stdio for initialize and tools/call', async () => {
    const entry = path.join(packageRoot, 'bin', 'mcp-sidecar.js')
    const { createFramedReader, encodeMessage } = await import(
      pathToFileURL(path.join(packageRoot, 'protocol.js')).href
    ) as {
      createFramedReader: (onMessage: (message: unknown) => void) => {
        push: (chunk: Buffer | string) => void
      }
      encodeMessage: (value: unknown) => Buffer
    }

    const child = spawn(process.execPath, [entry], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const responses: unknown[] = []
    const reader = createFramedReader((message) => {
      responses.push(message)
    })
    child.stdout?.on('data', (chunk: Buffer) => reader.push(chunk))

    const waitFor = async (index: number) => {
      const started = Date.now()
      while (responses.length <= index) {
        if (Date.now() - started > 5_000) {
          throw new Error(`timed out waiting for stdio response #${index}`)
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      return responses[index]
    }

    try {
      child.stdin?.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vitest', version: '0' },
          },
        })
      )
      const init = (await waitFor(0)) as {
        result?: { serverInfo?: { name?: string } }
      }
      expect(init.result?.serverInfo?.name).toBe('mcp-sidecar')

      child.stdin?.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'autocad_ping', arguments: {} },
        })
      )
      const call = (await waitFor(1)) as {
        result?: { content?: { text?: string }[] }
      }
      const payload = JSON.parse(call.result?.content?.[0]?.text ?? '{}') as {
        ok: boolean
        autocadConnected: boolean
      }
      expect(payload.ok).toBe(true)
      expect(payload.autocadConnected).toBe(false)
    } finally {
      child.stdin?.end()
      child.kill('SIGTERM')
    }
  })

  it('is not wired into Desktop built-in profile patch or root dependencies', async () => {
    const profilePatch = await readFile(
      path.join(projectRoot, 'build', 'dsh-desktop.patch.yml'),
      'utf8'
    )
    const rootManifest = JSON.parse(
      await readFile(path.join(projectRoot, 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> }

    expect(profilePatch).not.toMatch(/\bmcp-sidecar\b/u)
    expect(rootManifest.dependencies['mcp-sidecar']).toBeUndefined()
  })

  it('keeps a placeholder dsh-mcp-client stdio example without private APIs', async () => {
    const example = await readFile(
      path.join(packageRoot, 'examples', 'dsh-mcp-client.placeholder.yml'),
      'utf8'
    )
    expect(example).toMatch(/transport:\s*stdio/)
    expect(example).toMatch(/serverName:\s*autocad_local/)
    expect(example).toMatch(/mcp-sidecar\.js/)
    expect(example).toMatch(/@deepseek-ai\/dsh-mcp-client/)
  })
})
