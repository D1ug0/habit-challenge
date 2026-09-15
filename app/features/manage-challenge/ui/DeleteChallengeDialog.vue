<script setup lang="ts">
const props = defineProps<{
  open: boolean
  challengeTitle: string
  pending: boolean
  error: string | null
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
const dialogCard = useTemplateRef<HTMLElement>('dialogCard')
let previouslyFocusedElement: HTMLElement | null = null

function close(): void {
  if (!props.pending) emit('cancel')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

function trapFocus(event: KeyboardEvent): void {
  const focusableElements = Array.from(
    dialogCard.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [],
  )
  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)

  if (!firstElement || !lastElement) {
    event.preventDefault()
    return
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return

    if (open) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeydown)
      await nextTick()
      cancelButton.value?.focus()
      return
    }

    document.body.style.removeProperty('overflow')
    window.removeEventListener('keydown', handleKeydown)
    previouslyFocusedElement?.focus()
    previouslyFocusedElement = null
  },
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.removeProperty('overflow')
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="delete-dialog">
      <div v-if="open" class="dialog-backdrop" @click.self="close">
        <section
          ref="dialogCard"
          class="dialog-card"
          role="dialog"
          aria-modal="true"
          :aria-busy="pending"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
          @keydown.tab="trapFocus"
        >
          <div class="danger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
            </svg>
          </div>

          <div class="dialog-copy">
            <p class="dialog-eyebrow">Необратимое действие</p>
            <h2 id="delete-dialog-title">Удалить «{{ challengeTitle }}»?</h2>
            <p id="delete-dialog-description">
              Челлендж, весь прогресс и отметки участников будут удалены навсегда.
            </p>
          </div>

          <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>

          <div class="dialog-actions">
            <button
              ref="cancelButton"
              type="button"
              class="dialog-cancel"
              :disabled="pending"
              @click="close"
            >
              Отмена
            </button>
            <button
              type="button"
              class="dialog-delete"
              :disabled="pending"
              @click="emit('confirm')"
            >
              <span v-if="pending" class="spinner" aria-hidden="true" />
              {{ pending ? 'Удаляем…' : 'Да, удалить' }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, #101713 58%, transparent);
  backdrop-filter: blur(5px);
}

.dialog-card {
  width: min(100%, 420px);
  display: grid;
  gap: 18px;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--danger) 20%, var(--line));
  border-radius: 26px;
  background: color-mix(in srgb, var(--surface) 96%, var(--page));
  color: var(--text);
  box-shadow: 0 28px 80px rgba(10, 20, 14, 0.28);
}

.danger-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 11%, var(--surface));
}

.danger-icon svg {
  width: 23px;
  height: 23px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dialog-copy {
  min-width: 0;
}

.dialog-eyebrow {
  margin: 0 0 7px;
  color: var(--danger);
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.dialog-copy h2 {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.dialog-copy > p:last-child {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.dialog-error {
  margin: 0;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent);
  border-radius: 13px;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 7%, var(--surface));
  font-size: 0.78rem;
  line-height: 1.4;
}

.dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dialog-actions button {
  min-height: 50px;
  border-radius: 15px;
  padding: 0 14px;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 150ms ease,
    opacity 150ms ease,
    background 150ms ease;
}

.dialog-actions button:active:not(:disabled) {
  transform: scale(0.98);
}

.dialog-cancel {
  border: 1px solid var(--line);
  color: var(--text);
  background: var(--surface);
}

.dialog-delete {
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
  background: var(--danger);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

.delete-dialog-enter-active,
.delete-dialog-leave-active {
  transition: opacity 180ms ease;
}

.delete-dialog-enter-active .dialog-card,
.delete-dialog-leave-active .dialog-card {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.delete-dialog-enter-from,
.delete-dialog-leave-to {
  opacity: 0;
}

.delete-dialog-enter-from .dialog-card,
.delete-dialog-leave-to .dialog-card {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 520px) {
  .dialog-backdrop {
    place-items: end center;
    padding: 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  .dialog-card {
    padding: 22px;
    border-radius: 26px;
  }

  .delete-dialog-enter-from .dialog-card,
  .delete-dialog-leave-to .dialog-card {
    transform: translateY(24px);
  }
}
</style>
