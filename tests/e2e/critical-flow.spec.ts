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
