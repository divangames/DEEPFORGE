# Stage 15 — Leaderboards / Blitz Drill

## Цель

Добавить первый настоящий соревновательный режим DEEPFORGE, в котором очки нельзя назначить на клиенте вручную. Blitz Drill работает как отдельная 10-минутная server-authoritative сессия.

## Основной цикл

1. Игрок открывает `◆ BLITZ` в Live Ops.
2. Сервер выдаёт до 3 билетов на недельный рейтинговый цикл.
3. После старта создаётся серверная сессия на 10 минут.
4. Игрок улучшает три звена: Extraction, Cargo Lift, Logistics.
5. Клиент отправляет только тип действия `upgrade-*`.
6. Сервер сам считает время, Drill Credits, стоимость, throughput и score.
7. После завершения лучший результат игрока попадает в группу его дивизиона.

## Дивизионы

1. Prospect
2. Operator
3. Foreman
4. Specialist
5. Veteran
6. Elite
7. Master
8. Legend

Группа рассчитана примерно на 50 игроков. При 5+ завершивших верхние 15% поднимаются на один дивизион, нижние 15% опускаются. Prospect не понижается, Legend не повышается.

## Серверные награды

По итогам завершённого рейтингового цикла сервер начисляет Blitz Medals. Они хранятся вместе с профилем рейтинга и не зависят от локального save браузера.

## Anti-cheat Stage 15

Клиент НЕ может отправить score. Сервер контролирует:

- время начала и окончания;
- остаток билетов;
- Drill Credits;
- стоимость каждого upgrade;
- уровни трёх звеньев;
- throughput;
- начисление score;
- принадлежность session к Player ID;
- минимальный интервал между actions;
- лучший результат в leaderboard.

Stage 15 ещё не решает проблему подмены самого Player ID. Жёсткая identity/auth-привязка будет отдельным серверным слоем.

## Backend

Маршруты:

- `GET /api/blitz/status`
- `POST /api/blitz/start`
- `POST /api/blitz/action`
- `POST /api/blitz/finish`

При наличии `DATABASE_URL` автоматически используются PostgreSQL-таблицы `blitz_profiles`, `blitz_sessions`, `blitz_entries`. Схема также лежит в `server/sql/002_blitz_leaderboards.sql`.

Без PostgreSQL backend работает в memory-mode для разработки, но данные исчезают после перезапуска процесса.

## GitHub Pages

Статический GitHub Pages не может самостоятельно быть сервером рейтинга. Поэтому на Pages Blitz показывает `SERVER REQUIRED`, пока `VITE_API_URL` не указывает на публичный DEEPFORGE backend/VPS.

Обычная idle-игра при этом продолжает работать полностью.

## Mobile / Portrait

BlitzPanel рассчитан на 360–440 CSS px:

- `100dvh`/safe-area;
- 2×2 summary вместо четырёх колонок;
- три facility-card становятся вертикальными;
- leaderboard имеет внутренний touch-scroll;
- кнопки upgrade не меньше 44px;
- Pro Max получает отдельный bottom safe-area;
- новая Phaser-сцена не создаётся.

## GitHub Actions variable

Workflow Pages теперь передаёт repository variable `VITE_API_URL` в Vite build. После публикации backend достаточно добавить в GitHub:

`Settings → Secrets and variables → Actions → Variables → VITE_API_URL`

и указать публичный HTTPS URL API. Следующий push автоматически соберёт Pages уже с этим backend.
