/**
 * 内部管理系统登录门闩的跨进程契约。
 * Phase 0 仅提供骨架：不编造真实 IdP schema，token 永不下发到 renderer。
 */

/** 云/版本类宿主能力；未登录时全部禁用。本地编辑不在此列。 */
export const CLOUD_CAPABILITIES = ['cloudVersion', 'cloudUpdates'] as const

/** @see CLOUD_CAPABILITIES */
export type CloudCapability = (typeof CLOUD_CAPABILITIES)[number]

/**
 * Auth Provider 种类。
 * Phase 0 只有 mock；真实 OAuth2/OIDC/内部 SSO 待 API 文档到位后再扩展。
 */
export type InternalAuthProviderKind = 'mock'

/** 发给 renderer 的登录态快照（不含 token）。 */
export interface InternalAuthStatus {
  signedIn: boolean
  provider: InternalAuthProviderKind
  accountId?: string
  displayName?: string
  /** 当前是否允许云版本同步（MinIO 等；Phase 0 仅门闩，无实际上传）。 */
  capabilities: Record<CloudCapability, boolean>
}

/** Mock 登录表单输入；真实协议字段待 IdP 文档锁定，禁止在此编造。 */
export interface InternalAuthSignInRequest {
  username: string
  password: string
}

/** IPC 通道名。 */
export const INTERNAL_AUTH_IPC = {
  status: 'internal-auth:status',
  signIn: 'internal-auth:sign-in',
  signOut: 'internal-auth:sign-out',
  changed: 'internal-auth:changed',
  showDialog: 'desktop:show-internal-auth'
} as const

/**
 * 未登录时的能力快照。
 */
export function disabledCloudCapabilities(): Record<CloudCapability, boolean> {
  return { cloudVersion: false, cloudUpdates: false }
}

/**
 * 已登录时的能力快照（能力位打开；具体云实现仍为 TODO）。
 */
export function enabledCloudCapabilities(): Record<CloudCapability, boolean> {
  return { cloudVersion: true, cloudUpdates: true }
}

/**
 * 校验 IPC 传入的登录请求。
 * @param value 未知输入
 */
export function parseInternalAuthSignInRequest(value: unknown): InternalAuthSignInRequest {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid sign-in request.')
  }
  const record = value as Record<string, unknown>
  if (typeof record.username !== 'string' || typeof record.password !== 'string') {
    throw new Error('Invalid sign-in request.')
  }
  const username = record.username.trim()
  if (!username || username.length > 200) {
    throw new Error('Username is required.')
  }
  if (record.password.length > 500) {
    throw new Error('Password is too long.')
  }
  return { username, password: record.password }
}

/**
 * 判断能力名是否合法。
 * @param value 未知输入
 */
export function isCloudCapability(value: unknown): value is CloudCapability {
  return typeof value === 'string' && (CLOUD_CAPABILITIES as readonly string[]).includes(value)
}
