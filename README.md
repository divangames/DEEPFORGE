# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 5 — World Map / Rust Valley**.

## Уже работает

- интерактивная карта Rust Valley;
- 5 независимых добывающих объектов;
- переход между шахтами без потери прогресса;
- фоновая работа автоматизированных неактивных шахт;
- разные ресурсы и экономические коэффициенты объектов;
- 30 добывающих Deck на каждом объекте;
- ручная и автоматическая добыча;
- Cargo Lift и Logistics Hub;
- regular Managers и активные способности;
- offline income до 8 часов;
- primary + backup save в IndexedDB;
- последовательное открытие Deck;
- барьеры между секциями шахты;
- bulk upgrades ×1 / ×10 / ×25 / MAX;
- milestones производительности;
- bottleneck-индикатор;
- mobile swipe / desktop wheel;
- PWA;
- GitHub Pages deployment.

## Запуск разработки

```bat
dev.bat
```

Клиент: `http://localhost:5173`

API: `http://localhost:3001/api/health`

## Production check

```bat
build.bat
```

## Публикация

```bat
publish.bat "feat: stage 5 rust valley world map"
```

`publish.bat` синхронизируется с `origin/main`, запускает typecheck, tests, production build, создаёт commit и делает push. GitHub Actions затем обновляет Pages.

Публичная версия:

`https://divangames.github.io/DEEPFORGE/`

## Документация этапов

- `docs/STAGE_0.md`
- `docs/STAGE_1.md`
- `docs/STAGE_2.md`
- `docs/STAGE_3.md`
- `docs/STAGE_4.md`
- `docs/STAGE_5.md`
