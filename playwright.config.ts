import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const localEdgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const localBrowserChannel =
  process.platform === 'win32' && existsSync(localEdgePath) ? 'msedge' : undefined

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://habit:habit@127.0.0.1:5433/habit_challenge',
      TELEGRAM_BOT_TOKEN: 'habit-challenge-e2e-bot-token',
      AUTH_SESSION_SECRET: 'habit-challenge-e2e-session-secret-32-characters',
      NUXT_PUBLIC_DEMO_MODE: 'true',
    },
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], channel: localBrowserChannel },
    },
  ],
})
