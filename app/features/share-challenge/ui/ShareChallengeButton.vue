<script setup lang="ts">
import { shareChallenge } from '~/shared/telegram'

const props = defineProps<{
  url: string
  title: string
}>()

const state = ref<'idle' | 'loading' | 'copied'>('idle')

async function share(): Promise<void> {
  state.value = 'loading'
  try {
    const result = await shareChallenge(props.url, `Присоединяйся к челленджу «${props.title}»`)
    state.value = result === 'copied' ? 'copied' : 'idle'
    if (result === 'copied') {
      setTimeout(() => { state.value = 'idle' }, 1800)
    }
  } catch {
    state.value = 'idle'
  }
}
</script>

<template>
  <button class="button-ghost share-button" type="button" :disabled="state === 'loading'" @click="share">
    {{ state === 'copied' ? 'Ссылка скопирована' : state === 'loading' ? 'Открываем…' : 'Пригласить друзей' }}
    <span aria-hidden="true">↗</span>
  </button>
</template>

<style scoped>
.share-button { width: 100%; }
</style>
