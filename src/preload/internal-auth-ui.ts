import { ipcRenderer } from 'electron'
import {
  INTERNAL_AUTH_IPC,
  type InternalAuthStatus
} from '../shared/internal-auth'
import { PRODUCT_NAME } from '../shared/brand'

type AuthLocale = 'en' | 'zh'

const ROOT_ID = 'autocad-ai-internal-auth-root'

let host: HTMLDivElement | undefined
let shadow: ShadowRoot | undefined
let open = false
let busy = false
let status: InternalAuthStatus | undefined
let errorText = ''
let previousFocus: HTMLElement | null = null
let themeObserver: MutationObserver | undefined

const copy = {
  zh: {
    titleSignIn: '登录内部账号',
    titleSignedIn: '内部账号',
    subtitle:
      '登录后可使用云版本等联网能力；未登录仍可继续使用本地功能。此为 Phase 0 mock，不接真实内部 API。',
    username: '用户名',
    password: '密码',
    signIn: 'Mock 登录',
    signOut: '退出登录',
    close: '关闭',
    signedInAs: '已登录',
    cloudOn: '云/版本能力：已启用（实际上传仍为 TODO）',
    cloudOff: '云/版本能力：已禁用',
    required: '请输入用户名和密码。',
    failed: '登录失败，请重试。'
  },
  en: {
    titleSignIn: 'Internal sign-in',
    titleSignedIn: 'Internal account',
    subtitle:
      'Sign in to enable cloud version features. Local work stays available while signed out. Phase 0 mock — no real internal API.',
    username: 'Username',
    password: 'Password',
    signIn: 'Mock sign-in',
    signOut: 'Sign out',
    close: 'Close',
    signedInAs: 'Signed in as',
    cloudOn: 'Cloud/version capabilities: enabled (upload still TODO)',
    cloudOff: 'Cloud/version capabilities: disabled',
    required: 'Username and password are required.',
    failed: 'Sign-in failed. Please try again.'
  }
} as const

/**
 * 挂载内部登录对话框与状态订阅。
 * 幂等；应用可未登录启动，仅云能力被门闩禁用。
 */
export function mountInternalAuthUi(): () => void {
  if (document.getElementById(ROOT_ID)) {
    return () => undefined
  }

  ensureHost()
  void refreshStatus()

  const onChanged = (_event: Electron.IpcRendererEvent, next: unknown): void => {
    if (!isAuthStatus(next)) return
    status = next
    if (open) render()
  }
  const onShow = (): void => {
    openDialog()
  }

  ipcRenderer.on(INTERNAL_AUTH_IPC.changed, onChanged)
  ipcRenderer.on(INTERNAL_AUTH_IPC.showDialog, onShow)

  const onPointerDown = (event: MouseEvent): void => {
    if (!open || !host) return
    const path = event.composedPath()
    if (!path.includes(host)) closeDialog()
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!open || busy) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDialog()
    }
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)

  return () => {
    ipcRenderer.removeListener(INTERNAL_AUTH_IPC.changed, onChanged)
    ipcRenderer.removeListener(INTERNAL_AUTH_IPC.showDialog, onShow)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
    themeObserver?.disconnect()
    themeObserver = undefined
    host?.remove()
    host = undefined
    shadow = undefined
  }
}

/**
 * 打开登录对话框（供菜单或桥接调用）。
 */
export function openInternalAuthDialog(): void {
  openDialog()
}

async function refreshStatus(): Promise<void> {
  try {
    const next = (await ipcRenderer.invoke(INTERNAL_AUTH_IPC.status)) as unknown
    if (isAuthStatus(next)) status = next
  } catch (error) {
    console.warn('[internal-auth] status unavailable', error)
  }
}

function openDialog(): void {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  open = true
  errorText = ''
  void refreshStatus().finally(() => render())
}

function closeDialog(): void {
  if (busy) return
  open = false
  errorText = ''
  render()
  previousFocus?.focus()
  previousFocus = null
}

function ensureHost(): void {
  if (host && shadow) return
  host = document.createElement('div')
  host.id = ROOT_ID
  host.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483645',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'background:rgba(0,0,0,.32)',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
  ].join(';')
  shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = styles
  shadow.appendChild(style)
  document.documentElement.appendChild(host)
  syncTheme()
  themeObserver = new MutationObserver(() => syncTheme())
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-dsh-theme', 'class', 'style']
  })
}

