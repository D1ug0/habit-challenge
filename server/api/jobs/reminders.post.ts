import { getDatabase } from '../../database'
import { sendDueReminders } from '../../services/reminder-service'
import { apiError } from '../../utils/api-error'
import { getServerConfig } from '../../utils/config'
import { requireBearer } from '../../utils/bearer'

export default defineEventHandler(async (event): Promise<{ sent: number; failed: number }> => {
  const config = getServerConfig(event)
  if (!config.telegramBotToken) {
    apiError(503, 'REMINDERS_NOT_CONFIGURED', 'Напоминания не настроены')
  }
  requireBearer(event, config.reminderJobSecret)
  return sendDueReminders(getDatabase(event), config.telegramBotToken)
})
