<script setup lang="ts">
import type {
  ChallengeDetails,
  ChallengeDetailsResponse,
  JoinChallengeResponse,
} from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import { impactFeedback } from '~/shared/telegram'

const props = defineProps<{
  challengeId: string
  inviteToken?: string
}>()

const session = useSessionStore()
const challenge = ref<ChallengeDetails | null>(null)
const loading = ref(false)
const joining = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  if (session.status !== 'ready') return
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<ChallengeDetailsResponse>(
      `/api/challenges/${props.challengeId}`,
      { query: props.inviteToken ? { inviteToken: props.inviteToken } : {} },
    )
    challenge.value = response.challenge
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    loading.value = false
  }
}

async function join(): Promise<void> {
  joining.value = true
  error.value = null
  try {
    const response = await $fetch<JoinChallengeResponse>(
      `/api/challenges/${props.challengeId}/join`,
      {
        method: 'POST',
        body: props.inviteToken ? { inviteToken: props.inviteToken } : {},
      },
    )
    challenge.value = response.challenge
    impactFeedback()
    await navigateTo(`/challenges/${props.challengeId}`)
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    joining.value = false
  }
}

watch(
  [() => session.status, () => props.challengeId],
  ([status]) => {
    if (status === 'ready') void load()
  },
  { immediate: true },
)
</script>

<template>
  <section class="join-page">
    <NuxtLink to="/" class="back-link">← На главную</NuxtLink>
    <div
      v-if="loading || session.status === 'loading' || session.status === 'idle'"
      class="skeleton join-skeleton"
    />
    <div v-else-if="error || session.error" class="error-box">
      {{ error || session.error }}
      <button class="retry" type="button" @click="load">Повторить</button>
    </div>
    <div v-else-if="challenge" class="invite-card card">
      <span class="invite-label">Тебя приглашают</span>
      <span class="invite-emoji">{{ challenge.emoji }}</span>
      <h1>{{ challenge.title }}</h1>
      <p>{{ challenge.description || 'Будем двигаться к цели вместе — по одному дню за раз.' }}</p>
      <div class="invite-meta">
        <span
          ><strong>{{ challenge.durationDays }}</strong> дней</span
        >
        <span
          ><strong>{{ challenge.participantsCount }}</strong> участн.</span
        >
        <span
          ><strong>{{ challenge.currentDay }}</strong> день</span
        >
      </div>
      <NuxtLink
        v-if="challenge.isParticipant"
        :to="`/challenges/${challenge.id}`"
        class="button-secondary action"
      >
        Открыть челлендж
      </NuxtLink>
      <button
        v-else
        class="button-primary action"
        type="button"
        :disabled="joining || challenge.phase === 'completed'"
        @click="join"
      >
        {{
          joining
            ? 'Присоединяем…'
            : challenge.phase === 'completed'
              ? 'Челлендж завершён'
              : 'Присоединиться'
        }}
      </button>
      <small>Никаких лишних уведомлений — только твои ежедневные отметки.</small>
    </div>
  </section>
</template>

<style scoped>
.join-page {
  display: grid;
  gap: 22px;
}
.back-link {
  color: var(--muted);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 750;
}
.join-skeleton {
  min-height: 520px;
}
.retry {
  display: block;
  margin-top: 8px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--accent);
  font-weight: 800;
  cursor: pointer;
}
.invite-card {
  min-height: min(620px, calc(100dvh - 135px));
  padding: 38px 24px 25px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.invite-label {
  color: var(--accent);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.13em;
  font-weight: 850;
}
.invite-emoji {
  margin: 34px 0 18px;
  font-size: 4.7rem;
  filter: drop-shadow(0 12px 13px rgba(0, 0, 0, 0.08));
}
h1 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: clamp(2.5rem, 12vw, 4.5rem);
  line-height: 0.95;
  letter-spacing: -0.055em;
  font-weight: 500;
  overflow-wrap: anywhere;
}
p {
  max-width: 440px;
  margin: 18px 0 30px;
  color: var(--muted);
  line-height: 1.55;
}
.invite-meta {
  width: min(100%, 410px);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 28px;
  border-block: 1px solid var(--line);
  padding: 14px 0;
}
.invite-meta span {
  display: grid;
  color: var(--muted);
  font-size: 0.66rem;
  border-right: 1px solid var(--line);
}
.invite-meta span:last-child {
  border-right: 0;
}
.invite-meta strong {
  color: var(--text);
  font-family: Georgia, serif;
  font-size: 1.4rem;
  font-weight: 500;
}
.action {
  width: min(100%, 410px);
}
.invite-card > small {
  margin-top: 16px;
  color: var(--muted);
  max-width: 310px;
  line-height: 1.4;
}
</style>
