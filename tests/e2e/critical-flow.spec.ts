import { createHmac } from 'node:crypto'
import type { BrowserContext } from '@playwright/test'
import { expect, test } from '@playwright/test'

const baseUrl = 'http://127.0.0.1:3000'
const botToken = 'habit-challenge-e2e-bot-token'

interface ChallengeApiResponse {
  challenge: {
    timeZone: string
    leaderboard: Array<{ user: Record<string, unknown> }>
  }
}

interface TelegramTestUser {
  id: number
  first_name: string
  username: string
}

function createInitData(user: TelegramTestUser): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `e2e-${user.id}-${Date.now()}`,
    user: JSON.stringify(user),
  })
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

async function installTelegramMock(
  context: BrowserContext,
  user: TelegramTestUser,
  startParam?: string,
): Promise<void> {
  await context.addInitScript(
    ({ initData, launchParam }) => {
      Object.defineProperty(window, 'Telegram', {
        configurable: true,
        value: {
          WebApp: {
            initData,
            initDataUnsafe: launchParam ? { start_param: launchParam } : {},
            ready() {},
            expand() {},
            HapticFeedback: { notificationOccurred() {} },
          },
        },
      })
    },
    { initData: createInitData(user), launchParam: startParam },
  )
}

async function blockTelegramScript(context: BrowserContext): Promise<void> {
  await context.route('https://telegram.org/js/telegram-web-app.js', (route) => route.abort())
}

test('прямая ссылка на форму корректно гидратируется и авторизуется', async ({ page }) => {
  const hydrationWarnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('Hydration')) {
      hydrationWarnings.push(message.text())
    }
  })

  await page.goto('/challenges/new')
  await expect(page.getByRole('button', { name: 'Начать челлендж' })).toBeEnabled()
  expect(hydrationWarnings).toEqual([])
})

test('health-check подтверждает соединение с базой', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toMatchObject({ status: 'ok', database: 'connected' })
})

test('пользователь создаёт челлендж и быстро отмечает выполнение с главной', async ({ page }) => {
  const title = `Читать каждый день ${Date.now()}`
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Привет/ })).toBeVisible()
  await page.getByRole('link', { name: 'Создать челлендж' }).click()
  await page.getByLabel('Название').fill(title)
  await page.getByRole('button', { name: 'Начать челлендж' }).click()

  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const challengeId = new URL(page.url()).pathname.split('/').at(-1)

  await page.getByRole('link', { name: 'Habit Challenge — на главную' }).click()
  const quickCheckIn = page.getByRole('button', {
    name: `Отметить «${title}» выполненным сегодня`,
  })
  await expect(quickCheckIn).toBeVisible()
  await quickCheckIn.click()
  await expect(page.getByRole('button', { name: `${title}: сегодня выполнено` })).toBeDisabled()

  await page.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('button', { name: 'Сегодня выполнено ✓' })).toBeDisabled()

  const duplicateResponse = await page.request.post(`/api/challenges/${challengeId}/check-ins`, {
    data: {},
  })
  expect(duplicateResponse.status()).toBe(409)

  await page.getByRole('button', { name: 'Отменить отметку' }).click()
  await expect(page.getByRole('button', { name: 'Выполнено сегодня' })).toBeEnabled()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Выполнено сегодня' })).toBeEnabled()
  await expect(page.getByText('Первая отметка появится здесь.')).toBeVisible()

  const repeatedUndoResponse = await page.request.delete(
    `/api/challenges/${challengeId}/check-ins/today`,
  )
  expect(repeatedUndoResponse.status()).toBe(404)
  expect((await page.request.delete(`/api/challenges/${challengeId}`)).ok()).toBe(true)
})

