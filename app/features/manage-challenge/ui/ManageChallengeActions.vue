<script setup lang="ts">
import type { ChallengeDetails, ChallengeDetailsResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import DeleteChallengeDialog from './DeleteChallengeDialog.vue'
import { editChallengeSchema } from '#shared/schemas/challenge'

const props = defineProps<{ challenge: ChallengeDetails }>()
const emit = defineEmits<{
  updated: [challenge: ChallengeDetails]
  deleted: []
}>()

const pending = ref<'finish' | 'delete' | 'edit' | null>(null)
const confirmingFinish = ref(false)
const deleteDialogOpen = ref(false)
const error = ref<string | null>(null)
const editing = ref(false)
const editTitle = ref(props.challenge.title)
const editDescription = ref(props.challenge.description ?? '')
const editEmoji = ref(props.challenge.emoji)

async function saveEdit(): Promise<void> {
  const parsed = editChallengeSchema.safeParse({
    title: editTitle.value,
    description: editDescription.value,
    emoji: editEmoji.value,
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Проверьте поля'
    return
  }
  pending.value = 'edit'
  error.value = null
  try {
    const response = await $fetch<ChallengeDetailsResponse>(
      `/api/challenges/${props.challenge.id}`,
      { method: 'PATCH', body: parsed.data },
    )
    emit('updated', response.challenge)
    editing.value = false
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    pending.value = null
  }
}

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
      <button type="button" class="button-ghost" @click="editing = !editing">
        {{ editing ? 'Скрыть форму' : 'Редактировать' }}
      </button>
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
    <form v-if="editing" class="edit-form" @submit.prevent="saveEdit">
      <label class="field"
        ><span class="field-label">Название</span
        ><input v-model="editTitle" class="input" maxlength="80" required
      /></label>
      <label class="field"
        ><span class="field-label">Описание</span
        ><textarea v-model="editDescription" class="input" maxlength="500" />
      </label>
      <label class="field"
        ><span class="field-label">Emoji</span
        ><input v-model="editEmoji" class="input" maxlength="12" required
      /></label>
      <button type="submit" class="button-primary" :disabled="pending !== null">Сохранить</button>
    </form>
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
.edit-form {
  display: grid;
  gap: 12px;
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
