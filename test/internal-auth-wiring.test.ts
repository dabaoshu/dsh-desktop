import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

/**
 * 源码契约：门闩骨架接缝仍挂在 main / preload / shared，避免被误删。
 */
describe('internal auth wiring', () => {
  it('keeps enterprise modules and preload dialog entry points', () => {
    const mainIndex = readFileSync(join(root, 'src/main/index.ts'), 'utf8')
    expect(mainIndex).toContain("from './enterprise'")
    expect(mainIndex).toContain('registerInternalAuthIpc')
    expect(mainIndex).toContain("assertCapability('cloudUpdates')")
    expect(mainIndex).toContain("'internal-auth'")

    const preload = readFileSync(join(root, 'src/preload/index.ts'), 'utf8')
    expect(preload).toContain('mountInternalAuthUi')
    expect(preload).toContain('getInternalAuthStatus')

    const updateManager = readFileSync(join(root, 'src/main/update/update-manager.ts'), 'utf8')
    expect(updateManager).toContain('assertCloudUpdates')

    const shared = readFileSync(join(root, 'src/shared/internal-auth.ts'), 'utf8')
    expect(shared).toContain('cloudVersion')
    expect(shared).toContain('TODO')
  })
})