test('второй пользователь вступает по deep link и выходит из группы', async ({ browser }) => {
  const ownerContext = await browser.newContext({ baseURL: baseUrl, timezoneId: 'Europe/Moscow' })
  await installTelegramMock(ownerContext, {
    id: 999100001,
    first_name: 'Владелец',
    username: 'e2e_owner',
  })
  await blockTelegramScript(ownerContext)
  const ownerPage = await ownerContext.newPage()

  let challengeId = ''
  try {
    const title = `Группа с выходом ${Date.now()}`
    await ownerPage.goto('/challenges/new')
    await expect(ownerPage.getByRole('button', { name: 'Начать челлендж' })).toBeEnabled()
    await ownerPage.getByLabel('Название').fill(title)
    await ownerPage.getByText('Вместе', { exact: true }).click()
    await ownerPage.getByRole('button', { name: 'Начать челлендж' }).click()
    await expect(ownerPage.getByRole('heading', { name: title })).toBeVisible()
    challengeId = new URL(ownerPage.url()).pathname.split('/').at(-1) ?? ''
    const ownerDetails = (await (
      await ownerPage.request.get(`/api/challenges/${challengeId}`)
    ).json()) as ChallengeApiResponse
    expect(ownerDetails.challenge.timeZone).toBe('Europe/Moscow')

    const memberContext = await browser.newContext({
      baseURL: baseUrl,
      timezoneId: 'America/New_York',
    })
    await installTelegramMock(
      memberContext,
      { id: 999100002, first_name: 'Участник', username: 'e2e_member' },
      `challenge_${challengeId}`,
    )
    await blockTelegramScript(memberContext)
    const memberPage = await memberContext.newPage()

    try {
      await memberPage.goto('/')
      await expect(memberPage).toHaveURL(`/join/${challengeId}`)
      await memberPage.getByRole('button', { name: 'Присоединиться' }).click()
      await expect(memberPage).toHaveURL(`/challenges/${challengeId}`)
      await expect(memberPage.locator('.person-name').filter({ hasText: 'Участник' })).toBeVisible()
      await expect(memberPage.getByText('Владелец', { exact: true })).toBeVisible()
      const memberDetails = (await (
        await memberPage.request.get(`/api/challenges/${challengeId}`)
      ).json()) as ChallengeApiResponse
      expect(memberDetails.challenge.leaderboard).toHaveLength(2)
      expect(
        memberDetails.challenge.leaderboard.every((entry) => !('telegramId' in entry.user)),
      ).toBe(true)

      await memberPage.getByRole('button', { name: 'Выполнено сегодня' }).click()
      await memberPage.getByRole('button', { name: 'Покинуть челлендж' }).click()
      await memberPage.getByRole('button', { name: 'Да, покинуть' }).click()
      await expect(memberPage).toHaveURL('/')

      await ownerPage.reload()
      await expect(ownerPage.getByText('1 участн.', { exact: true })).toBeVisible()
      await expect(ownerPage.getByText('Участник', { exact: true })).toBeHidden()
    } finally {
      await memberContext.close()
    }
  } finally {
    if (challengeId) await ownerPage.request.delete(`/api/challenges/${challengeId}`)
    await ownerContext.close()
  }
})

test('создатель завершает и удаляет групповой челлендж', async ({ page }) => {
  const title = `Командный челлендж ${Date.now()}`
  await page.goto('/challenges/new')
  await expect(page.getByRole('button', { name: 'Начать челлендж' })).toBeEnabled()
  await page.getByLabel('Название').fill(title)
  await page.getByText('Вместе', { exact: true }).click()
  await page.getByRole('button', { name: 'Начать челлендж' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const challengeId = new URL(page.url()).pathname.split('/').at(-1)

  const ownerLeaveResponse = await page.request.delete(
    `/api/challenges/${challengeId}/participants/me`,
  )
  expect(ownerLeaveResponse.status()).toBe(403)

  await page.getByRole('button', { name: 'Завершить досрочно' }).click()
  await page.getByRole('button', { name: 'Да, завершить' }).click()
  await expect(page.getByText('Челлендж завершён', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Челлендж завершён' })).toBeDisabled()

  const checkInResponse = await page.request.post(`/api/challenges/${challengeId}/check-ins`, {
    data: {},
  })
  expect(checkInResponse.status()).toBe(409)
  const joinResponse = await page.request.post(`/api/challenges/${challengeId}/join`, { data: {} })
  expect(joinResponse.status()).toBe(409)

  await page.getByRole('button', { name: 'Удалить челлендж' }).click()
  const deleteDialog = page.getByRole('dialog', { name: `Удалить «${title}»?` })
  await expect(deleteDialog).toBeVisible()
  await expect(deleteDialog.getByRole('button', { name: 'Отмена' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(deleteDialog).toBeHidden()
  await page.getByRole('button', { name: 'Удалить челлендж' }).click()
  await page.getByRole('button', { name: 'Да, удалить' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:3000/')
  const deletedResponse = await page.request.get(`/api/challenges/${challengeId}`)
  expect(deletedResponse.status()).toBe(404)
})
