import { expect, test } from '@playwright/test'

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

test('пользователь создаёт челлендж и отмечает выполнение', async ({ page }) => {
  const title = `Читать каждый день ${Date.now()}`
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Привет/ })).toBeVisible()
  await page.getByRole('link', { name: 'Создать челлендж' }).click()
  await page.getByLabel('Название').fill(title)
  await page.getByRole('button', { name: 'Начать челлендж' }).click()

  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Выполнено сегодня' }).click()
  await expect(page.getByRole('button', { name: 'Сегодня выполнено ✓' })).toBeDisabled()

  const challengeId = new URL(page.url()).pathname.split('/').at(-1)
  const duplicateResponse = await page.request.post(`/api/challenges/${challengeId}/check-ins`, {
    data: {},
  })
  expect(duplicateResponse.status()).toBe(409)
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
