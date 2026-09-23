import { defineStore } from 'pinia'
import type { AuthResponse, UserDto } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import { expand, getInitData, getUserTimeZone, ready } from '~/shared/telegram'

type SessionStatus = 'idle' | 'loading' | 'ready' | 'error' | 'signed-out'

export const useSessionStore = defineStore('session', () => {
  const user = ref<UserDto | null>(null)
  const mode = ref<AuthResponse['mode'] | null>(null)
  const status = ref<SessionStatus>('idle')
  const error = ref<string | null>(null)

  async function initialize(): Promise<void> {
    if (status.value === 'loading' || status.value === 'ready') {
      return
    }

    status.value = 'loading'
    error.value = null
    ready()
    expand()

    try {
      const response = await $fetch<AuthResponse>('/api/auth/telegram', {
        method: 'POST',
        body: { initData: getInitData(), timeZone: getUserTimeZone() },
      })
      user.value = response.user
      mode.value = response.mode
      status.value = 'ready'
    } catch (requestError: unknown) {
      user.value = null
      error.value = getApiErrorMessage(requestError)
      status.value = 'error'
    }
  }

  function setUser(updated: UserDto): void {
    user.value = updated
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    mode.value = null
    status.value = 'signed-out'
  }

  function afterAccountDeletion(): void {
    user.value = null
    mode.value = null
    status.value = 'signed-out'
  }

  return { user, mode, status, error, initialize, setUser, logout, afterAccountDeletion }
})
