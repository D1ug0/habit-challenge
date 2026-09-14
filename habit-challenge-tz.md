# Habit Challenge — Техническое задание

## 1. Цель проекта

Разработать Telegram Mini App для формирования привычек и участия в личных и групповых челленджах.

Пользователь должен иметь возможность:
- открыть приложение из Telegram без отдельной регистрации;
- создать привычку или челлендж;
- ежедневно отмечать выполнение;
- видеть прогресс и текущую серию дней;
- приглашать друзей в групповой челлендж;
- видеть прогресс участников.

Первая версия должна быть достаточно простой для самостоятельной разработки, но иметь архитектуру, которую можно развивать без переписывания проекта.

---

## 2. Формат приложения

Habit Challenge — Telegram Mini App, то есть обычное web-приложение, открываемое внутри Telegram WebView.

Основной клиент: Telegram Mini Apps.

Дополнительно приложение желательно сделать работоспособным в обычном браузере в dev/demo-режиме.

---

## 3. Технологический стек

### Frontend
- Nuxt 4
- Vue 3
- TypeScript
- Pinia
- VueUse
- Zod
- Tailwind CSS 4
- Nuxt UI — опционально

### Backend
- Nuxt Server Routes / Nitro
- TypeScript
- Zod для валидации входных данных

Для MVP отдельный backend-репозиторий не нужен: frontend и API находятся в одном Nuxt-приложении.

### Database
- PostgreSQL
- Drizzle ORM
- drizzle-kit для миграций

### Telegram
- Telegram Mini Apps API
- Telegram Bot API
- grammY — для серверной части бота, когда появятся уведомления

### Quality
- ESLint
- Prettier
- Vitest
- Playwright — для ключевых e2e-сценариев
- pnpm

---

## 4. Основные сущности

### User
- id
- telegramId
- username
- firstName
- lastName
- photoUrl
- createdAt

### Challenge
- id
- ownerId
- title
- description
- emoji
- type: `personal | group`
- durationDays
- startDate
- createdAt

### ChallengeParticipant
- id
- challengeId
- userId
- joinedAt

### CheckIn
- id
- challengeId
- userId
- date
- createdAt

Для пары `challengeId + userId + date` должен существовать уникальный индекс, чтобы пользователь не мог сделать два check-in за один день.

---

## 5. MVP

### 5.1 Авторизация

При запуске Mini App:
1. Получить `Telegram.WebApp.initData`.
2. Отправить данные на сервер.
3. На сервере проверить подпись Telegram init data.
4. Найти пользователя по `telegramId`.
5. Если пользователя нет — создать его.
6. Вернуть текущего пользователя клиенту.

`initDataUnsafe` разрешается использовать только для отображения предварительных данных на клиенте. Доверять этим данным для авторизации нельзя.

### 5.2 Главный экран

Показать:
- имя пользователя;
- активные челленджи;
- прогресс;
- текущий streak;
- состояние «выполнено сегодня / не выполнено»;
- кнопку создания челленджа.

### 5.3 Создание челленджа

Поля:
- название;
- описание — необязательно;
- emoji;
- длительность: 7 / 14 / 30 дней;
- тип: личный / групповой;
- дата старта.

Для MVP одна привычка считается выполненной максимум один раз в сутки.

### 5.4 Экран челленджа

Показать:
- название и описание;
- текущий день;
- общий прогресс;
- streak;
- историю check-in;
- кнопку «Выполнено сегодня».

Для группового челленджа дополнительно:
- список участников;
- число выполненных дней каждого;
- простую таблицу лидеров;
- кнопку приглашения.

### 5.5 Check-in

При нажатии «Выполнено сегодня»:
1. Проверить авторизацию.
2. Проверить участие пользователя в челлендже.
3. Проверить, что за текущую календарную дату check-in ещё отсутствует.
4. Создать CheckIn.
5. Пересчитать прогресс и streak.
6. Обновить интерфейс.
7. Вызвать Telegram Haptic Feedback при доступности.

### 5.6 Приглашение

Для группового челленджа формируется Telegram deep link со `startapp`, например логически:

`startapp=challenge_<id>`

При открытии такой ссылки приложение должно:
1. получить start parameter;
2. определить challenge;
3. открыть экран приглашения;
4. предложить присоединиться;
5. после подтверждения создать ChallengeParticipant.

---

## 6. Основные экраны

1. `/` — Dashboard
2. `/challenges/new` — Create Challenge
3. `/challenges/:id` — Challenge Details
4. `/join/:id` — Join Challenge
5. `/profile` — Profile / Statistics, после MVP

---

## 7. Архитектура

Использовать FSD-подход, адаптированный под Nuxt 4.

