<script setup lang="ts">
import type { ChallengeDetailsResponse } from '#shared/types/api'
import { createChallengeSchema } from '#shared/schemas/challenge'
import type { CreateChallengeInput } from '#shared/schemas/challenge'
import { addDays } from '#shared/domain/challenge'
import { getDateInTimeZone } from '#shared/domain/time'
import { getApiErrorMessage } from '~/shared/api/error'
import { getUserTimeZone } from '~/shared/telegram'

const session = useSessionStore()
const form = reactive<CreateChallengeInput>({
  title: '',
  description: '',
  emoji: '🌱',
  type: 'personal',
  durationDays: 14,
  startDate: '',
})
const minStartDate = ref('')
const maxStartDate = ref('')
const emojiOptions = ['🌱', '🏃', '📚', '💧', '🧘', '🎨', '💪', '☀️']
const submitting = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

onMounted(() => {
  const today = getDateInTimeZone(getUserTimeZone())
  minStartDate.value = today
  maxStartDate.value = addDays(today, 365)
  if (!form.startDate) form.startDate = today
})

async function submit(): Promise<void> {
  error.value = null
  fieldErrors.value = {}
  const result = createChallengeSchema.safeParse(form)
  if (!result.success) {
    fieldErrors.value = Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
    )
    return
  }

  submitting.value = true
  try {
    const response = await $fetch<ChallengeDetailsResponse>('/api/challenges', {
      method: 'POST',
      body: result.data,
    })
    await navigateTo(`/challenges/${response.challenge.id}`)
  } catch (requestError: unknown) {
    error.value = getApiErrorMessage(requestError)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="create-page">
    <NuxtLink to="/" class="back-link">← Назад</NuxtLink>
    <header>
      <p class="eyebrow">Новый ритуал</p>
      <h1>Что хочешь<br /><em>изменить?</em></h1>
      <p class="page-copy">Сделай цель простой и наблюдаемой — так её легче повторить завтра.</p>
    </header>

    <form class="form-card card" @submit.prevent="submit">
      <div class="field">
        <label class="field-label" for="title">Название</label>
        <input
          id="title"
          v-model="form.title"
          class="input"
          maxlength="80"
          placeholder="Например, читать 20 минут"
          autocomplete="off"
        />
        <span v-if="fieldErrors.title" class="field-error">{{ fieldErrors.title }}</span>
      </div>

      <div class="field">
        <span class="field-label">Настроение</span>
        <div class="emoji-picker" role="radiogroup" aria-label="Emoji челленджа">
          <button
            v-for="emoji in emojiOptions"
            :key="emoji"
            type="button"
            :class="{ selected: form.emoji === emoji }"
            :aria-checked="form.emoji === emoji"
            role="radio"
            @click="form.emoji = emoji"
          >
            {{ emoji }}
          </button>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="description"
          >Зачем тебе это? <span>необязательно</span></label
        >
        <textarea
          id="description"
          v-model="form.description"
          class="input"
          maxlength="500"
          placeholder="Короткое напоминание для себя"
        />
        <span v-if="fieldErrors.description" class="field-error">{{
          fieldErrors.description
        }}</span>
      </div>

      <fieldset>
        <legend class="field-label">Формат</legend>
        <div class="segmented">
          <label :class="{ selected: form.type === 'personal' }">
            <input v-model="form.type" type="radio" value="personal" />
            <strong>Личный</strong><small>только для тебя</small>
          </label>
          <label :class="{ selected: form.type === 'group' }">
            <input v-model="form.type" type="radio" value="group" />
            <strong>Вместе</strong><small>с друзьями</small>
          </label>
        </div>
      </fieldset>

      <div class="two-columns">
        <div class="field">
          <label class="field-label" for="duration">Длительность</label>
          <select id="duration" v-model.number="form.durationDays" class="input">
            <option :value="7">7 дней</option>
            <option :value="14">14 дней</option>
            <option :value="30">30 дней</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="start-date">Начать</label>
          <input
            id="start-date"
            v-model="form.startDate"
            class="input"
            type="date"
            :min="minStartDate"
            :max="maxStartDate"
          />
          <span v-if="fieldErrors.startDate" class="field-error">{{ fieldErrors.startDate }}</span>
        </div>
      </div>

      <div v-if="error" class="error-box">{{ error }}</div>
      <button
        class="button-primary submit"
        type="submit"
        :disabled="submitting || session.status !== 'ready'"
      >
        {{ submitting ? 'Создаём…' : 'Начать челлендж' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.create-page {
  display: grid;
  gap: 24px;
}
.back-link {
  color: var(--muted);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 750;
}
header {
  max-width: 570px;
}
h1 {
  margin: 8px 0 16px;
  font-family: Georgia, serif;
  font-size: clamp(2.5rem, 12vw, 4.7rem);
  line-height: 0.94;
  letter-spacing: -0.055em;
  font-weight: 500;
}
h1 em {
  color: var(--accent);
  font-weight: inherit;
}
.form-card {
  padding: 22px;
  display: grid;
  gap: 23px;
}
.field-label span {
  color: var(--muted);
  font-weight: 500;
}
.field-error {
  color: var(--danger);
  font-size: 0.76rem;
}
.emoji-picker {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 3px;
}
.emoji-picker button {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 1.35rem;
  cursor: pointer;
}
.emoji-picker button.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: translateY(-2px);
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.segmented label {
  border: 1px solid var(--line);
  border-radius: 15px;
  padding: 13px 14px;
  cursor: pointer;
  display: grid;
  gap: 2px;
}
.segmented label.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.segmented input {
  position: absolute;
  opacity: 0;
}
.segmented small {
  color: var(--muted);
}
.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.submit {
  width: 100%;
}
@media (max-width: 480px) {
  .two-columns {
    grid-template-columns: 1fr;
  }
  .form-card {
    padding: 18px;
  }
}
</style>
