<script setup lang="ts">
import type {
  ChallengeDetails,
  ChallengeDetailsResponse,
  LeaderboardEntry,
} from '#shared/types/api'
import CheckInButton from '~/features/check-in/ui/CheckInButton.vue'
import LeaveChallengeAction from '~/features/leave-challenge/ui/LeaveChallengeAction.vue'
import ManageChallengeActions from '~/features/manage-challenge/ui/ManageChallengeActions.vue'
import ShareChallengeButton from '~/features/share-challenge/ui/ShareChallengeButton.vue'
import { getApiErrorMessage } from '~/shared/api/error'
import { useRefreshOnResume } from '~/shared/lib/useRefreshOnResume'

const props = defineProps<{
  challengeId: string
}>()

const session = useSessionStore()
const challenge = ref<ChallengeDetails | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const moderationError = ref<string | null>(null)
const bannedUsers = ref<Array<{ id: string; firstName: string }>>([])
const leaderboardPage = ref(1)
const leaderboardLoading = ref(false)

async function loadMoreLeaderboard(): Promise<void> {
  if (!challenge.value || leaderboardLoading.value) return
  leaderboardLoading.value = true
  moderationError.value = null
  try {
    const nextPage = leaderboardPage.value + 1
    const response = await $fetch<{ participants: LeaderboardEntry[]; hasMore: boolean }>(
      `/api/challenges/${challenge.value.id}/participants`,
      { query: { page: nextPage } },
    )
    challenge.value.leaderboard.push(...response.participants)
    challenge.value.leaderboardHasMore = response.hasMore
    leaderboardPage.value = nextPage
  } catch (requestError: unknown) {
    moderationError.value = getApiErrorMessage(requestError)
  } finally {
    leaderboardLoading.value = false
  }
}

async function removeParticipant(userId: string): Promise<void> {
  if (!challenge.value || !window.confirm('Исключить участника и удалить его отметки?')) return
  moderationError.value = null
  try {
    await $fetch(`/api/challenges/${challenge.value.id}/participants/${userId}`, {
      method: 'DELETE',
    })
    await loadChallenge()
    await loadBans()
  } catch (requestError: unknown) {
    moderationError.value = getApiErrorMessage(requestError)
  }
}

async function loadBans(): Promise<void> {
  if (!challenge.value?.isOwner || challenge.value.type !== 'group') return
  try {
    bannedUsers.value = (
      await $fetch<{ users: typeof bannedUsers.value }>(
        `/api/challenges/${challenge.value.id}/bans`,
      )
    ).users
  } catch (requestError: unknown) {
    moderationError.value = getApiErrorMessage(requestError)
  }
}

async function unban(userId: string): Promise<void> {
  if (!challenge.value) return
  moderationError.value = null
  try {
    await $fetch(`/api/challenges/${challenge.value.id}/bans/${userId}`, { method: 'DELETE' })
    await loadBans()
  } catch (requestError: unknown) {
    moderationError.value = getApiErrorMessage(requestError)
  }
}