```text
app/
├── pages/
│   ├── index.vue
│   ├── challenges/
│   └── join/
│
├── widgets/
│   ├── challenge-list/
│   ├── challenge-progress/
│   └── leaderboard/
│
├── features/
│   ├── auth-by-telegram/
│   ├── create-challenge/
│   ├── check-in/
│   ├── join-challenge/
│   └── share-challenge/
│
├── entities/
│   ├── user/
│   ├── challenge/
│   └── check-in/
│
├── shared/
│   ├── api/
│   ├── config/
│   ├── lib/
│   ├── telegram/
│   ├── types/
│   └── ui/
│
└── stores/

server/
├── api/
│   ├── auth/
│   └── challenges/
├── database/
│   ├── schema/
│   └── index.ts
├── repositories/
├── services/
└── utils/

tests/
```

### Зависимости слоёв

Разрешённое направление:

```text
pages
  ↓
widgets
  ↓
features
  ↓
entities
  ↓
shared
```

Нижний слой не должен импортировать верхний.

Nuxt `pages` используется как инфраструктурный routing-layer. Бизнес-логика не должна находиться непосредственно в page-компонентах.

---

## 8. Pinia

Pinia использовать только для глобального клиентского состояния, которое действительно разделяется между несколькими частями приложения.

Начальные stores:
- `useSessionStore` — текущий пользователь и состояние Telegram-сессии;
- `useChallengeStore` — только если общий challenge-state реально нужен между страницами.

Не переносить все серверные данные в Pinia автоматически. Для обычного server state использовать `useFetch`, `$fetch`, `useAsyncData` и composables.

---

## 9. API MVP

```text
POST   /api/auth/telegram

GET    /api/challenges
POST   /api/challenges

GET    /api/challenges/:id

POST   /api/challenges/:id/check-ins
DELETE /api/challenges/:id/check-ins/today

POST   /api/challenges/:id/join
GET    /api/challenges/:id/participants
```

Все mutation endpoints должны:
- валидировать body через Zod;
- проверять текущего пользователя;
- проверять права доступа;
- возвращать типизированные ошибки.

---

## 10. Telegram integration

Создать отдельный adapter в:

`app/shared/telegram`

Приложение не должно обращаться к `window.Telegram` из произвольных компонентов.

Adapter должен предоставлять интерфейс вроде:
- `ready()`
- `expand()`
- `getInitData()`
- `getLaunchParams()`
- `impactFeedback()`
- `shareChallenge()`
- `isTelegramEnvironment()`

Это позволит запускать приложение вне Telegram и проще тестировать код.

---

## 11. Безопасность

Обязательно:
- никогда не хранить Bot Token на клиенте;
- не доверять `initDataUnsafe`;
- проверять Telegram init data на сервере;
- проверять актуальность `auth_date`;
- использовать server-only env variables;
- валидировать API payload;
- проверять принадлежность пользователя к challenge;
- ограничить повторный check-in уникальным constraint в БД.

---

## 12. UX

Интерфейс ориентирован прежде всего на смартфон.

Требования:
- mobile-first;
- поддержка Telegram light/dark theme;
- учитывать safe-area;
- минимум модальных окон;
- быстрый check-in в 1 действие;
- feedback после check-in;
- skeleton/loading состояния;
- понятные empty states;
- error-state при запуске вне Telegram или при ошибке авторизации.

---

## 13. Этапы разработки

### Этап 1 — Foundation
- создать Nuxt 4 проект;
- подключить TypeScript, Pinia, Tailwind;
- настроить ESLint/Prettier;
- добавить FSD-структуру;
- создать Telegram adapter;
- настроить browser fallback.

### Этап 2 — Local MVP
Без БД:
- Dashboard;
- создание привычки;
- check-in;
- streak;
- local storage / mock repository.

Цель: проверить интерфейс и доменную логику.

### Этап 3 — Fullstack
- PostgreSQL;
- Drizzle;
- Nitro API;
- Telegram auth;
- реальные Users / Challenges / CheckIns.

### Этап 4 — Social
- group challenge;
- участники;
- deep links;
- join flow;
- leaderboard.

### Этап 5 — Bot
- уведомления;
- напоминания;
- ссылки на Mini App из сообщений.

---

## 14. Что не входит в первый MVP

Не реализовывать сразу:
- AI;
- платные подписки;
- сложные recurring schedules;
- Apple Health / Google Fit;
- WebSockets;
- достижения и XP;
- streak freeze;
- push-настройки;
- фото-доказательства;
- сложную систему ролей.

Эти функции добавляются после стабильного MVP.

---

## 15. Definition of Done для MVP

MVP считается готовым, когда пользователь может:

1. открыть приложение из Telegram;
2. автоматически авторизоваться;
3. создать личный челлендж;
4. увидеть его на Dashboard;
5. открыть страницу челленджа;
6. сделать один check-in за день;
7. увидеть обновлённый progress и streak;
8. перезапустить Mini App без потери данных;
9. создать групповой челлендж;
10. отправить приглашение и присоединить второго пользователя.

Проект должен проходить lint, typecheck и тесты доменной логики.
