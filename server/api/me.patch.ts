import type { UserDto } from '#shared/types/api'
import { profileSettingsSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../database'
import { toUserDto, updateUserSettings } from '../repositories/user-repository'
import { parseBody } from '../utils/api-error'
import { requireUser } from '../utils/session'
import { enforceMutationRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async (event): Promise<{ user: UserDto }> => {
  const user = await requireUser(event)
  await enforceMutationRateLimit(event, user.id)
  const input = await parseBody(event, profileSettingsSchema)
  return { user: toUserDto(await updateUserSettings(getDatabase(event), user.id, input)) }
})
