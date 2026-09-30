# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 9 — Specialists + iPhone Portrait Pass**.

## Уже работает

- глобальная карта из 8 секторов;
- 40 data-driven добывающих объектов — по 5 на сектор;
- отдельная валюта каждого сектора;
- общий кошелёк пяти шахт внутри одного сектора;
- последовательное открытие секторов и объектов;
- независимый прогресс каждой шахты;
- **Rebuild / Prestige для каждой шахты с постоянным multiplier**;
- **Research Grid: 6 веток / 18 глобальных исследований**;
- **6 Specialists: rarity, levels, assignment, passive/active abilities**;
- 3 Specialist slots на каждую шахту: Extraction / Lift / Logistics;
- Research Cores за Rebuild, зависимости узлов и respec с комиссией;
- background income неактивных автоматизированных шахт;
- offline income по правильным валютам регионов;
- 30 добывающих Deck на каждом объекте;
- Cargo Lift и Logistics Hub;
- Managers, AUTO и active abilities;
- barriers, bulk upgrades и milestones;
- bottleneck HUD;
- primary + backup IndexedDB save;
- save schema v7 с миграцией старых Stage 0–8;
- mobile-first portrait UI 360–440 px с отдельным iPhone 11–17 Pro Max pass;
- swipe / touch в шахте, scrollable panels и safe-area support;
- adaptive LOW / MEDIUM / HIGH render profile;
- offscreen culling Deck и barriers;
- PWA;
- GitHub Pages deployment.


## Specialists

В `Команда → Specialists` доступен глобальный roster. Один Specialist может быть назначен только в одну шахту одновременно. Passive-бонусы работают и в offline income, active abilities — только в активной шахте. Уровни 1–10 улучшают passive и active значения.

Стартовые Rook Hale, Ion Reyes и Talia Cruz доступны сразу; более редкие персонажи открываются за суммарные Rebuild milestones. Stage 10 добавит Academy, fragments и полноценную Specialist-прогрессию.

## Research Grid

Глобальные исследования действуют сразу на все текущие и будущие шахты. Ветки: Industry, Logistics, Automation, Exploration, Specialists и Events.

Research Cores (`◈`) выдаются за Rebuild. Первые 3 доступны сразу. Узлы имеют зависимости и стоимость; Reset возвращает вложенные Cores за вычетом 15% комиссии (минимум 1 Core).

Research влияет на добычу, цену сырья, Lift/Logistics, стоимость upgrades, менеджеров, barriers, стоимость открытия Deck и offline income/cap.

Mobile portrait: на телефоне одновременно рендерится только выбранная ветка из 3 узлов; tabs горизонтально прокручиваются, panel ограничена `100dvh`.

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

- 360×780 — compact iPhone class;
- 375×812;
- 390×844;
- 393×852;
- 402×874;
- 414×896;
- 428×926;
- 430×932 — iPhone 14/15 Pro Max class;
- 440×956 — large Pro Max class.

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
publish.bat "feat: stage 9 specialists iphone portrait"
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
- `docs/STAGE_8.md`
- `docs/STAGE_9.md`
