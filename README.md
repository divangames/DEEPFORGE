# DEEPFORGE: Idle Empire — Stage 12

Browser-first / mobile-first idle tycoon. Основная ориентация телефона — **portrait**.

## Stage 12

Добавлен первый Live Ops режим — **Weekly Contract**.

- отдельная event-экономика и `CT`;
- 3 production facilities;
- ручная смена и event-менеджеры;
- bottleneck и автоматический event-income;
- 8 milestones с постоянными meta-наградами;
- weekly reset;
- background event progress;
- server-time endpoint `/api/time`;
- local fallback для статического GitHub Pages;
- save schema v10;
- portrait UI 360–440 px, включая iPhone Pro Max.

Полное описание: `docs/STAGE_12.md`.

## Запуск

Windows:

```bat
dev.bat
```

Публикация:

```bat
publish.bat "feat: stage 12 weekly contract"
```

`publish.bat` выполняет sync → typecheck → tests → build → commit → push. GitHub Actions публикует клиент на Pages.

## Адрес Pages

https://divangames.github.io/DEEPFORGE/

## Архитектура

- Client: React + TypeScript + Phaser + Vite
- State: Zustand
- Local save: IndexedDB / Dexie
- Backend foundation: Fastify + PostgreSQL
- PWA
- mobile-first / portrait-first
