# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 4 — Full Mine**.

## Уже работает

- 30 добывающих Deck;
- ручная и автоматическая добыча;
- Cargo Lift и Logistics Hub;
- regular Managers и активные способности;
- offline income до 8 часов;
- primary + backup save в IndexedDB;
- последовательное открытие уровней;
- барьеры между секциями шахты;
- bulk upgrades ×1 / ×10 / ×25 / MAX;
- milestones производительности;
- bottleneck-индикатор;
- мобильный свайп и desktop wheel по шахте;
- PWA;
- GitHub Pages deployment.

## Запуск разработки

```bat
dev.bat
```

Клиент: `http://localhost:5173`

API: `http://localhost:3001/api/health`

## Проверка production build

```bat
build.bat
```

## Публикация

```bat
publish.bat "feat: stage 4 full mine progression"
```

`publish.bat` выполняет синхронизацию с `origin/main`, typecheck, tests, production build, commit и push. После push GitHub Actions обновляет GitHub Pages.

Публичная версия:

`https://divangames.github.io/DEEPFORGE/`

## Документация этапов

- `docs/STAGE_0.md`
- `docs/STAGE_1.md`
- `docs/STAGE_2.md`
- `docs/STAGE_3.md`
- `docs/STAGE_4.md`
