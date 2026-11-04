import { AUTO_UPDATES_ENABLED } from '../../shared/brand'

export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000
export const UPDATE_STARTUP_DELAY_MS = 15_000
export const UPDATE_STARTUP_JITTER_MS = 15_000
export const AUTO_INSTALL_ON_APP_QUIT = false

/**
 * 是否允许自动更新。
 * Phase 0 通过 {@link AUTO_UPDATES_ENABLED} 关闭，避免误连上游 feed。
 */
export function supportsAutoUpdates(isPackaged: boolean, platform: NodeJS.Platform): boolean {
  return AUTO_UPDATES_ENABLED && isPackaged && (platform === 'darwin' || platform === 'win32')
}

export function shouldCheckAfterResume(lastCheckedAt: number, now = Date.now()): boolean {
  return now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS
}
