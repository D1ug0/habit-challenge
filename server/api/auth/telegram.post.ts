import type { AuthResponse } from '#shared/types/api'
import { telegramAuthSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../database'
import { toUserDto, upsertTelegramUser } from '../../repositories/user-repository'
import { apiError, asConfigurationError, parseBody } from '../../utils/api-error'
import { getServerConfig } from '../../utils/config'
import { enforceAuthRateLimit } from '../../utils/rate-limit'
import { setUserSession } from '../../utils/session'
import { validateTelegramInitData } from '../../utils/telegram-auth'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  try {
    enforceAuthRateLimit(event)
    const body = await parseBody(event, telegramAuthSchema)
    const config = getServerConfig(event)
    let mode: AuthResponse['mode']
    let identity

    if (body.initData) {
      if (!config.telegramBotToken) {
        apiError(503, 'TELEGRAM_NOT_CONFIGURED', 'Telegram-бот пока не настроен')
      }

      identity = validateTelegramInitData(
        body.initData,
        config.telegramBotToken,
        config.authMaxAgeSeconds,
      )
      if (!identity) {
        apiError(401, 'INVALID_TELEGRAM_DATA', 'Не удалось подтвердить данные Telegram')
      }
      mode = 'telegram'
    } else {
      if (!config.demoMode) {
        apiError(401, 'TELEGRAM_REQUIRED', 'Откройте приложение из Telegram')
      }
      identity = {
        telegramId: '999000001',
        username: 'demo_habit',
        firstName: 'Алекс',
        lastName: null,
        photoUrl: null,
      }
      mode = 'demo'
    }

    const user = await upsertTelegramUser(getDatabase(event), {
      ...identity,
      timeZone: body.timeZone,
    })
    setUserSession(event, user.id)

    return { user: toUserDto(user), mode }
  } catch (error: unknown) {
    asConfigurationError(error)
  }
})
