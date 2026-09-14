import { getLaunchChallengeId } from '~/shared/telegram'

export default defineNuxtPlugin(() => {
  const session = useSessionStore()
  onNuxtReady(async () => {
    await session.initialize()

    const challengeId = getLaunchChallengeId()
    const route = useRoute()
    if (session.status === 'ready' && challengeId && route.path === '/') {
      await navigateTo(`/join/${challengeId}`)
    }
  })
})
