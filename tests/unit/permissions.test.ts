import { describe, expect, it } from 'vitest'
import { canJoinChallenge, canPreviewChallenge, canViewChallenge } from '../../shared/domain/permissions'

const personal = { ownerId: 'owner', type: 'personal' as const }
const group = { ownerId: 'owner', type: 'group' as const }

describe('права доступа', () => {
  it('разрешает владельцу и участнику просматривать детали', () => {
    expect(canViewChallenge('owner', personal, [])).toBe(true)
    expect(canViewChallenge('member', group, ['member'])).toBe(true)
  })

  it('скрывает личный челлендж и разрешает preview группового', () => {
    expect(canPreviewChallenge('stranger', personal, [])).toBe(false)
    expect(canPreviewChallenge('stranger', group, [])).toBe(true)
  })

  it('не разрешает повторное участие или вступление в личный челлендж', () => {
    expect(canJoinChallenge('stranger', personal, [])).toBe(false)
    expect(canJoinChallenge('member', group, ['member'])).toBe(false)
    expect(canJoinChallenge('stranger', group, [])).toBe(true)
  })
})
