<script setup lang="ts">
import type { ChallengeDetails, ChallengeDetailsResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'

const props = defineProps<{ challenge: ChallengeDetails }>()
const emit = defineEmits<{
  updated: [challenge: ChallengeDetails]
  deleted: []
}>()

const pending = ref<'finish' | 'delete' | null>(null)
const confirming = ref<'finish' | 'delete' | null>(null)
const error = ref<string | null>(null)

function cancelConfirmation(): void {
  confirming.value = null
  error.value = null
}

async function applyAction(): Promise<void> {
  if (!confirming.value || pending.value) return
  const action = confirming.value
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
    confirming.value = null
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
    <div v-if="!confirming" class="actions">
      <button
        v-if="challenge.phase !== 'completed'"
        type="button"
        class="button-secondary"
        @click="confirming = 'finish'"
      >
        Завершить досрочно
      </button>
      <button type="button" class="danger-link" @click="confirming = 'delete'">
        Удалить челлендж
      </button>
    </div>
    <div
      v-else
      class="confirm"
      role="group"
      :aria-label="confirming === 'finish' ? 'Подтвердить завершение' : 'Подтвердить удаление'"
    >
      <p>
        {{
          confirming === 'finish'
            ? 'Завершить сейчас? Новые отметки и вступления станут недоступны.'
            : 'Удалить навсегда? Все отметки участников будут потеряны.'
        }}
      </p>
      <div class="actions">
        <button
          type="button"
          :class="confirming === 'delete' ? 'danger-button' : 'button-secondary'"
          :disabled="pending !== null"
          @click="applyAction"
        >
          {{ pending ? 'Подождите…' : confirming === 'finish' ? 'Да, завершить' : 'Да, удалить' }}
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
    <p v-if="error" class="action-error" role="alert">{{ error }}</p>
  </section>
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
.danger-button {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  color: white;
  background: #a63932;
  font-weight: 750;
  cursor: pointer;
}
.action-error {
  color: #a63932 !important;
}
</style>
