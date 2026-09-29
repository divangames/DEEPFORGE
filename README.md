# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 7 — Rebuild / Prestige + Mobile Portrait Optimization**.

## Уже работает

- глобальная карта из 8 секторов;
- 40 data-driven добывающих объектов — по 5 на сектор;
- отдельная валюта каждого сектора;
- общий кошелёк пяти шахт внутри одного сектора;
- последовательное открытие секторов и объектов;
- независимый прогресс каждой шахты;
- **Rebuild / Prestige для каждой шахты с постоянным multiplier**;
- background income неактивных автоматизированных шахт;
- offline income по правильным валютам регионов;
- 30 добывающих Deck на каждом объекте;
- Cargo Lift и Logistics Hub;
- Managers, AUTO и active abilities;
- barriers, bulk upgrades и milestones;
- bottleneck HUD;
- primary + backup IndexedDB save;
- save schema v5 с миграцией старых Stage 0–6;
- mobile-first portrait UI 360–430 px;
- swipe / touch в шахте, scrollable panels и safe-area support;
- adaptive LOW / MEDIUM / HIGH render profile;
- offscreen culling Deck и barriers;
- PWA;
- GitHub Pages deployment.

## Rebuild

Rebuild применяется **только к текущему объекту**.

Сбрасываются:

- уровни Deck / Lift / Logistics;
- открытые Deck и barriers;
- локальные Managers;
- локальные ore buffers.

Сохраняются:

- общий кошелёк сектора;
- открытые шахты и сектора;
- lifetime earnings / ore statistics;
- Rebuild level и постоянный multiplier.

Текущие Rebuild-множители:

`R0 ×1 → R1 ×1.8 → R2 ×3 → R3 ×4.7 → R4 ×7 → R5 ×10.5 → R6 ×16`

Требования зависят от глубины шахты и revenue текущего Rebuild-цикла. Экономика вынесена в `client/src/game/core/balance.ts`.

## Mobile portrait

Основной мобильный режим: **вертикальный экран**.

Проверять минимум:

- 360×640;
- 375×667;
- 390×844;
- 412×915;
- 430×932.

На коротких экранах нижняя панель объекта имеет собственный scroll, карта делится на viewport карты + scrollable information area, а debug badge скрывается.

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
publish.bat "feat: stage 7 rebuild prestige mobile portrait"
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
- `docs/STAGE_7.md`