function syncTheme(): void {
  if (!host) return
  const dark =
    document.documentElement.dataset.dshTheme === 'dark' ||
    document.documentElement.classList.contains('dark')
  host.dataset.dshTheme = dark ? 'dark' : 'light'
}

function render(): void {
  ensureHost()
  if (!host || !shadow) return
  if (!open) {
    host.style.display = 'none'
    const existing = shadow.querySelector('.overlay')
    existing?.remove()
    return
  }

  host.style.display = 'flex'
  const locale: AuthLocale = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  const t = copy[locale]
  const signedIn = status?.signedIn === true

  let overlay = shadow.querySelector('.overlay') as HTMLElement | null
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.className = 'overlay'
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay && !busy) closeDialog()
    })
    shadow.appendChild(overlay)
  }

  const card = document.createElement('div')
  card.className = 'card'
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')
  card.tabIndex = -1

  const title = document.createElement('h2')
  title.className = 'title'
  title.textContent = signedIn ? t.titleSignedIn : t.titleSignIn
  card.appendChild(title)

  const brand = document.createElement('p')
  brand.className = 'brand'
  brand.textContent = PRODUCT_NAME
  card.appendChild(brand)

  const subtitle = document.createElement('p')
  subtitle.className = 'subtitle'
  subtitle.textContent = t.subtitle
  card.appendChild(subtitle)

  const live = document.createElement('div')
  live.className = 'live'
  live.setAttribute('aria-live', 'polite')

  if (signedIn) {
    const line = document.createElement('p')
    line.className = 'status'
    line.textContent = `${t.signedInAs} ${status?.displayName ?? status?.accountId ?? ''}`
    live.appendChild(line)
    const caps = document.createElement('p')
    caps.className = 'caps'
    caps.textContent = t.cloudOn
    live.appendChild(caps)
  } else {
    const caps = document.createElement('p')
    caps.className = 'caps'
    caps.textContent = t.cloudOff
    live.appendChild(caps)

    const userLabel = document.createElement('label')
    userLabel.className = 'field'
    const userText = document.createElement('span')
    userText.textContent = t.username
    const userInput = document.createElement('input')
    userInput.type = 'text'
    userInput.name = 'username'
    userInput.autocomplete = 'username'
    userInput.disabled = busy
    userLabel.append(userText, userInput)
    live.appendChild(userLabel)

    const passLabel = document.createElement('label')
    passLabel.className = 'field'
    const passText = document.createElement('span')
    passText.textContent = t.password
    const passInput = document.createElement('input')
    passInput.type = 'password'
    passInput.name = 'password'
    passInput.autocomplete = 'current-password'
    passInput.disabled = busy
    passLabel.append(passText, passInput)
    live.appendChild(passLabel)

    const submit = async (): Promise<void> => {
      if (busy) return
      const username = userInput.value
      const password = passInput.value
      if (!username.trim() || !password) {
        errorText = t.required
        render()
        return
      }
      busy = true
      errorText = ''
      render()
      try {
        const next = (await ipcRenderer.invoke(INTERNAL_AUTH_IPC.signIn, {
          username,
          password
        })) as unknown
        if (isAuthStatus(next)) status = next
        busy = false
        open = false
        render()
        previousFocus?.focus()
        previousFocus = null
      } catch (error) {
        busy = false
        errorText = error instanceof Error && error.message ? error.message : t.failed
        render()
      }
    }

    passInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void submit()
      }
    })

    const actions = document.createElement('div')
    actions.className = 'actions'
    const signInBtn = document.createElement('button')
    signInBtn.type = 'button'
    signInBtn.className = 'primary'
    signInBtn.textContent = busy ? (locale === 'zh' ? '登录中…' : 'Signing in…') : t.signIn
    signInBtn.disabled = busy
    signInBtn.addEventListener('click', () => void submit())
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'secondary'
    closeBtn.textContent = t.close
    closeBtn.disabled = busy
    closeBtn.addEventListener('click', closeDialog)
    actions.append(signInBtn, closeBtn)
    live.appendChild(actions)

    queueMicrotask(() => userInput.focus())
  }

  if (errorText) {
    const err = document.createElement('p')
    err.className = 'error'
    err.textContent = errorText
    live.appendChild(err)
  }

  if (signedIn) {
    const actions = document.createElement('div')
    actions.className = 'actions'
    const signOutBtn = document.createElement('button')
    signOutBtn.type = 'button'
    signOutBtn.className = 'primary'
    signOutBtn.textContent = t.signOut
    signOutBtn.disabled = busy
    signOutBtn.addEventListener('click', () => {
      if (busy) return
      busy = true
      render()
      void ipcRenderer
        .invoke(INTERNAL_AUTH_IPC.signOut)
        .then((next) => {
          if (isAuthStatus(next)) status = next
        })
        .catch((error: unknown) => {
          errorText = error instanceof Error ? error.message : t.failed
        })
        .finally(() => {
          busy = false
          render()
        })
    })
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'secondary'
    closeBtn.textContent = t.close
    closeBtn.disabled = busy
    closeBtn.addEventListener('click', closeDialog)
    actions.append(signOutBtn, closeBtn)
    live.appendChild(actions)
  }

  card.appendChild(live)
  overlay.replaceChildren(card)
  if (!signedIn) {
    // focus handled above
  } else {
    card.focus()
  }
}

