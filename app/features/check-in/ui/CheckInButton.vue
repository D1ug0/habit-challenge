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

type CheckInAction = 'check-in' | 'undo'

const pendingAction = ref<CheckInAction | null>(null)
const error = ref<string | null>(null)

const label = computed(() => {
  if (props.challenge.phase === 'scheduled') return 'Челлендж ещё не начался'
  if (props.challenge.phase === 'completed') return 'Челлендж завершён'
  if (props.challenge.checkedInToday) return 'Сегодня выполнено ✓'
  return 'Выполнено сегодня'
})

async function updateCheckIn(action: CheckInAction): Promise<void> {
  if (pendingAction.value || props.challenge.phase !== 'active') return
  if (action === 'check-in' && props.challenge.checkedInToday) return
  if (action === 'undo' && !props.challenge.checkedInToday) return

  pendingAction.value = action
  error.value = null
  try {
    const response = await $fetch<CheckInResponse>(
      action === 'check-in'
        ? `/api/challenges/${props.challenge.id}/check-ins`
        : `/api/challenges/${props.challenge.id}/check-ins/today`,
      action === 'check-in' ? { method: 'POST', body: {} } : { method: 'DELETE' },
    )
    emit('updated', response.challenge)
    impactFeedback()
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    pendingAction.value = null
  }
}
</script>

<template>
  <div class="check-in-action">
    <button
      class="button-primary check-in-button"
      type="button"
      :disabled="pendingAction !== null || challenge.checkedInToday || challenge.phase !== 'active'"
      @click="updateCheckIn('check-in')"
    >
      <span v-if="!challenge.checkedInToday" class="button-symbol">↗</span>
      {{ pendingAction === 'check-in' ? 'Отмечаем…' : label }}
    </button>
    <div
      v-if="challenge.checkedInToday && challenge.phase === 'active'"
      class="undo-row"
      aria-live="polite"
    >
      <span>Нажали случайно?</span>
      <button
        type="button"
        class="undo-button"
        :disabled="pendingAction !== null"
        @click="updateCheckIn('undo')"
      >
        {{ pendingAction === 'undo' ? 'Отменяем…' : 'Отменить отметку' }}
      </button>
    </div>
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
.undo-row {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--muted);
  font-size: 0.76rem;
}
.undo-button {
  border: 0;
  padding: 7px 5px;
  background: transparent;
  color: var(--accent);
  font-weight: 800;
  cursor: pointer;
}
.undo-button:disabled {
  cursor: wait;
}
.action-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.78rem;
  text-align: center;
}
</style>
