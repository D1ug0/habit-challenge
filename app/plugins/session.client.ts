import { getLaunchChallenge } from '~/shared/telegram'

export default defineNuxtPlugin(() => {
  const session = useSessionStore()
  onNuxtReady(async () => {
    await session.initialize()

    const challenge = getLaunchChallenge()
    const route = useRoute()
    if (session.status === 'ready' && challenge && route.path === '/') {
      await navigateTo({
        path: `/join/${challenge.id}`,
        query: challenge.inviteToken ? { inviteToken: challenge.inviteToken } : {},
      })
    }
  })
})