const phaseText = computed(() => {
  if (!challenge.value) return ''
  if (challenge.value.phase === 'scheduled') return `Старт ${formatDate(challenge.value.startDate)}`
  if (challenge.value.phase === 'completed') return 'Челлендж завершён'
  return `День ${challenge.value.currentDay} из ${challenge.value.durationDays}`
})

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`))
}

async function loadChallenge(): Promise<void> {
  if (session.status !== 'ready' || loading.value) return
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<ChallengeDetailsResponse>(`/api/challenges/${props.challengeId}`)
    challenge.value = response.challenge
    leaderboardPage.value = 1
    await loadBans()
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    loading.value = false
  }
}

useRefreshOnResume(loadChallenge, () => [
  session.user?.timeZone ?? 'UTC',
  challenge.value?.timeZone ?? 'UTC',
])

watch(
  [() => session.status, () => props.challengeId],
  ([status]) => {
    if (status === 'ready') void loadChallenge()
  },
  { immediate: true },
)
</script>

<template>
  <section class="details-page">
    <NuxtLink to="/" class="back-link">← Все челленджи</NuxtLink>

    <div
      v-if="loading || session.status === 'loading' || session.status === 'idle'"
      class="details-loading"
    >
      <div class="skeleton hero-skeleton" />
      <div class="skeleton" />
    </div>

    <div v-else-if="error || session.error" class="error-box">
      {{ error || session.error }}
      <button class="retry" type="button" @click="loadChallenge">Повторить</button>
    </div>

    <template v-else-if="challenge">
      <header class="challenge-hero">
        <div class="hero-topline">
          <span class="hero-emoji">{{ challenge.emoji }}</span>
          <span class="eyebrow">{{ challenge.type === 'group' ? 'Вместе' : 'Личный ритм' }}</span>
        </div>
        <h1>{{ challenge.title }}</h1>
        <p v-if="challenge.description" class="description">
          {{ challenge.description }}
        </p>
        <p class="phase-text">{{ phaseText }}</p>
      </header>

      <section class="progress-card card">
        <div class="progress-number">
          <strong>{{ challenge.progress }}</strong
          ><span>%</span>
        </div>
        <div class="progress-copy">
          <span>твой прогресс</span>
          <div class="progress-track">
            <i :style="{ width: `${challenge.progress}%` }" />
          </div>
        </div>
        <div class="mini-stat">
          <strong>{{ challenge.streak }}</strong
          ><span>дней<br />подряд</span>
        </div>
      </section>

      <CheckInButton
        v-if="challenge.isParticipant"
        :challenge="challenge"
        @updated="challenge = $event"
      />

      <section class="history-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">История</span>
            <h2>Твои отметки</h2>
          </div>
          <strong>{{ challenge.completedDays }}/{{ challenge.durationDays }}</strong>
        </div>
        <div v-if="challenge.checkIns.length" class="history-list card">
          <div v-for="checkIn in challenge.checkIns" :key="checkIn.id" class="history-row">
            <span class="day-dot">✓</span>
            <span>{{ formatDate(checkIn.date) }}</span>
            <small>выполнено</small>
          </div>
        </div>
        <div v-else class="quiet-empty">Первая отметка появится здесь.</div>
      </section>

      <section
        v-if="challenge.type === 'group' && challenge.isParticipant"
        class="leaderboard-section"
      >
        <div class="section-heading">
          <div>
            <span class="eyebrow">Команда</span>
            <h2>Лидерборд</h2>
          </div>
          <span class="people-count">{{ challenge.participantsCount }} участн.</span>
        </div>
        <ol class="leaderboard card">
          <li
            v-for="entry in challenge.leaderboard"
            :key="entry.user.id"
            :class="{ current: entry.isCurrentUser }"
          >
            <span class="rank">{{ entry.rank }}</span>
            <span class="avatar">{{ entry.user.firstName.slice(0, 1).toUpperCase() }}</span>
            <span class="person-name"
              >{{ entry.user.firstName }}<small v-if="entry.isCurrentUser">это ты</small></span
            >
            <strong>{{ entry.completedDays }} <small>дн.</small></strong>
          </li>
        </ol>
        <button
          v-if="challenge.leaderboardHasMore"
          type="button"
          class="button-ghost"
          :disabled="leaderboardLoading"
          @click="loadMoreLeaderboard"
        >
          {{ leaderboardLoading ? 'Загрузка…' : 'Показать ещё участников' }}
        </button>
        <ShareChallengeButton
          v-if="challenge.inviteUrl"
          :url="challenge.inviteUrl"
          :title="challenge.title"
        />
        <p v-else-if="challenge.phase !== 'completed'" class="invite-hint">
          Для приглашения настройте имя бота в `NUXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
        </p>
      </section>
      <ManageChallengeActions
        v-if="challenge.isOwner"
        :challenge="challenge"
        @updated="challenge = $event"
        @deleted="navigateTo('/')"
      />
      <section
        v-if="challenge.type === 'group' && challenge.isOwner && challenge.phase !== 'completed'"
        class="card moderation"
      >
        <h2>Участники</h2>
        <p>Исключённый участник теряет отметки и не сможет вступить снова.</p>
        <div
          v-for="entry in challenge.leaderboard.filter((row) => !row.isCurrentUser)"
          :key="entry.user.id"
          class="moderation-row"
        >
          <span>{{ entry.user.firstName }}</span>
          <button type="button" class="button-ghost" @click="removeParticipant(entry.user.id)">
            Исключить
          </button>
        </div>
        <p v-if="challenge.leaderboard.length <= 1 && bannedUsers.length === 0">
          Других участников пока нет.
        </p>
        <template v-if="bannedUsers.length"
          ><h3>Исключённые</h3>
          <div v-for="user in bannedUsers" :key="user.id" class="moderation-row">
            <span>{{ user.firstName }}</span
            ><button type="button" class="button-ghost" @click="unban(user.id)">
              Разрешить вступить
            </button>
          </div></template
        >
        <p v-if="moderationError" role="alert" class="action-error">{{ moderationError }}</p>
      </section>
      <LeaveChallengeAction
        v-else-if="
          challenge.type === 'group' && challenge.isParticipant && challenge.phase !== 'completed'
        "
        :challenge-id="challenge.id"
        :challenge-title="challenge.title"
        @left="navigateTo('/')"
      />
    </template>
  </section>
