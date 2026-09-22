<script setup lang="ts">
import type { LeaveChallengeResponse } from '#shared/types/api'
import { getApiErrorMessage } from '~/shared/api/error'
import { impactFeedback } from '~/shared/telegram'

const props = defineProps<{
  challengeId: string
  challengeTitle: string
}>()

const emit = defineEmits<{
  left: []
}>()

const confirming = ref(false)
const pending = ref(false)
const error = ref<string | null>(null)

function cancel(): void {
  confirming.value = false
  error.value = null
}

async function leaveChallenge(): Promise<void> {
  if (pending.value) return

  pending.value = true
  error.value = null
  try {
    await $fetch<LeaveChallengeResponse>(`/api/challenges/${props.challengeId}/participants/me`, {
      method: 'DELETE',
    })
    impactFeedback()
    emit('left')
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="leave-card card" aria-label="Участие в челлендже">
    <template v-if="!confirming">
      <div>
        <strong>Участие в челлендже</strong>
        <p>Можно выйти, если этот челлендж тебе больше не подходит.</p>
      </div>
      <button type="button" class="leave-button" @click="confirming = true">
        Покинуть челлендж
      </button>
    </template>

    <template v-else>
      <div>
        <strong>Покинуть «{{ challengeTitle }}»?</strong>
        <p>Твои отметки в этом челлендже будут удалены. Это действие нельзя отменить.</p>
      </div>
      <div class="confirm-actions">
        <button type="button" class="confirm-leave" :disabled="pending" @click="leaveChallenge">
          {{ pending ? 'Выходим…' : 'Да, покинуть' }}
        </button>
        <button type="button" class="cancel-button" :disabled="pending" @click="cancel">
          Остаться
        </button>
      </div>
      <p v-if="error" class="action-error" role="alert">{{ error }}</p>
    </template>
  </section>
</template>

<style scoped>
.leave-card {
  padding: 20px;
  display: grid;
  gap: 14px;
}

.leave-card strong {
  font-size: 0.9rem;
}

.leave-card p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.leave-button,
.confirm-leave,
.cancel-button {
  width: fit-content;
  min-height: 42px;
  border-radius: 13px;
  padding: 0 14px;
  font-weight: 800;
  cursor: pointer;
}

.leave-button {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--danger);
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.confirm-leave {
  border: 0;
  background: var(--danger);
  color: #fff;
}

.cancel-button {
  border: 0;
  background: transparent;
  color: var(--muted);
}

.action-error {
  color: var(--danger) !important;
}
</style>
