/**
 * autoCad AI 壳身份常量。
 * 与上游 autoCad AI 隔离 appId / 产品名 / userData，避免抢占正式版数据目录与更新通道。
 */

/** 正式包 Electron appId */
export const APP_ID = 'ai.autocad.desktop'

/** 开发包 Electron appId */
export const APP_ID_DEV = 'ai.autocad.desktop.dev'

/** 正式包显示名 */
export const PRODUCT_NAME = 'autoCad AI'

/** 开发包显示名 */
export const PRODUCT_NAME_DEV = 'autoCad AI Dev'

/**
 * 生产环境 userData 目录名（位于 appData 下）。
 * 故意不从 productName 推导，避免品牌改名导致用户数据看起来像全新安装。
 */
export const USER_DATA_DIR = 'autocad-ai'

/** 开发环境默认 userData / DSH_DEV_PROFILE 目录名 */
export const USER_DATA_DIR_DEV = 'autocad-ai-dev'

/** 安装包 artifact 前缀 */
export const ARTIFACT_PREFIX = 'autocad-ai'

/**
 * 自有更新源占位；`.invalid` 永不解析，禁止误连上游 dshdesktop.com feed。
 * 自有发布通道就绪前保持占位，并由 {@link AUTO_UPDATES_ENABLED} 关闭自动检查。
 */
export const STABLE_FEED_URL = 'https://updates.invalid/autocad-ai/latest/'

/** 版本索引占位 URL */
export const VERSION_INDEX_URL = 'https://updates.invalid/autocad-ai/versions.json'

/** 崩溃/更新策略服务占位；禁止上报到上游 dshdesktop.com */
export const DESKTOP_SERVICE_URL = 'https://updates.invalid/autocad-ai/service'

/** Phase 0：尚无自有更新源，禁用自动更新检查 */
export const AUTO_UPDATES_ENABLED = false

/**
 * 构造指定版本的 archive feed 占位 URL。
 * @param version 目标版本号
 */
export function archiveFeedUrl(version: string): string {
  return `https://updates.invalid/autocad-ai/archive/${version}/`
}
