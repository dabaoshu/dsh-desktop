import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  disabledCloudCapabilities,
  enabledCloudCapabilities,
  parseInternalAuthSignInRequest
} from '../src/shared/internal-auth'
import { loadInternalAuthConfig } from '../src/main/enterprise/auth-config'
import {
  AuthSessionStore,
  parseStoredSession,
  type SessionCrypto
} from '../src/main/enterprise/session-store'
import { MockAuthProvider } from '../src/main/enterprise/auth-provider'
import {
  InternalAuthService,
  cloudCapabilityDeniedMessage
} from '../src/main/enterprise/auth-service'

const roots: string[] = []

afterEach(() => {
  while (roots.length > 0) {
    const dir = roots.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'internal-auth-'))
  roots.push(dir)
  return dir
}

function memoryCrypto(): SessionCrypto & { available: boolean } {
  const keys = new Map<string, string>()
  return {
    available: true,
    isEncryptionAvailable() {
      return this.available
    },
    encryptString(plain: string): Buffer {
      const id = `enc:${keys.size}`
      keys.set(id, plain)
      return Buffer.from(id, 'utf8')
    },
    decryptString(encrypted: Buffer): string {
      const id = encrypted.toString('utf8')
      const plain = keys.get(id)
      if (plain === undefined) throw new Error('unknown ciphertext')
      return plain
    }
  }
}

describe('internal auth contracts', () => {
  it('parses sign-in requests and rejects garbage', () => {
    expect(parseInternalAuthSignInRequest({ username: ' alice ', password: 'x' })).toEqual({
      username: 'alice',
      password: 'x'
    })
    expect(() => parseInternalAuthSignInRequest({ username: ' ', password: 'x' })).toThrow(/Username/)
    expect(() => parseInternalAuthSignInRequest(null)).toThrow(/Invalid/)
  })

  it('exposes disabled cloud capabilities while signed out', () => {
    expect(disabledCloudCapabilities()).toEqual({ cloudVersion: false, cloudUpdates: false })
    expect(enabledCloudCapabilities()).toEqual({ cloudVersion: true, cloudUpdates: true })
  })

  it('loads mock config and ignores unknown provider names without inventing schema', () => {
    expect(loadInternalAuthConfig({})).toEqual({ provider: 'mock' })
    expect(
      loadInternalAuthConfig({
        AUTOCAD_AI_AUTH_PROVIDER: 'oidc',
        AUTOCAD_AI_AUTH_AUTHORITY_URL: 'https://idp.example.invalid/'
      })
    ).toEqual({
      provider: 'mock',
      authorityUrl: 'https://idp.example.invalid/'
    })
  })
})

describe('auth session store', () => {
  it('round-trips an encrypted session and clears it', async () => {
    const directory = tempDir()
    const crypto = memoryCrypto()
    const store = new AuthSessionStore({ directory, crypto })
    const session = {
      provider: 'mock' as const,
      accessToken: 'mock.token',
      accountId: 'mock:alice',
      displayName: 'alice',
      issuedAt: 1
    }
    await store.save(session)
    expect(readFileSync(store.filePath()).toString('utf8')).toMatch(/^enc:/)
    expect(await store.load()).toEqual(session)
    await store.clear()
    expect(await store.load()).toBeUndefined()
  })

  it('rejects invalid stored payloads', () => {
    expect(() => parseStoredSession({ provider: 'mock' })).toThrow(/token/)
  })
})

describe('internal auth service gate', () => {
  it('keeps the app usable while signed out and blocks cloud capabilities', async () => {
    const directory = tempDir()
    const crypto = memoryCrypto()
    const service = new InternalAuthService({
      config: { provider: 'mock' },
      store: new AuthSessionStore({ directory, crypto }),
      provider: new MockAuthProvider()
    })
    await service.initialize()
    expect(service.getStatus()).toMatchObject({
      signedIn: false,
      capabilities: { cloudVersion: false, cloudUpdates: false }
    })
    expect(() => service.assertCapability('cloudUpdates')).toThrow(
      cloudCapabilityDeniedMessage('cloudUpdates')
    )
    expect(() => service.assertCapability('cloudVersion')).toThrow(
      cloudCapabilityDeniedMessage('cloudVersion')
    )
  })

  it('mock sign-in enables cloud capability bits and persists without exposing token in status', async () => {
    const directory = tempDir()
    const crypto = memoryCrypto()
    const service = new InternalAuthService({
      config: { provider: 'mock' },
      store: new AuthSessionStore({ directory, crypto }),
      provider: new MockAuthProvider()
    })
    await service.initialize()
    const status = await service.signIn({ username: 'alice', password: 'secret' })
    expect(status.signedIn).toBe(true)
    expect(status.displayName).toBe('alice')
    expect(status.capabilities.cloudUpdates).toBe(true)
    expect(status.capabilities.cloudVersion).toBe(true)
    expect(JSON.stringify(status)).not.toMatch(/mock\./)
    expect(JSON.stringify(status)).not.toContain('secret')

    const restored = new InternalAuthService({
      config: { provider: 'mock' },
      store: new AuthSessionStore({ directory, crypto }),
      provider: new MockAuthProvider()
    })
    await restored.initialize()
    expect(restored.getStatus().signedIn).toBe(true)
    expect(restored.getStatus().accountId).toBe('mock:alice')

    await restored.signOut()
    expect(restored.getStatus().signedIn).toBe(false)
    expect(restored.isCapabilityAllowed('cloudVersion')).toBe(false)
  })

  it('keeps an in-memory session when OS encryption is unavailable', async () => {
    const directory = tempDir()
    const crypto = memoryCrypto()
    crypto.available = false
    const service = new InternalAuthService({
      config: { provider: 'mock' },
      store: new AuthSessionStore({ directory, crypto }),
      provider: new MockAuthProvider()
    })
    await service.initialize()
    const status = await service.signIn({ username: 'bob', password: 'pw' })
    expect(status.signedIn).toBe(true)
    expect(await new AuthSessionStore({ directory, crypto: memoryCrypto() }).load()).toBeUndefined()
  })
})
