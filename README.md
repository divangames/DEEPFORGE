# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 6 — Multi-Sector Economy**.

## Уже работает

- глобальная карта из 8 секторов;
- 40 data-driven добывающих объектов — по 5 на сектор;
- отдельная валюта каждого сектора;
- общий кошелёк пяти шахт внутри одного сектора;
- последовательное открытие секторов и объектов;
- независимый прогресс каждой шахты;
- background income неактивных автоматизированных шахт;
- offline income по правильным валютам регионов;
- 30 добывающих Deck на каждом объекте;
- Cargo Lift и Logistics Hub;
- Managers, AUTO и active abilities;
- barriers, bulk upgrades и milestones;
- bottleneck HUD;
- primary + backup IndexedDB save;
- mobile-first swipe / desktop wheel;
- PWA;
- GitHub Pages deployment.

## Сектора мира

`Rust Valley → Glacier Belt → Ember Fault → Aurora Steppe → Twilight Basin → Relic Wastes → Sunken Shelf → Storm Cradle`

Новая зона открывается только после прогресса предыдущей. У каждой — собственная экономика и валюта.

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
publish.bat "feat: stage 6 multi sector economy"
```

`publish.bat` сначала синхронизируется с `origin/main`, затем запускает typecheck, tests, production build, commit и push. GitHub Actions обновляет Pages.

Публичная версия:

`https://divangames.github.io/DEEPFORGE/`

## Документация этапов

- `docs/STAGE_0.md`
- `docs/STAGE_1.md`
- `docs/STAGE_2.md`
- `docs/STAGE_3.md`
- `docs/STAGE_4.md`
- `docs/STAGE_5.md`
- `docs/STAGE_6.md`
