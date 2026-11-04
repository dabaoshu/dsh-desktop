import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { InternalAuthProviderKind } from '../../shared/internal-auth'

/** 持久化的会话载荷；accessToken 仅存 main，经 OS 安全存储加密。 */
export interface StoredAuthSession {
  provider: InternalAuthProviderKind
  accessToken: string
  accountId: string
  displayName: string
  issuedAt: number
  expiresAt?: number
}

/** 加密后端：默认对接 Electron `safeStorage`。 */
export interface SessionCrypto {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface AuthSessionStoreOptions {
  /** 会话文件所在目录（通常为 userData）。 */
  directory: string
  crypto: SessionCrypto
  /** 可覆盖文件名，便于测试。 */
  fileName?: string
}

/**
 * 用 OS 密钥环加密后原子写入本地会话文件。
 * 加密不可用时拒绝落盘，仅允许调用方保留内存会话。
 */
export class AuthSessionStore {
  private readonly path: string
  private readonly crypto: SessionCrypto

  /**
   * @param options 目录与加密后端
   */
  constructor(options: AuthSessionStoreOptions) {
    this.path = join(options.directory, options.fileName ?? 'internal-auth-session.bin')
    this.crypto = options.crypto
  }

  /** 会话文件路径（诊断用，不含明文）。 */
  filePath(): string {
    return this.path
  }

  /**
   * 读取并解密会话。损坏或解密失败时返回 `undefined` 并清理坏文件。
   */
  async load(): Promise<StoredAuthSession | undefined> {
    let encrypted: Buffer
    try {
      encrypted = await readFile(this.path)
    } catch (error) {
      if (isNotFound(error)) return undefined
      throw error
    }
    if (!this.crypto.isEncryptionAvailable()) {
      console.warn('[internal-auth] safeStorage unavailable; ignoring persisted session')
      return undefined
    }
    try {
      const plain = this.crypto.decryptString(encrypted)
      return parseStoredSession(JSON.parse(plain) as unknown)
    } catch (error) {
      console.warn('[internal-auth] persisted session unreadable; clearing', error)
      await this.clear().catch(() => undefined)
      return undefined
    }
  }

  /**
   * 加密并原子写入会话。加密不可用时抛错，由调用方决定是否仅用内存会话。
   * @param session 待持久化会话
   */
  async save(session: StoredAuthSession): Promise<void> {
    if (!this.crypto.isEncryptionAvailable()) {
      throw new Error('OS secure storage is unavailable; session cannot be persisted.')
    }
    const payload = JSON.stringify(session)
    const encrypted = this.crypto.encryptString(payload)
    await mkdir(dirname(this.path), { recursive: true })
    const tempPath = `${this.path}.${process.pid}.tmp`
    await writeFile(tempPath, encrypted)
    await rename(tempPath, this.path)
  }

  /** 删除持久化会话。 */
  async clear(): Promise<void> {
    try {
      await rm(this.path, { force: true })
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
  }
}

/**
 * 校验磁盘上的会话 JSON。
 * @param value 解析后的 unknown
 */
export function parseStoredSession(value: unknown): StoredAuthSession {
  if (!value || typeof value !== 'object') throw new Error('Invalid stored auth session')
  const record = value as Record<string, unknown>
  if (record.provider !== 'mock') throw new Error('Invalid stored auth session provider')
  if (typeof record.accessToken !== 'string' || record.accessToken.length === 0) {
    throw new Error('Invalid stored auth session token')
  }
  if (typeof record.accountId !== 'string' || !record.accountId) {
    throw new Error('Invalid stored auth session account')
  }
  if (typeof record.displayName !== 'string' || !record.displayName) {
    throw new Error('Invalid stored auth session display name')
  }
  if (typeof record.issuedAt !== 'number' || !Number.isFinite(record.issuedAt)) {
    throw new Error('Invalid stored auth session issuedAt')
  }
  const session: StoredAuthSession = {
    provider: 'mock',
    accessToken: record.accessToken,
    accountId: record.accountId,
    displayName: record.displayName,
    issuedAt: record.issuedAt
  }
  if (record.expiresAt !== undefined) {
    if (typeof record.expiresAt !== 'number' || !Number.isFinite(record.expiresAt)) {
      throw new Error('Invalid stored auth session expiresAt')
    }
    session.expiresAt = record.expiresAt
  }
  return session
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  )
}
