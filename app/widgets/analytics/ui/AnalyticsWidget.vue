<script setup lang="ts">
import type { AnalyticsResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'

const session = useSessionStore()
const data = ref<AnalyticsResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const maxCount = computed(() => Math.max(1, ...(data.value?.days.map((day) => day.count) ?? [])))

async function load(): Promise<void> {
  if (session.status !== 'ready') return
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch<AnalyticsResponse>('/api/analytics')
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause)
  } finally {
    loading.value = false
  }
}

watch(
  () => session.status,
  (status) => {
    if (status === 'ready') void load()
  },
  { immediate: true },
)
</script>

<template>
  <section class="analytics-page">
    <NuxtLink to="/">← На главную</NuxtLink>
    <header>
      <p class="eyebrow">Статистика</p>
      <h1>Твой ритм за месяц</h1>
    </header>
    <div v-if="loading || session.status === 'loading'" class="skeleton" />
    <div v-else-if="error" class="error-box">
      {{ error }} <button type="button" @click="load">Повторить</button>
    </div>
    <template v-else-if="data">
      <div class="stats card">
        <div>
          <strong>{{ data.totalCheckIns }}</strong
          ><span>всего отметок</span>
        </div>
        <div>
          <strong>{{ data.last7Days }}</strong
          ><span>за 7 дней</span>
        </div>
        <div>
          <strong>{{ data.last30Days }}</strong
          ><span>за 30 дней</span>
        </div>
      </div>
      <div class="card chart-card">
        <h2>Активность по дням</h2>
        <p v-if="data.last30Days === 0">За последний месяц отметок пока нет.</p>
        <div class="chart" role="img" :aria-label="`За 30 дней сделано ${data.last30Days} отметок`">
          <div
            v-for="day in data.days"
            :key="day.date"
            class="bar-slot"
            :title="`${day.date}: ${day.count}`"
          >
            <span
              :style="{ height: `${Math.max(4, (day.count / maxCount) * 100)}%` }"
              :class="{ empty: day.count === 0 }"
            />
          </div>
        </div>
        <div class="chart-labels"><span>30 дней назад</span><span>Сегодня</span></div>
      </div>
      <p>
        {{ data.activeChallenges }} активных · {{ data.completedChallenges }} завершённых челленджей
      </p>
    </template>
  </section>
</template>

<style scoped>
.analytics-page {
  display: grid;
  gap: 22px;
}
.analytics-page > a {
  color: var(--muted);
  text-decoration: none;
}
h1 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: clamp(2.4rem, 10vw, 4rem);
}
h2 {
  margin: 0;
  font-size: 1rem;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 20px;
  gap: 8px;
}
.stats div {
  display: grid;
  gap: 5px;
  text-align: center;
}
.stats strong {
  font-family: Georgia, serif;
  font-size: 2rem;
}
.stats span,
.chart-labels,
.chart-card p {
  color: var(--muted);
  font-size: 0.75rem;
}
.chart-card {
  padding: 20px;
  display: grid;
  gap: 14px;
}
.chart {
  height: 140px;
  display: grid;
  grid-template-columns: repeat(30, 1fr);
  align-items: end;
  gap: 3px;
}
.bar-slot {
  height: 100%;
  display: flex;
  align-items: end;
}
.bar-slot span {
  display: block;
  width: 100%;
  background: var(--accent);
  border-radius: 4px 4px 0 0;
}
.bar-slot span.empty {
  background: var(--line);
}
.chart-labels {
  display: flex;
  justify-content: space-between;
}
</style>
