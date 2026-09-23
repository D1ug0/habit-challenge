FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY . .
RUN pnpm postinstall
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.output ./.output
COPY scripts/run-jobs.mjs ./scripts/run-jobs.mjs
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

FROM node:22-alpine AS backup
WORKDIR /app
RUN apk add --no-cache postgresql-client aws-cli
COPY scripts/backup-db.mjs scripts/backup-scheduler.mjs ./scripts/
CMD ["node", "scripts/backup-scheduler.mjs"]
