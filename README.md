# Habit Challenge

Telegram Mini App для личных привычек и групповых челленджей. MVP реализован на Nuxt 4, PostgreSQL, Drizzle ORM и Tailwind CSS 4.

## Что реализовано

- серверная авторизация через подписанный Telegram `initData` с проверкой `auth_date`;
- безопасный browser/demo fallback без доверия к клиентским Telegram-данным;
- создание личных и групповых челленджей на 7, 14 или 30 дней;
- dashboard, прогресс, текущая серия и история отметок;
- один check-in в календарный день, защищённый уникальным индексом PostgreSQL;
- Telegram deep link `startapp=challenge_<id>`, вступление и простой лидерборд;
- Telegram Haptic Feedback и системный share fallback;
- mobile-first интерфейс, safe areas, light/dark Telegram theme variables;
- unit-тесты доменной логики и Playwright-тест критического сценария.

## Локальный запуск

Требуются Node.js 22+, pnpm и Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

По умолчанию `NUXT_PUBLIC_DEMO_MODE=true`, поэтому приложение откроется в обычном браузере с серверным demo-пользователем. Данные сохраняются в PostgreSQL и не теряются после перезапуска Nuxt.

Контейнер PostgreSQL публикуется на порту `5433`, чтобы не конфликтовать с локальной установкой PostgreSQL на стандартном порту `5432`.

## Telegram-режим

В `.env` укажите:

```dotenv
TELEGRAM_BOT_TOKEN=<bot-token>
AUTH_SESSION_SECRET=<случайная-строка-минимум-32-символа>
NUXT_PUBLIC_DEMO_MODE=false
NUXT_PUBLIC_TELEGRAM_BOT_USERNAME=<bot-username-без-@>
```

Web App URL настраивается у BotFather и должен использовать HTTPS. Bot Token читается только серверным runtime config и не попадает в клиентский bundle.

## Команды

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm build
```

Календарный день в MVP определяется сервером в UTC. Это явно фиксирует поведение до появления пользовательских часовых поясов в следующей версии.

## Локальный HTTPS-туннель

При использовании Cloudflare Quick Tunnel добавьте выданный hostname без `https://` в `.env`:

```dotenv
NUXT_DEV_ALLOWED_HOST=random-name.trycloudflare.com
```

После смены адреса туннеля обновите значение и перезапустите `pnpm dev`. Не устанавливайте `vite.server.allowedHosts: true`: точный allowlist сохраняет защиту dev-сервера от DNS rebinding.
