#!/usr/bin/env node
/**
 * 对本包 stdio 入口做最小握手冒烟：initialize → tools/list → tools/call(autocad_ping)。
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFramedReader, encodeMessage } from '../protocol.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(root, '..', 'bin', 'mcp-sidecar.js')

const child = spawn(process.execPath, [entry], {
  stdio: ['pipe', 'pipe', 'inherit'],
})

/** @type {unknown[]} */
const responses = []

const reader = createFramedReader((message) => {
  responses.push(message)
})

child.stdout.on('data', (chunk) => reader.push(chunk))

/**
 * @param {object} message
 * @returns {Promise<unknown>}
 */
function request(message) {
  const before = responses.length
  child.stdin.write(encodeMessage(message))
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (responses.length > before) {
        clearInterval(timer)
        resolve(responses[before])
        return
      }
      if (Date.now() - started > 5_000) {
        clearInterval(timer)
        reject(new Error(`timeout waiting for response to ${message.method}`))
      }
    }, 10)
  })
}

try {
  const init = /** @type {{ result?: { serverInfo?: { name?: string } } }} */ (
    await request({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-sidecar-smoke', version: '0.0.1' },
      },
    })
  )
  if (init.result?.serverInfo?.name !== 'mcp-sidecar') {
    throw new Error(`unexpected initialize result: ${JSON.stringify(init)}`)
  }

  child.stdin.write(
    encodeMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })
  )

  const listed = /** @type {{ result?: { tools?: { name: string }[] } }} */ (
    await request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  )
  const names = (listed.result?.tools ?? []).map((tool) => tool.name)
  if (!names.includes('autocad_ping')) {
    throw new Error(`tools/list missing autocad_ping: ${JSON.stringify(listed)}`)
  }

  const called = /** @type {{ result?: { content?: { text?: string }[] } }} */ (
    await request({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'autocad_ping', arguments: { message: 'smoke' } },
    })
  )
  const text = called.result?.content?.[0]?.text ?? ''
  const payload = JSON.parse(text)
  if (payload.ok !== true || payload.autocadConnected !== false) {
    throw new Error(`unexpected tools/call payload: ${text}`)
  }

  process.stderr.write('mcp-sidecar smoke: ok\n')
  child.stdin.end()
  process.exitCode = 0
} catch (error) {
  process.stderr.write(`mcp-sidecar smoke failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
  child.kill('SIGTERM')
}
