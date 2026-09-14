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

const challengeStartParamSchema = z
  .string()
  .regex(/^challenge_([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)

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

export function openTelegramShare(url: string, title: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
  const webApp = getWebApp()
  if (webApp?.initData && webApp.openTelegramLink && url.startsWith('https://t.me/')) {
    webApp.openTelegramLink(shareUrl)
  } else {
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }
}

export async function copyChallengeUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url)
}
