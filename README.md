# DEEPFORGE: Idle Empire — Stage 15

Browser-first / mobile-first idle tycoon. Основной режим — вертикальный телефон, затем планшет и ПК.

## Что добавлено в Stage 15

**Server-authoritative Leaderboards + Blitz Drill**:

- 10-минутная рейтинговая сессия;
- 3 билета на недельный цикл;
- 8 дивизионов Prospect → Legend;
- группы примерно по 50 игроков;
- promotion/demotion по рейтингу;
- Blitz Medals;
- PostgreSQL persistence + memory fallback;
- клиент не отправляет score — только допустимые upgrade-actions;
- мобильный leaderboard UI 360–440 px.

Подробности: `docs/STAGE_15.md`.

## Запуск

Windows: `dev.bat`

Публикация клиента на GitHub Pages:

```bat
publish.bat "feat: stage 15 server authoritative leaderboards"
```

## Важно про GitHub Pages

Для живого рейтинга нужен публичный backend. Укажите его через `VITE_API_URL` при сборке Pages. Пока backend не опубликован, Blitz корректно показывает `SERVER REQUIRED`, а основная игра продолжает работать локально/offline.
