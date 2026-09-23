# Production на VPS

Нужны VPS с Docker Compose, домен с A/AAAA-записью на VPS, PostgreSQL (лучше managed),
Telegram-бот и S3 bucket. Порты 80 и 443 должны быть открыты. PostgreSQL не публикуйте в интернет
без необходимости.

1. Скопируйте `.env.example` в `.env.production` и заполните `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`,
   `AUTH_SESSION_SECRET`, `NUXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `APP_DOMAIN`,
   `REMINDER_JOB_SECRET` и `MONITORING_TOKEN`. Секреты должны быть случайными строками от 32 символов.
   Установите `NUXT_PUBLIC_DEMO_MODE=false`.
2. Для ежедневных резервных копий укажите `BACKUP_S3_URI=s3://bucket/prefix`,
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` и, если требуется,
   `AWS_ENDPOINT_URL`. Настройте в bucket lifecycle и доступ только на нужный префикс.
3. Примените миграции:

   ```bash
   docker compose --env-file .env.production -f compose.prod.yml --profile ops run --rm migration
   ```

4. Запустите приложение, HTTPS и планировщик:

   ```bash
   docker compose --env-file .env.production -f compose.prod.yml up -d --build app scheduler caddy
   docker compose --env-file .env.production -f compose.prod.yml --profile backup up -d --build backup
   ```

5. Укажите `https://<APP_DOMAIN>` как Main Mini App URL в BotFather.
6. Проверьте запуск в настоящем Telegram двумя тестовыми аккаунтами: создайте закрытую группу,
   откройте её `startapp`-ссылку вторым аккаунтом, вступите и сделайте отметку. Повторная отметка
   в тот же день должна быть отклонена, в том числе после смены часового пояса профиля. Завершите
   челлендж и проверьте, что его участника нельзя исключить, а история и лидерборд сохранились.
   Удалите тестовую группу после проверки.

Проверка доступности: `GET https://<APP_DOMAIN>/api/health`. Подключите внешний uptime monitor
к этому URL и alert на недоступность. Метрики доступны через `GET /api/metrics` с заголовком
`Authorization: Bearer <MONITORING_TOKEN>`. Ошибки и запросы записываются JSON-строками в логи
контейнера; направьте их в выбранный сборщик логов и настройте alert по `server_error`,
`reminder_failed`, `job_failed`, `backup_failed`.

Backup ежедневно запускается в `BACKUP_HOUR_UTC`, хранит локальные копии `BACKUP_RETENTION_DAYS`
дней и загружает dump в S3. Проверяйте наличие новых объектов в bucket и регулярно делайте
пробное восстановление в отдельную тестовую PostgreSQL: `pg_restore --list <dump>` для проверки
архива, затем `pg_restore --no-owner --dbname=<test-database-url> <dump>` и `GET /api/health` для
восстановленного приложения. Не восстанавливайте тестовый dump поверх рабочей БД.

При обновлении образа сначала создайте backup, затем примените миграции и пересоздайте сервисы.
Для других платформ можно использовать тот же `Dockerfile`: runtime-образ запускает
`.output/server/index.mjs`, а scheduler — `node scripts/run-jobs.mjs`.
