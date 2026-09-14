import type { H3Event } from 'h3'
import { challengeIdSchema } from '#shared/schemas/challenge'
import { apiError } from './api-error'

export function getChallengeId(event: H3Event): string {
  const result = challengeIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!result.success) {
    apiError(400, 'INVALID_CHALLENGE_ID', 'Некорректный идентификатор челленджа')
  }
  return result.data
}
