import { randomUUID } from 'node:crypto'
import type { InternalAuthProviderKind, InternalAuthSignInRequest } from '../../shared/internal-auth'
import type { StoredAuthSession } from './session-store'

/**
 * Auth Provider 抽象。真实内部 IdP 实现接入前只提供 mock。
 */
export interface AuthProvider {
  readonly kind: InternalAuthProviderKind
  /**
   * 用表单凭据换取会话。
   * @param request 登录输入
   */
  signIn(request: InternalAuthSignInRequest): Promise<StoredAuthSession>
}

/**
 * Mock Provider：任意非空用户名即可签发本地会话。
 * TODO(internal-auth): 替换为内部管理系统 OAuth2/OIDC/SSO；禁止在此编造对方 schema。
 */
export class MockAuthProvider implements AuthProvider {
  readonly kind = 'mock' as const

  /**
   * @param request 用户名 / 密码（密码仅校验非空，不做真实认证）
   */
  async signIn(request: InternalAuthSignInRequest): Promise<StoredAuthSession> {
    if (!request.password) {
      throw new Error('Password is required.')
    }
    const now = Date.now()
    return {
      provider: 'mock',
      accessToken: `mock.${randomUUID()}`,
      accountId: `mock:${request.username}`,
      displayName: request.username,
      issuedAt: now
      // 不编造 expiresAt；真实 token 生命周期待 IdP 文档
    }
  }
}

/**
 * 按配置创建 Provider。
 * @param kind Provider 种类
 */
export function createAuthProvider(kind: InternalAuthProviderKind): AuthProvider {
  switch (kind) {
    case 'mock':
      return new MockAuthProvider()
    default: {
      const _exhaustive: never = kind
      throw new Error(`Unsupported auth provider: ${String(_exhaustive)}`)
    }
  }
}
