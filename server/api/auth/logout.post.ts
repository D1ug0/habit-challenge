import { clearUserSession } from '../../utils/session'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await clearUserSession(event)
  return { ok: true }
})
