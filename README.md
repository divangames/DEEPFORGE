# DEEPFORGE: Idle Empire — Stage 14

Browser-first / mobile-first idle tycoon. Основная ориентация телефона — **portrait**.

## Stage 14

Добавлены **Friends + Crew Missions**.

- постоянный Player ID `DF-XXXX-XXXX`;
- список до 20 друзей;
- +2% global income за друга, cap +10%;
- bonus работает в live/background/offline экономике;
- 3 Crew Mission offers за цикл;
- Common 6h / Rare 12h / Epic 24h / Legendary 48h;
- до 3 друзей могут подключиться к активной операции;
- каждый JOIN сокращает оставшееся время на 15%;
- meta rewards за Crew Missions;
- server-time при доступном backend, local fallback на GitHub Pages;
- save schema v12;
- отдельный portrait-pass 360–440 px и iPhone Pro Max.

Полное описание: `docs/STAGE_14.md`.

## Запуск

Windows:

```bat
dev.bat
```

Публикация:

```bat
publish.bat "feat: stage 14 friends crew missions"
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
