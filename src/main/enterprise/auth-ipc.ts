import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  INTERNAL_AUTH_IPC,
  parseInternalAuthSignInRequest,
  type InternalAuthStatus
} from '../../shared/internal-auth'
import type { InternalAuthService } from './auth-service'

export interface RegisterInternalAuthIpcOptions {
  service: InternalAuthService
  /**
   * 校验 invoke 是否来自可信主窗口 main frame。
   * @param event IPC 事件
   */
  assertTrustedSender: (event: IpcMainInvokeEvent) => void
}

let registered = false

/**
 * 注册内部登录 IPC；幂等。
 * @param options 服务与发送方校验
 */
export function registerInternalAuthIpc(options: RegisterInternalAuthIpcOptions): void {
  if (registered) return
  registered = true
  const { service, assertTrustedSender } = options

  ipcMain.handle(INTERNAL_AUTH_IPC.status, (event) => {
    assertTrustedSender(event)
    return service.getStatus()
  })

  ipcMain.handle(INTERNAL_AUTH_IPC.signIn, async (event, request: unknown) => {
    assertTrustedSender(event)
    const parsed = parseInternalAuthSignInRequest(request)
    return service.signIn(parsed)
  })

  ipcMain.handle(INTERNAL_AUTH_IPC.signOut, async (event) => {
    assertTrustedSender(event)
    return service.signOut()
  })
}

/**
 * 向所有存活窗口广播登录态变更。
 * @param status 公开状态
 */
export function broadcastInternalAuthStatus(status: InternalAuthStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(INTERNAL_AUTH_IPC.changed, status)
  }
}

/**
 * 请求主窗口打开登录对话框。
 * @param window 主窗口
 */
export function requestInternalAuthDialog(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  window.webContents.send(INTERNAL_AUTH_IPC.showDialog)
}

/** 测试用：允许重复注册。 */
export function resetInternalAuthIpcForTests(): void {
  registered = false
  for (const channel of [
    INTERNAL_AUTH_IPC.status,
    INTERNAL_AUTH_IPC.signIn,
    INTERNAL_AUTH_IPC.signOut
  ]) {
    ipcMain.removeHandler(channel)
  }
}
