import type {
  CloudCapability,
  InternalAuthSignInRequest,
  InternalAuthStatus
} from '../../shared/internal-auth'
import {
  disabledCloudCapabilities,
  enabledCloudCapabilities
} from '../../shared/internal-auth'
import type { InternalAuthConfig } from './auth-config'
import { createAuthProvider, type AuthProvider } from './auth-provider'
import type { AuthSessionStore, StoredAuthSession } from './session-store'

export interface InternalAuthServiceOptions {
  config: InternalAuthConfig
  store: AuthSessionStore
  provider?: AuthProvider
  /** 会话变更时通知（用于广播 IPC）。 */
  onChanged?: (status: InternalAuthStatus) => void
}

/**
 * 内部登录门闩服务：会话生命周期 + 云能力门闩。
 * 未登录时应用仍可进入；仅云/版本能力被禁用。
 */
export class InternalAuthService {
  private readonly config: InternalAuthConfig
  private readonly store: AuthSessionStore
  private readonly provider: AuthProvider
  private readonly onChanged?: (status: InternalAuthStatus) => void
  private session: StoredAuthSession | undefined
  private ready = false

  /**
   * @param options 配置、持久化与可选 Provider
   */
  constructor(options: InternalAuthServiceOptions) {
    this.config = options.config
    this.store = options.store
    this.provider = options.provider ?? createAuthProvider(options.config.provider)
    this.onChanged = options.onChanged
  }

  /** 当前配置（只读快照）。 */
  getConfig(): InternalAuthConfig {
    return { ...this.config }
  }

  /**
   * 从安全存储恢复会话。应在注册 IPC 前调用一次。
   */
  async initialize(): Promise<void> {
    if (this.ready) return
    this.session = await this.store.load()
    if (this.session && isSessionExpired(this.session)) {
      await this.store.clear().catch(() => undefined)
      this.session = undefined
    }
    this.ready = true
  }

  /** 面向 renderer 的状态（不含 token）。 */
  getStatus(): InternalAuthStatus {
    if (!this.session) {
      return {
        signedIn: false,
        provider: this.provider.kind,
        capabilities: disabledCloudCapabilities()
      }
    }
    return {
      signedIn: true,
      provider: this.provider.kind,
      accountId: this.session.accountId,
      displayName: this.session.displayName,
      capabilities: enabledCloudCapabilities()
    }
  }

  /**
   * 某项云能力当前是否可用。
   * @param capability 能力名
   */
  isCapabilityAllowed(capability: CloudCapability): boolean {
    return this.getStatus().capabilities[capability] === true
  }

  /**
   * 云能力门闩：未登录时抛错，供更新目录 / 未来 MinIO 等调用。
   * @param capability 能力名
   */
  assertCapability(capability: CloudCapability): void {
    if (this.isCapabilityAllowed(capability)) return
    throw new Error(cloudCapabilityDeniedMessage(capability))
  }

  /**
   * Mock / 未来真实登录入口。
   * @param request 已校验的登录请求
   */
  async signIn(request: InternalAuthSignInRequest): Promise<InternalAuthStatus> {
    await this.ensureReady()
    const session = await this.provider.signIn(request)
    this.session = session
    try {
      await this.store.save(session)
    } catch (error) {
      // 加密不可用时仍允许本进程内会话，避免把开发机登录打成硬失败。
      console.warn('[internal-auth] session kept in memory only:', error)
    }
    const status = this.getStatus()
    this.onChanged?.(status)
    return status
  }

  /** 清除内存与持久化会话。 */
  async signOut(): Promise<InternalAuthStatus> {
    await this.ensureReady()
    this.session = undefined
    await this.store.clear().catch((error) => {
      console.warn('[internal-auth] failed to clear persisted session:', error)
    })
    const status = this.getStatus()
    this.onChanged?.(status)
    return status
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) await this.initialize()
  }
}

/**
 * @param session 会话
 */
export function isSessionExpired(session: StoredAuthSession): boolean {
  return typeof session.expiresAt === 'number' && session.expiresAt <= Date.now()
}

/**
 * 门闩拒绝时的稳定英文错误（UI 层可再本地化）。
 * @param capability 能力名
 */
export function cloudCapabilityDeniedMessage(capability: CloudCapability): string {
  switch (capability) {
    case 'cloudVersion':
      return 'Cloud version sync requires an internal account sign-in.'
    case 'cloudUpdates':
      return 'Cloud update catalog requires an internal account sign-in.'
    default: {
      const _exhaustive: never = capability
      return `Capability unavailable without sign-in: ${String(_exhaustive)}`
    }
  }
}
