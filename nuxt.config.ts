import tailwindcss from '@tailwindcss/vite'
import { z } from 'zod'

const allowedDevHost = z.union([
  z.literal(''),
  z.string().trim().max(253).regex(
    /^(?!-)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i,
    'Некорректный hostname в NUXT_DEV_ALLOWED_HOST',
  ),
]).parse(process.env.NUXT_DEV_ALLOWED_HOST ?? '')

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: allowedDevHost ? [allowedDevHost] : [],
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    authSessionSecret: process.env.AUTH_SESSION_SECRET ?? '',
    authMaxAgeSeconds: process.env.AUTH_MAX_AGE_SECONDS ?? '86400',
    public: {
      demoMode: process.env.NUXT_PUBLIC_DEMO_MODE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true'),
      telegramBotUsername: process.env.NUXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '',
    },
  },
  app: {
    head: {
      title: 'Habit Challenge',
      meta: [
        { name: 'description', content: 'Личные привычки и совместные челленджи в Telegram' },
        { name: 'theme-color', content: '#f7f5ef' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
      script: [
        { src: 'https://telegram.org/js/telegram-web-app.js', defer: true },
      ],
    },
  },
})
