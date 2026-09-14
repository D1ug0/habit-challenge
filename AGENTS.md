# AGENTS.md

## Project

Habit Challenge is a Telegram Mini App for personal habits and group challenges.

The application is built as a Nuxt 4 fullstack project.

## Stack

- Nuxt 4
- Vue 3
- TypeScript
- Pinia
- Nitro server routes
- PostgreSQL
- Drizzle ORM
- Zod
- Tailwind CSS 4
- Vitest
- Playwright
- pnpm

## Architecture

Use Feature-Sliced Design adapted for Nuxt.

Frontend layers:

```text
app/pages
app/widgets
app/features
app/entities
app/shared
```

Allowed dependency direction:

```text
pages -> widgets -> features -> entities -> shared
```

Lower layers must never import from upper layers.

Keep Nuxt page components thin. Pages compose widgets/features and should not contain domain logic.

Backend code lives in `server/`.

Prefer this backend separation:

```text
server/api
server/services
server/repositories
server/database
server/utils
```

Do not access the database directly from Vue components or frontend composables.

## State management

Use Pinia only for truly shared client state.

Do not mirror all server state into Pinia.

Prefer Nuxt `useFetch`, `useAsyncData`, `$fetch`, and domain composables for server data.

## Telegram

All access to Telegram Mini Apps APIs must go through the adapter in:

```text
app/shared/telegram
```

Do not access `window.Telegram` directly from feature, entity, widget, or page components.

Never trust `initDataUnsafe` for authentication.

Authentication must validate Telegram `initData` on the server.

Never expose the Telegram Bot Token to client code.

The application should have a safe browser/dev fallback when Telegram APIs are unavailable.

## Database

Use PostgreSQL with Drizzle ORM.

Database schema should include:
- users
- challenges
- challenge_participants
- check_ins

A user can have only one check-in per challenge per calendar day. Enforce this in the database with a unique constraint.

## Validation

Validate all external input with Zod:
- API request body
- route parameters when appropriate
- Telegram launch/start parameters
- environment variables

Do not rely only on client-side validation.

## TypeScript

Use strict TypeScript.

Avoid `any`.

Prefer domain-specific types over generic objects.

Do not duplicate API response types across unrelated files.

## UI

Mobile-first.

Support Telegram light and dark themes.

Respect safe areas.

Keep check-in interaction fast and accessible.

Every async screen/action should have loading, error, and empty states where applicable.

## Testing

Domain logic must be independently testable.

At minimum cover:
- streak calculation;
- challenge progress calculation;
- duplicate check-in prevention;
- challenge duration boundaries;
- permission checks.

Add Playwright e2e tests for critical flows once the API and DB are stable.

## Commands

Prefer pnpm.

Before considering a coding task complete, run the relevant commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Run e2e tests when the changed area affects critical user flows:

```bash
pnpm test:e2e
```

## Development principles

Prefer simple solutions over premature abstractions.

Do not introduce a new library when Nuxt/Vue/platform APIs already solve the problem cleanly.

Do not implement features outside the requested scope.

Do not mix refactoring with unrelated feature work unless necessary.

Keep business logic outside Vue components.

Prefer small composables/services with explicit responsibilities.

Do not create abstractions solely to satisfy FSD folder structure.

## MVP scope

The MVP includes:
- Telegram authentication;
- challenge creation;
- dashboard;
- challenge details;
- one daily check-in;
- streak and progress;
- group challenge;
- Telegram invite/deep link;
- join flow;
- simple leaderboard.

Do not add without explicit request:
- AI features;
- payments;
- WebSockets;
- complex recurring schedules;
- achievements/XP;
- health integrations;
- photo proof;
- streak freezes.

## Definition of done

A change is complete only when:
- code matches the architecture;
- types are correct;
- external inputs are validated;
- security constraints are preserved;
- relevant tests pass;
- no secrets are committed;
- the implementation does not expand scope unnecessarily.
