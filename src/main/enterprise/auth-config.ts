import type { InternalAuthProviderKind } from '../../shared/internal-auth'

/**
 * 内部登录配置占位。
 * 真实 IdP 字段（client id、redirect、scopes 等）待 API 文档到位后再补；此处不编造 schema。
 */
export interface InternalAuthConfig {
  /** Provider 种类；Phase 0 固定 mock。 */
  provider: InternalAuthProviderKind
  /**
   * 内部管理系统权威地址占位。
   * Mock 不访问网络；真实 Provider 接入前保持可选。
   */
  authorityUrl?: string
}

const DEFAULT_CONFIG: InternalAuthConfig = {
  provider: 'mock'
  // TODO(internal-auth): 在拿到内部登录 API 文档后填充 authorityUrl / 协议字段
}

/**
 * 从环境变量读取内部登录配置。
 * 支持 `AUTOCAD_AI_AUTH_PROVIDER`、`AUTOCAD_AI_AUTH_AUTHORITY_URL`。
 * @param env 环境变量表，默认 `process.env`
 */
export function loadInternalAuthConfig(
  env: NodeJS.ProcessEnv = process.env
): InternalAuthConfig {
  const providerRaw = env.AUTOCAD_AI_AUTH_PROVIDER?.trim().toLowerCase()
  const provider: InternalAuthProviderKind =
    providerRaw === 'mock' || providerRaw === undefined || providerRaw === ''
      ? 'mock'
      : 'mock'
  // 未知 provider 名暂回落 mock，避免启动失败；接入真实 API 后再严格校验。
  if (providerRaw && providerRaw !== 'mock') {
    console.warn(
      `[internal-auth] unsupported provider "${providerRaw}"; falling back to mock until the real IdP is wired`
    )
  }

  const authorityUrl = env.AUTOCAD_AI_AUTH_AUTHORITY_URL?.trim()
  return {
    ...DEFAULT_CONFIG,
    provider,
    ...(authorityUrl ? { authorityUrl } : {})
  }
}
