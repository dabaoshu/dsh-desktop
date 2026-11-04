import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { projectRoot } from './patch-path'

const packageRoot = path.join(projectRoot, 'packages', 'autocad-ai')

describe('autocad-ai Phase 0 scaffold', () => {
  it('declares dsh.bundle.patch and installable package metadata', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, 'package.json'), 'utf8')
    ) as {
      name: string
      main: string
      private?: boolean
      exports: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
      peerDependencies?: Record<string, string>
    }

    expect(manifest.name).toBe('autocad-ai')
    expect(manifest.main).toBe('./index.js')
    expect(manifest.private).toBe(true)
    expect(manifest.exports['.']).toBe('./index.js')
    expect(manifest.exports['./cordis.patch.yml']).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.peerDependencies?.['@deepseek-ai/dsh-tools']).toBeTruthy()
    expect(manifest.peerDependencies?.['@deepseek-ai/cordis']).toBeTruthy()
  })

  it('inserts plugin id autocad-ai with matching package name', async () => {
    const patch = parseYaml(
      await readFile(path.join(packageRoot, 'cordis.patch.yml'), 'utf8')
    ) as { insert?: { id?: string; name?: string }[] }[]

    const rows = patch.flatMap((entry) => entry.insert ?? [])
    expect(rows).toEqual([{ id: 'autocad-ai', name: 'autocad-ai' }])
  })

  it('registers an echo tool without AutoCAD or MCP side effects', async () => {
    const mod = await import(pathToFileURL(path.join(packageRoot, 'index.js')).href) as {
      name: string
      inject: string[]
      echoTool: (ctx: unknown) => {
        name: string
        execute: (args: { message: string }) => Promise<{ message: string; plugin: string }>
      }
      apply: (ctx: {
        logger?: { info?: (...args: unknown[]) => void }
        tools: { register: (tool: unknown) => void }
      }) => void
    }

    expect(mod.name).toBe('autocad-ai')
    expect(mod.inject).toEqual(['tools'])

    const tool = mod.echoTool({})
    expect(tool.name).toBe('autocad_ai_echo')
    await expect(tool.execute({ message: 'ping' })).resolves.toEqual({
      message: 'ping',
      plugin: 'autocad-ai',
    })

    const registered: unknown[] = []
    mod.apply({
      logger: { info() {} },
      tools: { register: (tool) => { registered.push(tool) } },
    })
    expect(registered).toHaveLength(1)
    expect((registered[0] as { name: string }).name).toBe('autocad_ai_echo')
  })

  it('is not wired into the Desktop built-in profile patch (local install path)', async () => {
    const profilePatch = await readFile(
      path.join(projectRoot, 'build', 'dsh-desktop.patch.yml'),
      'utf8'
    )
    const rootManifest = JSON.parse(
      await readFile(path.join(projectRoot, 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> }

    expect(profilePatch).not.toMatch(/\bautocad-ai\b/u)
    expect(rootManifest.dependencies['autocad-ai']).toBeUndefined()
  })
})
