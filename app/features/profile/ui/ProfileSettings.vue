<script setup lang="ts">
import type { UserDto } from '#shared/types/api'
import { profileSettingsSchema } from '#shared/schemas/challenge'
import { getApiErrorMessage } from '~/shared/api/error'

const session = useSessionStore()
const botUsername = useRuntimeConfig().public.telegramBotUsername
const timeZone = ref('UTC')
const reminderEnabled = ref(false)
const reminderHour = ref(19)
const pending = ref(false)
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const confirmDelete = ref(false)
const sessions = ref<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>(
  [],
)
const sessionsLoading = ref(false)

async function loadSessions(): Promise<void> {
  if (session.status !== 'ready') return
  sessionsLoading.value = true
  try {
    sessions.value = (
      await $fetch<{ sessions: typeof sessions.value }>('/api/me/sessions')
    ).sessions
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause)
  } finally {
    sessionsLoading.value = false
  }
}

async function revokeSession(id: string): Promise<void> {
  pending.value = true
  error.value = null
  try {
    const result = await $fetch<{ current: boolean }>(`/api/me/sessions/${id}`, {
      method: 'DELETE',
    })
    if (result.current) {
      session.afterAccountDeletion()
      await navigateTo('/')
    } else await loadSessions()
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause)
  } finally {
    pending.value = false
  }
}

watch(
  () => session.status,
  (status) => {
    if (status === 'ready') void loadSessions()
  },
  { immediate: true },
)

watch(
  () => session.user,
  (user) => {
    if (!user) return
    timeZone.value = user.timeZone
    reminderEnabled.value = user.reminderEnabled
    reminderHour.value = user.reminderHour
  },
  { immediate: true },
)

async function save(): Promise<void> {
  const parsed = profileSettingsSchema.safeParse({
    timeZone: timeZone.value,
    reminderEnabled: reminderEnabled.value,
    reminderHour: reminderHour.value,
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Проверьте настройки'
    return
  }
  pending.value = true
  error.value = null
  message.value = null
  try {
    const response = await $fetch<{ user: UserDto }>('/api/me', {
      method: 'PATCH',
      body: parsed.data,
    })
    session.setUser(response.user)
    message.value = 'Настройки сохранены'
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause)
  } finally {
    pending.value = false
  }
}

async function logout(): Promise<void> {
  pending.value = true
  error.value = null
  try {
    await session.logout()
    await navigateTo('/')
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause)
  } finally {
    pending.value = false
  }
}

async function deleteAccount(): Promise<void> {
  pending.value = true
  error.value = null
  try {
    await $fetch('/api/me', { method: 'DELETE' })
    session.afterAccountDeletion()
    await navigateTo('/')
  } catch (cause: unknown) {
    error.value = getApiErrorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="profile-page">
    <NuxtLink to="/">← На главную</NuxtLink>
    <h1>Профиль</h1>
    <div v-if="session.status === 'loading' || session.status === 'idle'" class="skeleton" />
    <div v-else-if="session.status !== 'ready'" class="error-box">
      Войдите, чтобы открыть настройки.
      <button type="button" @click="session.initialize">Войти</button>
    </div>
    <template v-else>
      <p>
        {{ session.user?.firstName }}
        <span v-if="session.user?.username">@{{ session.user.username }}</span>
      </p>
      <form class="card settings" @submit.prevent="save">
        <label class="field"
          ><span class="field-label">Часовой пояс (IANA)</span
          ><input v-model="timeZone" class="input" placeholder="Europe/Moscow"
        /></label>
        <label class="toggle"
          ><input v-model="reminderEnabled" type="checkbox" /> Напоминать через Telegram</label
        >
        <label v-if="reminderEnabled" class="field"
          ><span class="field-label">Местный час напоминания</span
          ><input v-model.number="reminderHour" class="input" type="number" min="0" max="23"
        /></label>
        <p class="hint">
          Напоминание придёт только если есть активный челлендж без отметки. Сначала откройте диалог
          с ботом.
        </p>
        <a
          v-if="botUsername"
          :href="`https://t.me/${botUsername}`"
          target="_blank"
          rel="noopener noreferrer"
          >Открыть бота в Telegram</a
        >
        <button class="button-primary" type="submit" :disabled="pending">
          Сохранить настройки
        </button>
      </form>
      <div class="card settings">
        <strong>Активные сессии</strong>
        <p v-if="sessionsLoading" class="hint">Загрузка…</p>
        <div v-for="item in sessions" :key="item.id" class="session-row">
          <span
            >{{ new Date(item.createdAt).toLocaleString('ru-RU')
            }}{{ item.current ? ' · это устройство' : '' }}</span
          >
          <button
            type="button"
            class="button-ghost"
            :disabled="pending"
            @click="revokeSession(item.id)"
          >
            Завершить
          </button>
        </div>
        <button type="button" class="button-ghost" :disabled="pending" @click="logout">
          Выйти на этом устройстве
        </button>
        <button
          v-if="!confirmDelete"
          type="button"
          class="button-ghost danger"
          :disabled="session.mode === 'demo'"
          @click="confirmDelete = true"
        >
          Удалить аккаунт
        </button>
        <div v-else class="confirm">
          <p>Удалятся ваши челленджи, участие в группах и все отметки. Это нельзя отменить.</p>
          <button
            type="button"
            class="button-ghost danger"
            :disabled="pending"
            @click="deleteAccount"
          >
            Да, удалить аккаунт</button
          ><button type="button" class="button-ghost" @click="confirmDelete = false">Отмена</button>
        </div>
        <p v-if="session.mode === 'demo'" class="hint">Общий demo-аккаунт удалить нельзя.</p>
      </div>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="error" role="alert" class="error-box">{{ error }}</p>
    </template>
  </section>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 20px;
}
.profile-page > a {
  color: var(--muted);
  text-decoration: none;
}
h1 {
  margin: 12px 0 0;
  font-family: Georgia, serif;
  font-size: 3rem;
}
.settings {
  display: grid;
  gap: 16px;
  padding: 20px;
}
.toggle {
  display: flex;
  gap: 10px;
  align-items: center;
}
.hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.5;
}
.danger {
  color: var(--danger);
}
.confirm {
  display: grid;
  gap: 8px;
}
.session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
  font-size: 0.8rem;
}
.session-row button {
  min-height: 38px;
}
</style>
