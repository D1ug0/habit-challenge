<script setup lang="ts">
import type { ChallengeListResponse, ChallengeSummary } from '#shared/types/api'
import { sortChallengesForDashboard } from '~/entities/challenge/model/sort-challenges'
import ChallengeCard from '~/entities/challenge/ui/ChallengeCard.vue'
import QuickCheckInButton from '~/features/check-in/ui/QuickCheckInButton.vue'
import { getApiErrorMessage } from '~/shared/api/error'

const session = useSessionStore()
const challenges = ref<ChallengeSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const activeChallenges = computed(
  () => challenges.value.filter((challenge) => challenge.phase === 'active').length,
)
const bestStreak = computed(() =>
  Math.max(0, ...challenges.value.map((challenge) => challenge.streak)),
)
const orderedChallenges = computed(() => sortChallengesForDashboard(challenges.value))

function updateChallenge(updatedChallenge: ChallengeSummary): void {
  const challengeIndex = challenges.value.findIndex(
    (challenge) => challenge.id === updatedChallenge.id,
  )
  if (challengeIndex === -1) return

  challenges.value.splice(challengeIndex, 1, updatedChallenge)
}

async function loadChallenges(): Promise<void> {
  if (session.status !== 'ready') {
    return
  }
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<ChallengeListResponse>('/api/challenges')
    challenges.value = response.challenges
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    loading.value = false
  }
}

watch(
  () => session.status,
  (status) => {
    if (status === 'ready') {
      void loadChallenges()
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="dashboard">
    <div class="hero">
      <div>
        <p class="eyebrow">Твой ритм</p>
        <h1 class="page-title">
          Привет<span v-if="session.user">,<br />{{ session.user.firstName }}</span>
        </h1>
      </div>
      <NuxtLink to="/challenges/new" class="create-button" aria-label="Создать челлендж">
        <span>+</span>
      </NuxtLink>
    </div>

    <div v-if="session.mode === 'demo'" class="demo-note">
      Demo-режим · данные сохраняются в локальной PostgreSQL
    </div>

    <div
      v-if="session.status === 'loading' || session.status === 'idle'"
      class="loading-grid"
      aria-label="Загрузка"
    >
      <div class="skeleton" />
      <div class="skeleton" />
    </div>

    <div v-else-if="session.status === 'error'" class="error-box">
      <strong>Не удалось войти</strong><br />
      {{ session.error }}
      <button class="retry-link" type="button" @click="session.initialize">Повторить</button>
    </div>

    <template v-else>
      <div class="stats-strip">
        <div>
          <strong>{{ activeChallenges }}</strong>
          <span>активных</span>
        </div>
        <div>
          <strong>{{ bestStreak }}</strong>
          <span>лучшая серия</span>
        </div>
        <div>
          <strong>{{ challenges.length }}</strong>
          <span>всего</span>
        </div>
      </div>

      <div class="section-heading">
        <h2>Челленджи</h2>
        <button v-if="error" type="button" @click="loadChallenges">Обновить</button>
      </div>

      <div v-if="loading" class="loading-grid" aria-label="Загрузка челленджей">
        <div class="skeleton" />
        <div class="skeleton" />
      </div>

      <div v-else-if="error" class="error-box">{{ error }}</div>

      <div v-else-if="challenges.length" class="challenge-grid">
        <ChallengeCard
          v-for="challenge in orderedChallenges"
          :key="challenge.id"
          :challenge="challenge"
        >
          <template v-if="challenge.phase === 'active'" #action>
            <QuickCheckInButton :challenge="challenge" @updated="updateChallenge" />
          </template>
        </ChallengeCard>
      </div>

      <div v-else class="empty-state card">
        <span class="empty-icon">↗</span>
        <h2>Начни с малого</h2>
        <p>Выбери действие, которое хочется повторять. Семь дней — отличный первый шаг.</p>
        <NuxtLink to="/challenges/new" class="button-primary">Создать первый челлендж</NuxtLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 26px;
}
.hero {
  min-height: 245px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}
.create-button {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: none;
  background: var(--accent);
  color: var(--accent-text);
  text-decoration: none;
  box-shadow: 0 12px 30px color-mix(in srgb, var(--accent) 25%, transparent);
}
.create-button span {
  font-size: 2.1rem;
  font-weight: 300;
  margin-top: -4px;
}
.demo-note {
  width: fit-content;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 99px;
  padding: 7px 11px;
  font-size: 0.7rem;
}
.stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--line);
  padding: 17px 0;
}
.stats-strip div {
  display: grid;
  gap: 2px;
  text-align: center;
  border-right: 1px solid var(--line);
}
.stats-strip div:last-child {
  border-right: 0;
}
.stats-strip strong {
  font-family: Georgia, serif;
  font-size: 1.65rem;
  font-weight: 500;
}
.stats-strip span {
  color: var(--muted);
  font-size: 0.67rem;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-heading h2 {
  margin: 0;
  font-size: 1rem;
}
.section-heading button,
.retry-link {
  border: 0;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-weight: 750;
}
.retry-link {
  display: block;
  padding: 10px 0 0;
}
.challenge-grid,
.loading-grid {
  display: grid;
  gap: 13px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.empty-state {
  padding: 30px 24px;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 13px;
}
.empty-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 19px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 1.8rem;
}
.empty-state h2 {
  margin: 4px 0 0;
  font-family: Georgia, serif;
  font-size: 1.65rem;
}
.empty-state p {
  margin: 0 0 8px;
  color: var(--muted);
  line-height: 1.5;
  max-width: 390px;
}
@media (max-width: 540px) {
  .challenge-grid,
  .loading-grid {
    grid-template-columns: 1fr;
  }
  .hero {
    min-height: 210px;
  }
}
</style>
