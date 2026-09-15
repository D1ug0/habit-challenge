<script setup lang="ts">
import type { ChallengeDetails, ChallengeDetailsResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import DeleteChallengeDialog from './DeleteChallengeDialog.vue'

const props = defineProps<{ challenge: ChallengeDetails }>()
const emit = defineEmits<{
  updated: [challenge: ChallengeDetails]
  deleted: []
}>()

const pending = ref<'finish' | 'delete' | null>(null)
const confirmingFinish = ref(false)
const deleteDialogOpen = ref(false)
const error = ref<string | null>(null)

function cancelConfirmation(): void {
  confirmingFinish.value = false
  deleteDialogOpen.value = false
  error.value = null
}

async function applyAction(action: 'finish' | 'delete'): Promise<void> {
  if (pending.value) return
  pending.value = action
  error.value = null
  try {
    if (action === 'finish') {
      const response = await $fetch<ChallengeDetailsResponse>(
        `/api/challenges/${props.challenge.id}/finish`,
        {
          method: 'POST',
          body: {},
        },
      )
      emit('updated', response.challenge)
    } else {
      await $fetch(`/api/challenges/${props.challenge.id}`, { method: 'DELETE' })
      emit('deleted')
    }
    confirmingFinish.value = false
    deleteDialogOpen.value = false
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <section class="manage card" aria-label="Управление челленджем">
    <div>
      <strong>Управление челленджем</strong>
      <p>
        Завершение сохранит отметки и лидерборд. Удаление навсегда уберёт челлендж и все отметки
        участников.
      </p>
    </div>
    <div v-if="!confirmingFinish" class="actions">
      <button
        v-if="challenge.phase !== 'completed'"
        type="button"
        class="button-secondary"
        @click="confirmingFinish = true"
      >
        Завершить досрочно
      </button>
      <button type="button" class="danger-link" @click="deleteDialogOpen = true">
        Удалить челлендж
      </button>
    </div>
    <div v-else class="confirm" role="group" aria-label="Подтвердить завершение">
      <p>Завершить сейчас? Новые отметки и вступления станут недоступны.</p>
      <div class="actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="pending !== null"
          @click="applyAction('finish')"
        >
          {{ pending ? 'Подождите…' : 'Да, завершить' }}
        </button>
        <button
          type="button"
          class="cancel-link"
          :disabled="pending !== null"
          @click="cancelConfirmation"
        >
          Отмена
        </button>
      </div>
    </div>
    <p v-if="error && !deleteDialogOpen" class="action-error" role="alert">{{ error }}</p>
  </section>

  <DeleteChallengeDialog
    :open="deleteDialogOpen"
    :challenge-title="challenge.title"
    :pending="pending === 'delete'"
    :error="deleteDialogOpen ? error : null"
    @cancel="cancelConfirmation"
    @confirm="applyAction('delete')"
  />
</template>

<style scoped>
.manage {
  display: grid;
  gap: 12px;
  padding: 20px;
}
.manage strong {
  font-size: 0.9rem;
}
.manage p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.5;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.actions button {
  min-height: 42px;
}
.danger-link,
.cancel-link {
  border: 0;
  background: transparent;
  font-weight: 750;
  cursor: pointer;
  padding: 8px 10px;
}
.danger-link {
  color: #a63932;
}
.cancel-link {
  color: var(--muted);
}
.action-error {
  color: var(--danger) !important;
}
</style>