</template>

<style scoped>
.details-page {
  display: grid;
  gap: 25px;
}
.moderation {
  padding: 20px;
}
.moderation h2 {
  margin: 0;
  font-size: 1.2rem;
}
.moderation p {
  color: var(--muted);
  font-size: 0.8rem;
}
.moderation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
}
.moderation-row button {
  min-height: 40px;
}
.action-error {
  color: var(--danger) !important;
}
.back-link {
  color: var(--muted);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 750;
}
.details-loading {
  display: grid;
  gap: 14px;
}
.hero-skeleton {
  min-height: 260px;
}
.retry {
  display: block;
  margin-top: 8px;
  border: 0;
  padding: 0;
  color: var(--accent);
  background: transparent;
  font-weight: 800;
  cursor: pointer;
}
.challenge-hero {
  padding: 46px 0 24px;
}
.hero-topline {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hero-emoji {
  font-size: 2.4rem;
}
h1 {
  margin: 18px 0 13px;
  max-width: 650px;
  font-family: Georgia, serif;
  font-size: clamp(2.7rem, 13vw, 5.4rem);
  line-height: 0.92;
  letter-spacing: -0.06em;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.description {
  margin: 0 0 13px;
  max-width: 520px;
  color: var(--muted);
  line-height: 1.55;
}
.phase-text {
  margin: 0;
  font-weight: 800;
  font-size: 0.84rem;
}
.progress-card {
  padding: 20px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 18px;
  align-items: center;
}
.progress-number {
  display: flex;
  align-items: flex-start;
}
.progress-number strong {
  font-family: Georgia, serif;
  font-size: 3.3rem;
  line-height: 0.8;
  font-weight: 500;
}
.progress-number span {
  color: var(--muted);
}
.progress-copy {
  display: grid;
  gap: 9px;
  color: var(--muted);
  font-size: 0.7rem;
}
.progress-track {
  height: 7px;
  background: var(--line);
  border-radius: 99px;
  overflow: hidden;
}
.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}
.mini-stat {
  padding-left: 17px;
  border-left: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 7px;
}
.mini-stat strong {
  font-family: Georgia, serif;
  font-size: 2rem;
  font-weight: 500;
}
.mini-stat span {
  color: var(--muted);
  font-size: 0.65rem;
  line-height: 1.2;
}
.history-section,
.leaderboard-section {
  display: grid;
  gap: 14px;
  padding-top: 15px;
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
}
.section-heading h2 {
  margin: 5px 0 0;
  font-family: Georgia, serif;
  font-size: 1.7rem;
  font-weight: 500;
}
.section-heading > strong {
  font-family: Georgia, serif;
  font-size: 1.4rem;
}
.history-list {
  padding: 6px 17px;
}
.history-row {
  min-height: 54px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 11px;
  align-items: center;
  border-bottom: 1px solid var(--line);
}
.history-row:last-child {
  border-bottom: 0;
}
.day-dot {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--accent);
  background: var(--accent-soft);
  font-size: 0.72rem;
  font-weight: 900;
}
.history-row small,
.people-count {
  color: var(--muted);
  font-size: 0.7rem;
}
.quiet-empty {
  padding: 24px;
  border: 1px dashed var(--line);
  border-radius: 18px;
  color: var(--muted);
  text-align: center;
}
.leaderboard {
  list-style: none;
  margin: 0;
  padding: 6px 14px;
}
.leaderboard li {
  min-height: 64px;
  display: grid;
  grid-template-columns: 24px 38px 1fr auto;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid var(--line);
}
.leaderboard li:last-child {
  border-bottom: 0;
}
.leaderboard li.current {
  color: var(--accent);
}
.rank {
  color: var(--muted);
  font-size: 0.75rem;
  text-align: center;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  font-family: Georgia, serif;
}
.person-name {
  display: grid;
  font-weight: 750;
}
.person-name small,
.leaderboard strong small {
  color: var(--muted);
  font-size: 0.63rem;
  font-weight: 600;
}
.invite-hint {
  color: var(--muted);
  font-size: 0.72rem;
  text-align: center;
}
@media (max-width: 430px) {
  .progress-card {
    grid-template-columns: auto 1fr;
  }
  .mini-stat {
    grid-column: 1 / -1;
    border-left: 0;
    border-top: 1px solid var(--line);
    padding: 13px 0 0;
  }
}
</style>
