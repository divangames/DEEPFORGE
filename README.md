# DEEPFORGE: Idle Empire — Stage 13

Browser-first / mobile-first idle tycoon. Основная ориентация телефона — **portrait**.

## Stage 13

Добавлена **Seasonal Campaign** поверх Weekly Contract.

- сезон на 4 недели;
- 20 уровней Season Progress;
- Season XP за Weekly Contract milestones;
- Free Track + готовый Premium entitlement-layer;
- claimable meta rewards;
- Premium rewards ретроактивны после будущей активации Store;
- server/local clock integration;
- save schema v11;
- автоматическая компенсация Season XP за уже полученные Stage 12 milestones;
- компактный Live Ops HUD и portrait UI 360–440 px, включая iPhone Pro Max.

Полное описание: `docs/STAGE_13.md`.

## Запуск

Windows:

```bat
dev.bat
```

Публикация:

```bat
publish.bat "feat: stage 13 seasonal campaign"
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
