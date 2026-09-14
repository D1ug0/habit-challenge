<script setup lang="ts">
import type { ChallengeDetails, CheckInResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import { impactFeedback } from '~/shared/telegram'

const props = defineProps<{
  challenge: ChallengeDetails
}>()

const emit = defineEmits<{
  updated: [challenge: ChallengeDetails]
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const label = computed(() => {
  if (props.challenge.phase === 'scheduled') return 'Челлендж ещё не начался'
  if (props.challenge.phase === 'completed') return 'Челлендж завершён'
  if (props.challenge.checkedInToday) return 'Сегодня выполнено ✓'
  return 'Выполнено сегодня'
})

async function checkIn(): Promise<void> {
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
  <div class="check-in-action">
    <button
      class="button-primary check-in-button"
      type="button"
      :disabled="loading || challenge.checkedInToday || challenge.phase !== 'active'"
      @click="checkIn"
    >
      <span v-if="!challenge.checkedInToday" class="button-symbol">↗</span>
      {{ loading ? 'Отмечаем…' : label }}
    </button>
    <p v-if="error" class="action-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.check-in-action {
  display: grid;
  gap: 8px;
}
.check-in-button {
  width: 100%;
  min-height: 62px;
  font-size: 1rem;
}
.button-symbol {
  font-size: 1.35rem;
}
.action-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.78rem;
  text-align: center;
}
</style>
