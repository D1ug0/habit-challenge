import { z } from 'zod'

interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
  notificationOccurred(type: 'error' | 'success' | 'warning'): void
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe?: unknown
  HapticFeedback?: TelegramHapticFeedback
  ready(): void
  expand(): void
  openTelegramLink?(url: string): void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const launchParamsSchema = z.object({
  start_param: z.string().max(128).optional(),
})

const challengeStartParamSchema = z.string().regex(
  /^challenge_([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
)

function getWebApp(): TelegramWebApp | null {
  if (!import.meta.client) {
    return null
  }
  return window.Telegram?.WebApp ?? null
}

export function isTelegramEnvironment(): boolean {
  return Boolean(getWebApp()?.initData)
}

export function ready(): void {
  getWebApp()?.ready()
}

export function expand(): void {
  getWebApp()?.expand()
}

export function getInitData(): string {
  return getWebApp()?.initData ?? ''
}

export function getLaunchChallengeId(): string | null {
  const parsed = launchParamsSchema.safeParse(getWebApp()?.initDataUnsafe)
  const startParam = parsed.success ? parsed.data.start_param : undefined
  if (!startParam || !challengeStartParamSchema.safeParse(startParam).success) {
    return null
  }
  return startParam.slice('challenge_'.length)
}

export function impactFeedback(): void {
  const webApp = getWebApp()
  if (webApp?.initData) {
    webApp.HapticFeedback?.notificationOccurred('success')
  }
}

export async function shareChallenge(url: string, title: string): Promise<'shared' | 'copied'> {
  const webApp = getWebApp()
  if (webApp?.initData && webApp.openTelegramLink && url.startsWith('https://t.me/')) {
    webApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`)
    return 'shared'
  }

  if (navigator.share) {
    await navigator.share({ title, text: title, url })
    return 'shared'
  }

  await navigator.clipboard.writeText(url)
  return 'copied'
}
