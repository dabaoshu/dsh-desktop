import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_ID,
  APP_ID_DEV,
  ARTIFACT_PREFIX,
  AUTO_UPDATES_ENABLED,
  DESKTOP_SERVICE_URL,
  PRODUCT_NAME,
  PRODUCT_NAME_DEV,
  STABLE_FEED_URL,
  USER_DATA_DIR,
  USER_DATA_DIR_DEV,
  VERSION_INDEX_URL,
  archiveFeedUrl
} from '../src/shared/brand'
import { developmentEnvironment } from '../src/main/development-environment'
import { supportsAutoUpdates } from '../src/main/update/update-policy'

const projectRoot = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

describe('autoCad AI brand isolation', () => {
  it('keeps Electron identity and userData off the upstream autoCad AI names', async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(projectRoot, 'package.json'), 'utf8')
    ) as {
      build: { appId: string; productName: string; artifactName: string; publish: unknown }
      license: string
    }
    const developmentConfig = require('../electron-builder.dev.cjs') as {
      appId: string
      productName: string
    }
    const identity = await readFile(path.join(projectRoot, 'src/main/index.ts'), 'utf8')
    const installer = await readFile(path.join(projectRoot, 'build/installer.nsh'), 'utf8')
    const license = await readFile(path.join(projectRoot, 'LICENSE'), 'utf8')

    expect(APP_ID).toBe('ai.autocad.desktop')
    expect(APP_ID_DEV).toBe('ai.autocad.desktop.dev')
    expect(PRODUCT_NAME).toBe('autoCad AI')
    expect(PRODUCT_NAME_DEV).toBe('autoCad AI Dev')
    expect(USER_DATA_DIR).toBe('autocad-ai')
    expect(USER_DATA_DIR_DEV).toBe('autocad-ai-dev')
    expect(ARTIFACT_PREFIX).toBe('autocad-ai')

    expect(packageJson.build.appId).toBe(APP_ID)
    expect(packageJson.build.productName).toBe(PRODUCT_NAME)
    expect(packageJson.build.artifactName.startsWith(`${ARTIFACT_PREFIX}-`)).toBe(true)
    expect(packageJson.build.publish).toBeNull()
    expect(packageJson.license).toBe('MIT')
    expect(developmentConfig.appId).toBe(APP_ID_DEV)
    expect(developmentConfig.productName).toBe(PRODUCT_NAME_DEV)

    expect(identity).toContain('USER_DATA_DIR')
    expect(identity).toContain('PRODUCT_NAME')
    expect(identity).not.toContain("join(app.getPath('appData'), 'dsh-desktop')")
    expect(identity).not.toContain("app.setName('autoCad AI')")
    expect(installer).toContain(`$APPDATA\\${USER_DATA_DIR}\\desktop-service\\session.json`)
    expect(installer).not.toContain('$APPDATA\\dsh-desktop\\')

    expect(developmentEnvironment(false, 43129).profile).toBe(USER_DATA_DIR)
    expect(developmentEnvironment(true, 43129, {}).profile).toBe(USER_DATA_DIR_DEV)
    expect(license).toContain('MIT License')
    expect(license).toContain('Copyright (c) 2026 DataElement')
  })

  it('does not point update or crash services at upstream dshdesktop.com', () => {
    expect(AUTO_UPDATES_ENABLED).toBe(false)
    expect(supportsAutoUpdates(true, 'darwin')).toBe(false)
    expect(STABLE_FEED_URL).toBe('https://updates.invalid/autocad-ai/latest/')
    expect(VERSION_INDEX_URL).toBe('https://updates.invalid/autocad-ai/versions.json')
    expect(archiveFeedUrl('1.2.3')).toBe('https://updates.invalid/autocad-ai/archive/1.2.3/')
    expect(DESKTOP_SERVICE_URL).toBe('https://updates.invalid/autocad-ai/service')
    for (const url of [STABLE_FEED_URL, VERSION_INDEX_URL, archiveFeedUrl('9.9.9'), DESKTOP_SERVICE_URL]) {
      expect(url).not.toContain('dshdesktop.com')
    }
  })
})