function isAuthStatus(value: unknown): value is InternalAuthStatus {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.signedIn === 'boolean' && typeof record.provider === 'string'
}

const styles = `
  :host { color-scheme: light; }
  * { box-sizing: border-box; }
  .overlay { width: min(420px, 100%); }
  .card {
    pointer-events: auto;
    width: 100%;
    color: var(--dsw-alias-label-primary, #202124);
    background: var(--dsw-alias-bg-layer-1, #fff);
    border: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 8px 24px rgba(0,0,0,.12);
  }
  .card:focus { outline: none; }
  .title { margin: 0 0 4px; font-size: 18px; line-height: 26px; font-weight: 600; }
  .brand { margin: 0 0 12px; font-size: 13px; color: var(--dsw-alias-label-secondary, #666b73); }
  .subtitle, .status, .caps { margin: 0 0 12px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary, #666b73); }
  .field { display: flex; flex-direction: column; gap: 6px; margin: 0 0 12px; font-size: 13px; }
  .field span { color: var(--dsw-alias-label-secondary, #666b73); }
  input {
    appearance: none;
    border: 1px solid var(--dsw-alias-border-l2, #d4d4d8);
    border-radius: 8px;
    min-height: 36px;
    padding: 8px 10px;
    font: inherit;
    color: inherit;
    background: var(--dsw-alias-bg-layer-2, #f5f6f7);
  }
  input:focus-visible { outline: 2px solid var(--dsw-alias-label-primary, #202124); outline-offset: 2px; }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  button {
    appearance: none;
    border: 0;
    font: inherit;
    cursor: pointer;
    border-radius: 6px;
    min-height: 36px;
    padding: 8px 14px;
  }
  button:disabled { cursor: default; opacity: .55; }
  button:focus-visible { outline: 2px solid var(--dsw-alias-label-primary, #202124); outline-offset: 3px; }
  .primary {
    background: var(--dsw-alias-button-primary-fill, #000);
    color: var(--dsw-alias-label-primary-inverted, #fff);
  }
  .primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #34363b); }
  .secondary {
    color: var(--dsw-alias-label-secondary, #666b73);
    background: transparent;
  }
  .secondary:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, #f0f2f5); }
  .error { margin: 8px 0 0; color: #c33b38; font-size: 13px; }
  :host([data-dsh-theme="dark"]) .card {
    background: var(--dsw-alias-bg-layer-1, #1f2023);
    color: var(--dsw-alias-label-primary, #f3f4f6);
    border-color: var(--dsw-alias-border-l2, #41434a);
  }
  :host([data-dsh-theme="dark"]) :is(.brand,.subtitle,.status,.caps,.field span,.secondary) {
    color: var(--dsw-alias-label-secondary, #a9adb5);
  }
  :host([data-dsh-theme="dark"]) input {
    background: var(--dsw-alias-bg-layer-2, #2a2b2f);
    border-color: var(--dsw-alias-border-l2, #41434a);
  }
`
