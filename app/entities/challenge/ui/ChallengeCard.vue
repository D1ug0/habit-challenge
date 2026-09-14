<script setup lang="ts">
import type { ChallengeSummary } from '#shared/types/api'

defineProps<{
  challenge: ChallengeSummary
}>()

const phaseLabels = {
  scheduled: 'Скоро начнётся',
  active: 'Идёт сейчас',
  completed: 'Завершён',
} as const
</script>

<template>
  <NuxtLink :to="`/challenges/${challenge.id}`" class="challenge-card card">
    <div class="challenge-topline">
      <span class="challenge-emoji" aria-hidden="true">{{ challenge.emoji }}</span>
      <span class="phase">{{ phaseLabels[challenge.phase] }}</span>
      <span v-if="challenge.checkedInToday" class="done-mark" title="Сегодня выполнено">✓</span>
    </div>
    <div>
      <h2>{{ challenge.title }}</h2>
      <p>
        {{ challenge.completedDays }} из {{ challenge.durationDays }} дней · серия
        {{ challenge.streak }}
      </p>
    </div>
    <div class="progress-track" :aria-label="`Прогресс ${challenge.progress}%`">
      <span :style="{ width: `${challenge.progress}%` }" />
    </div>
    <div class="card-footer">
      <span>{{ challenge.progress }}%</span>
      <span v-if="challenge.type === 'group'">{{ challenge.participantsCount }} участн.</span>
      <span v-else>личный</span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.challenge-card {
  color: var(--text);
  text-decoration: none;
  padding: 18px;
  min-height: 190px;
  display: grid;
  gap: 20px;
  align-content: space-between;
}

.challenge-topline,
.card-footer {
  display: flex;
  align-items: center;
}

.challenge-topline {
  gap: 10px;
}

.challenge-emoji {
  font-size: 1.8rem;
}

.phase {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 750;
}

.done-mark {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 900;
}

h2 {
  margin: 0 0 7px;
  font-family: Georgia, serif;
  font-size: 1.45rem;
  line-height: 1.08;
  letter-spacing: -0.025em;
}

p {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.progress-track {
  height: 7px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--line);
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.card-footer {
  justify-content: space-between;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 750;
}
</style>
