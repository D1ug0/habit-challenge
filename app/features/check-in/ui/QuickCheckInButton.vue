<script setup lang="ts">
import type { ChallengeSummary, CheckInResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import { impactFeedback } from '~/shared/telegram'

const props = defineProps<{
  challenge: ChallengeSummary
}>()

const emit = defineEmits<{
  updated: [challenge: ChallengeSummary]
}>()

const loading = ref(false)
const error = ref<string | null>(null)

async function checkIn(): Promise<void> {
  if (loading.value || props.challenge.checkedInToday || props.challenge.phase !== 'active') return

  loading.value = true
  error.value = null
  try {
    const response = await $fetch<CheckInResponse>(
      `/api/challenges/${props.challenge.id}/check-ins`,
      {
        method: 'POST',
        body: {},
      },
    )
    emit('updated', response.challenge)
    impactFeedback()
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="quick-check-in">
    <button
      type="button"
      class="quick-check-in-button"
      :class="{ completed: challenge.checkedInToday }"
      :disabled="loading || challenge.checkedInToday"
      :aria-label="
        challenge.checkedInToday
          ? `${challenge.title}: сегодня выполнено`
          : `Отметить «${challenge.title}» выполненным сегодня`
      "
      @click="checkIn"
    >
      <span aria-hidden="true">{{ challenge.checkedInToday ? '✓' : '↗' }}</span>
      {{ loading ? 'Отмечаем…' : challenge.checkedInToday ? 'На сегодня готово' : 'Выполнено' }}
    </button>
    <p v-if="error" class="quick-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.quick-check-in {
  display: grid;
  gap: 7px;
}

.quick-check-in-button {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 150ms ease,
    opacity 150ms ease;
}

.quick-check-in-button:active:not(:disabled) {
  transform: scale(0.98);
}

.quick-check-in-button.completed {
  background: var(--accent-soft);
  color: var(--accent);
  opacity: 1;
}

.quick-error {
  margin: 0;
  padding: 0 4px;
  color: var(--danger);
  font-size: 0.72rem;
  line-height: 1.35;
  text-align: center;
}
</style>
