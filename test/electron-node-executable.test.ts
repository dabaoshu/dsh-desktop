import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { electronNodeExecutable } from '../src/main/runtime/electron-node-executable'

describe('electronNodeExecutable', () => {
  it('uses the app Helper on macOS', () => {
    expect(electronNodeExecutable('/Applications/autoCad AI.app/Contents/MacOS/autoCad AI', 'darwin'))
      .toBe('/Applications/autoCad AI.app/Contents/Frameworks/autoCad AI Helper.app/Contents/MacOS/autoCad AI Helper')
  })

  it('uses the main executable elsewhere', () => {
    expect(electronNodeExecutable('C:\\autoCad AI\\autoCad AI.exe', 'win32')).toBe('C:\\autoCad AI\\autoCad AI.exe')
    expect(electronNodeExecutable('/opt/dsh/dsh-desktop', 'linux')).toBe('/opt/dsh/dsh-desktop')
  })

  it('resolves an existing binary for the Electron build in use', () => {
    const electron = createRequire(import.meta.url)('electron') as string
    expect(existsSync(electronNodeExecutable(electron))).toBe(true)
  })
})
