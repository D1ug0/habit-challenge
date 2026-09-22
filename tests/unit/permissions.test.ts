import { describe, expect, it } from 'vitest'
import {
  canJoinChallenge,
  canLeaveChallenge,
  canManageChallenge,
  canPreviewChallenge,
  canViewChallenge,
} from '../../shared/domain/permissions'

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

  it('разрешает управление только создателю', () => {
    expect(canManageChallenge('owner', group)).toBe(true)
    expect(canManageChallenge('member', group)).toBe(false)
  })

  it('разрешает выйти только участнику группового челленджа', () => {
    expect(canLeaveChallenge('member', group, ['member'])).toBe(true)
    expect(canLeaveChallenge('owner', group, ['owner'])).toBe(false)
    expect(canLeaveChallenge('stranger', group, ['member'])).toBe(false)
    expect(canLeaveChallenge('member', personal, ['member'])).toBe(false)
  })
})
