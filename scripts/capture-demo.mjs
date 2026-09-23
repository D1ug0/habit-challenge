import { createHmac } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:3000'
const botToken = process.env.TELEGRAM_BOT_TOKEN
if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is required')
await mkdir('docs/demo-frames', { recursive: true })

function initData(id, name) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: name }),
  })
  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  params.set('hash', createHmac('sha256', secret).update(message).digest('hex'))
  return params.toString()
}

async function makeContext(browser, id, name, startParam) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    timezoneId: 'Europe/Moscow',
  })
  await context.route('https://telegram.org/js/telegram-web-app.js', (route) => route.abort())
  await context.addInitScript(
    ({ data, start }) => {
      Object.defineProperty(window, 'Telegram', {
        configurable: true,
        value: {
          WebApp: {
            initData: data,
            initDataUnsafe: start ? { start_param: start } : {},
            ready() {},
            expand() {},
            HapticFeedback: { notificationOccurred() {} },
          },
        },
      })
    },
    { data: initData(id, name), start: startParam },
  )
  return context
}

const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : 'chromium',
})
const unique = Math.floor(Date.now() / 1000)
let owner
let member
let ownerPage
let memberPage
try {
  owner = await makeContext(browser, 990_000_000 + unique, 'Алекс')
  const page = await owner.newPage()
  ownerPage = page
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Алекс/ })).toBeVisible()
  await expect(page.locator('.loading-grid')).toHaveCount(0)
  await page.screenshot({ path: 'docs/demo-frames/01-dashboard.png' })

  await page.getByRole('link', { name: 'Создать челлендж' }).click()
  await expect(page.getByRole('button', { name: 'Начать челлендж' })).toBeEnabled()
  await page.screenshot({ path: 'docs/demo-frames/02-create.png' })
  await page.getByLabel('Название').fill('Читать каждый день')
  await page.locator('.segmented label').nth(1).click()
  await page.locator('.segmented label.selected').filter({ hasText: 'Вместе' }).waitFor()
  await page.getByRole('button', { name: 'Начать челлендж' }).click()
  await page.getByRole('heading', { name: 'Читать каждый день' }).waitFor()
  const challengeId = new URL(page.url()).pathname.split('/').at(-1)
  await page.screenshot({ path: 'docs/demo-frames/03-challenge.png' })

  await page.getByRole('button', { name: 'Выполнено сегодня' }).click()
  await page.getByRole('button', { name: 'Сегодня выполнено ✓' }).waitFor()
  await page.screenshot({ path: 'docs/demo-frames/04-check-in.png' })

  const details = await page.evaluate(
    async (id) => (await fetch(`/api/challenges/${id}`)).json(),
    challengeId,
  )
  if (!details.challenge?.inviteUrl)
    throw new Error(`Invite URL missing for ${details.challenge?.type}/${details.challenge?.phase}`)
  const startParam = new URL(details.challenge.inviteUrl).searchParams.get('startapp')
  member = await makeContext(browser, 991_000_000 + unique, 'Друг', startParam)
  memberPage = await member.newPage()
  await memberPage.goto('/')
  await memberPage.getByRole('button', { name: 'Присоединиться' }).waitFor()
  await memberPage.screenshot({ path: 'docs/demo-frames/05-invite.png' })
  await memberPage.getByRole('button', { name: 'Присоединиться' }).click()
  await memberPage.getByText('Лидерборд').waitFor()
  await memberPage.getByText('Лидерборд').scrollIntoViewIfNeeded()
  await memberPage.screenshot({ path: 'docs/demo-frames/06-leaderboard.png' })

  await page.goto('/analytics')
  await page.getByText('Активность по дням').waitFor()
  await page.screenshot({ path: 'docs/demo-frames/07-analytics.png' })
  console.info('Captured 7 frames in docs/demo-frames')
} finally {
  try {
    await ownerPage?.evaluate(async () => fetch('/api/me', { method: 'DELETE' }))
  } catch {
    /* best-effort test data cleanup */
  }
  try {
    await memberPage?.evaluate(async () => fetch('/api/me', { method: 'DELETE' }))
  } catch {
    /* best-effort test data cleanup */
  }
  await member?.close()
  await owner?.close()
  await browser.close()
}
