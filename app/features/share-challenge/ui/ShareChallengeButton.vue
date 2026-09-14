<script setup lang="ts">
import { copyChallengeUrl, openTelegramShare } from '~/shared/telegram'

const props = defineProps<{
  url: string
  title: string
}>()

const state = ref<'idle' | 'copying' | 'copied' | 'error'>('idle')

async function copy(): Promise<void> {
  state.value = 'copying'
  try {
    await copyChallengeUrl(props.url)
    state.value = 'copied'
    setTimeout(() => {
      state.value = 'idle'
    }, 1800)
  } catch {
    state.value = 'error'
  }
}
</script>

<template>
  <div class="share-actions">
    <button
      class="button-ghost share-button"
      type="button"
      @click="openTelegramShare(url, `Присоединяйся к челленджу «${title}»`)"
    >
      Отправить в Telegram <span aria-hidden="true">↗</span>
    </button>
    <button class="copy-button" type="button" :disabled="state === 'copying'" @click="copy">
      {{
        state === 'copied'
          ? 'Ссылка скопирована'
          : state === 'copying'
            ? 'Копируем…'
            : 'Скопировать ссылку'
      }}
    </button>
    <p v-if="state === 'error'" role="alert">
      Не удалось скопировать ссылку. Откройте приложение по HTTPS и попробуйте снова.
    </p>
  </div>
</template>

<style scoped>
.share-actions {
  display: grid;
  gap: 9px;
}
.share-button {
  width: 100%;
}
.copy-button {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  font-weight: 750;
  cursor: pointer;
}
.share-actions p {
  color: #a63932;
  font-size: 0.72rem;
}
</style>
