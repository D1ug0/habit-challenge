import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'

const botToken = 'habit-challenge-e2e-bot-token'

function signedInitData(id: number, name: string): string {
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

test('закрытая группа требует приглашение, а исключённый участник не возвращается', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' })
  const member = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' })
  const unique = Date.now() + Math.floor(Math.random() * 100_000)
  try {
    const ownerAuth = await owner.request.post('/api/auth/telegram', {
      data: { initData: signedInitData(800_000_000 + unique, 'Владелец'), timeZone: 'UTC' },
    })
    expect(ownerAuth.ok()).toBe(true)
    const memberAuth = await member.request.post('/api/auth/telegram', {
      data: { initData: signedInitData(900_000_000 + unique, 'Участник'), timeZone: 'UTC' },
    })
    expect(memberAuth.ok()).toBe(true)
    const memberId = (await memberAuth.json()).user.id as string
    const today = new Date().toISOString().slice(0, 10)
    const created = await owner.request.post('/api/challenges', {
      data: {
        title: 'Закрытая группа',
        description: '',
        emoji: '🌱',
        type: 'group',
        isPrivate: true,
        durationDays: 7,
        startDate: today,
      },
    })
    expect(created.ok()).toBe(true)
    const details = (await created.json()).challenge as { id: string }
    const challengeId = details.id
    const ownerDetails = await owner.request.get(`/api/challenges/${challengeId}`)
    const inviteUrl = ((await ownerDetails.json()).challenge as { inviteUrl: string }).inviteUrl
    const inviteToken = new URL(inviteUrl).searchParams.get('startapp')?.split('_').at(-1)
    expect(inviteToken).toMatch(/^[a-f0-9]{16}$/)
    expect((await member.request.get(`/api/challenges/${challengeId}`)).status()).toBe(403)
    expect(
      (await member.request.post(`/api/challenges/${challengeId}/join`, { data: {} })).status(),
    ).toBe(403)
    expect(
      (
        await member.request.get(`/api/challenges/${challengeId}`, { params: { inviteToken } })
      ).ok(),
    ).toBe(true)
    expect(
      (
        await member.request.post(`/api/challenges/${challengeId}/join`, { data: { inviteToken } })
      ).ok(),
    ).toBe(true)
    expect(
      (await owner.request.delete(`/api/challenges/${challengeId}/participants/${memberId}`)).ok(),
    ).toBe(true)
    expect(
      (
        await member.request.post(`/api/challenges/${challengeId}/join`, { data: { inviteToken } })
      ).status(),
    ).toBe(403)
    expect(
      (await owner.request.delete(`/api/challenges/${challengeId}/bans/${memberId}`)).ok(),
    ).toBe(true)
    expect(
      (
        await member.request.post(`/api/challenges/${challengeId}/join`, { data: { inviteToken } })
      ).ok(),
    ).toBe(true)
    expect((await owner.request.delete(`/api/challenges/${challengeId}`)).ok()).toBe(true)
  } finally {
    await owner.close()
    await member.close()
  }
})

test('профиль, статистика, конкурентная отметка и удаление аккаунта', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' })
  const unique = Date.now() + Math.floor(Math.random() * 100_000)
  const initData = signedInitData(1_100_000_000 + unique, 'Проверка')
  try {
    expect(
      (
        await context.request.post('/api/auth/telegram', { data: { initData, timeZone: 'UTC' } })
      ).ok(),
    ).toBe(true)
    const profile = await context.request.patch('/api/me', {
      data: { timeZone: 'UTC', reminderEnabled: true, reminderHour: 19 },
    })
    expect((await profile.json()).user.reminderEnabled).toBe(true)
    const today = new Date().toISOString().slice(0, 10)
    const created = await context.request.post('/api/challenges', {
      data: {
        title: 'Проверка статистики',
        description: '',
        emoji: '🌱',
        type: 'personal',
        isPrivate: false,
        durationDays: 7,
        startDate: today,
      },
    })
    const challengeId = (await created.json()).challenge.id as string
    const updated = await context.request.patch(`/api/challenges/${challengeId}`, {
      data: { title: 'Новое название', description: 'Тест', emoji: '📚' },
    })
    expect((await updated.json()).challenge.title).toBe('Новое название')
    const responses = await Promise.all([
      context.request.post(`/api/challenges/${challengeId}/check-ins`, { data: {} }),
      context.request.post(`/api/challenges/${challengeId}/check-ins`, { data: {} }),
    ])
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409])
    const analytics = await context.request.get('/api/analytics')
    expect(await analytics.json()).toMatchObject({ totalCheckIns: 1, last7Days: 1 })
    expect((await context.request.post('/api/auth/logout')).ok()).toBe(true)
    expect((await context.request.get('/api/challenges')).status()).toBe(401)
    expect(
      (
        await context.request.post('/api/auth/telegram', { data: { initData, timeZone: 'UTC' } })
      ).ok(),
    ).toBe(true)
    const sessions = (await (await context.request.get('/api/me/sessions')).json())
      .sessions as Array<{ id: string; current: boolean }>
    expect(sessions.some((item) => item.current)).toBe(true)
    const currentSession = sessions.find((item) => item.current)
    expect((await context.request.delete(`/api/me/sessions/${currentSession?.id}`)).ok()).toBe(true)
    expect((await context.request.get('/api/challenges')).status()).toBe(401)
    expect(
      (
        await context.request.post('/api/auth/telegram', { data: { initData, timeZone: 'UTC' } })
      ).ok(),
    ).toBe(true)
    expect((await context.request.delete('/api/me')).ok()).toBe(true)
    expect((await context.request.get('/api/challenges')).status()).toBe(401)
    expect(
      (
        await context.request.post('/api/auth/telegram', { data: { initData, timeZone: 'UTC' } })
      ).ok(),
    ).toBe(true)
    expect(await (await context.request.get('/api/challenges')).json()).toMatchObject({
      challenges: [],
    })
  } finally {
    await context.close()
  }
})

test('dashboard отдаёт челленджи страницами по 20', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' })
  const unique = Date.now() + Math.floor(Math.random() * 100_000)
  const initData = signedInitData(1_300_000_000 + unique, 'Страницы')
  try {
    expect(
      (
        await context.request.post('/api/auth/telegram', { data: { initData, timeZone: 'UTC' } })
      ).ok(),
    ).toBe(true)
    const today = new Date().toISOString().slice(0, 10)
    for (let index = 0; index < 21; index += 1) {
      const response = await context.request.post('/api/challenges', {
        data: {
          title: `Челлендж ${index}`,
          description: '',
          emoji: '🌱',
          type: 'personal',
          isPrivate: false,
          durationDays: 7,
          startDate: today,
        },
      })
      expect(response.ok()).toBe(true)
    }
    const first = await (await context.request.get('/api/challenges?page=1')).json()
    const second = await (await context.request.get('/api/challenges?page=2')).json()
    expect(first.challenges).toHaveLength(20)
    expect(first.hasMore).toBe(true)
    expect(second.challenges).toHaveLength(1)
    expect(second.hasMore).toBe(false)
  } finally {
    await context.request.delete('/api/me')
    await context.close()
  }
})
