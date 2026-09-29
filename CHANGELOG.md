# CHANGELOG — DEEPFORGE

## 0.7.0 — Stage 7 Rebuild / Prestige + Mobile Portrait Optimization

### Добавлено

- Rebuild / Prestige для каждой отдельной шахты.
- 6 уровней Rebuild с постоянными multiplier до ×16.
- Требования по unlocked Deck и revenue текущего Rebuild-цикла.
- Полноценный Rebuild preview с явным списком потерь и сохраняемого прогресса.
- Rebuild status в HUD и на World Map.
- Save schema v5 и автоматическая миграция Stage 6 → Stage 7.
- После Rebuild выручка текущего цикла сбрасывается, поэтому следующий tier нельзя получить за старую lifetime-статистику.
- Unit coverage для eligibility, reset, multiplier и save persistence.

### Mobile / UX

- Отдельный portrait-first pass для 360–430 px.
- Upgrade dock получил max-height и внутренний scroll на телефоне.
- World Map теперь использует фиксированный canvas + scrollable info panel в portrait.
- Более компактные topbar, bottom nav, manager cards, bulk controls и HUD.
- Отдельные правила для коротких экранов до 700 px.
- Safe-area сохранён для iPhone / PWA.

### Performance

- Offscreen culling для 30 Deck и barrier visuals.
- LOW quality target: 30 FPS, antialias off, 1x render resolution.
- HIGH DPR ограничен 1.5, чтобы мобильные Retina-экраны не рендерили лишние пиксели.
- Background mines по-прежнему считаются аналитически без дополнительных Phaser scenes.

# Changelog

## Stage 6 — Multi-Sector Economy

- Добавлен World Atlas из 8 секторов и 40 mine definitions.
- Добавлена отдельная валюта для каждого сектора.
- Пять шахт одного сектора теперь используют общий wallet.
- Добавлены условия последовательного открытия секторов.
- Добавлена двухуровневая навигация World Atlas → Sector Map.
- Background/offline income распределяется по правильным sector wallets.
- Offline summary показывает награды отдельно по валютам.
- Добавлены Glacier Belt, Ember Fault, Aurora Steppe, Twilight Basin, Relic Wastes, Sunken Shelf и Storm Cradle.
- Save schema обновлена до v4.
- Stage 5 cash автоматически мигрирует в Rust Credits без потери накоплений.
- Добавлены Stage 6 world configuration и save migration tests.
- Stage badge обновлён до Stage 6.

## Stage 3 — Offline Income & Save Recovery

- Добавлен аналитический offline income по реальному bottleneck производственной цепочки.
- Добавлен 8-часовой cap автономного дохода.
- Добавлено окно «Пока вас не было» с временем, доходом, ore и скоростью idle-экономики.
- Менеджерские cooldown и active timers теперь продолжаются во время отсутствия.
- Добавлена корректная обработка `visibilitychange` для мобильных браузеров и PWA.
- Симуляция не тикает одновременно с offline-расчётом, что исключает двойное начисление.
- После начисления состояние немедленно сохраняется, поэтому refresh не дублирует награду.
- Добавлен backup-слот IndexedDB и fallback-загрузка при повреждении primary save.
- Добавлены unit-тесты offline income, неполной автоматизации, cap и cooldown.
- UI badge обновлён до `STAGE 3`.

# CHANGELOG — DEEPFORGE

## 0.2.0 — Stage 2 Managers & Automation

### Добавлено

- 5 обычных Managers для трёх Deck, Cargo Lift и Logistics Hub.
- Найм менеджеров за игровую валюту.
- Полностью автоматический перезапуск рабочих циклов после найма.
- Passive bonus менеджеров к добыче/вместимости.
- Active abilities с multiplier, duration и cooldown.
- Вкладка «Команда» с ростером менеджеров.
- Управление наймом и abilities из панели выбранного объекта и общего ростера.
- Статусы `AUTO` / `BOOST` на Phaser-сцене.
- Сохранение найма, active timer и cooldown в IndexedDB.
- Совместимость Stage 1 save: новые manager-поля опциональны.
- Unit tests автоматизации и manager abilities.
- `docs/STAGE_2.md`.
- Усилен `.gitignore`: build metadata и локальные zip-снимки больше не должны попадать в Git.

### UX

- В шапке отображается количество нанятых менеджеров.
- Панель выбранного объекта показывает назначенного Manager, бонус и ability.
- Вкладка «Команда» работает как bottom sheet на телефоне и боковая панель на ПК.

## 0.1.0 — Stage 1 Core Vertical Slice

### Добавлено

- Полная ручная цепочка `Deck → Lift → Surface Buffer → Logistics → Cash`.
- Три независимых Excavation Deck.
- Буферы руды каждого Deck.
- Cargo Lift с ограничением вместимости.
- Logistics Hub с отдельной вместимостью и циклом продажи.
- Формула стоимости upgrade.
- Прокачка Deck / Lift / Logistics.
- Временная Phaser-визуализация работников, руды, лифта и транспорта.
- Выбор объекта тапом.
- Mobile-first панель выбранного объекта.
- Кнопка ручного запуска.
- Кнопка улучшения с проверкой денег.
- Компактное форматирование чисел.
- Сохранение Stage 1 в IndexedDB.
- Unit tests для полного производственного цикла и upgrades.
- GitHub Pages workflow.
- `publish.bat`: проверки → build → commit → push → автоматический Pages deploy.
- Документация `docs/STAGE_1.md`.

### Архитектура

- Игровая экономика отделена от Phaser-графики.
- Баланс вынесен в `client/src/game/core/balance.ts`.
- Команды React ↔ Phaser проходят через runtime command bus.

## 0.0.1 — Stage 0 Foundation

- React + TypeScript.
- Phaser shell.
- Vite.
- PWA foundation.
- Zustand.
- Dexie / IndexedDB.
- Fastify API.
- PostgreSQL foundation.
- Responsive shell.
- LOW / MEDIUM / HIGH quality tier.
- Windows `.bat` scripts.

## Stage 4 — Full Mine

### Added
- 30 добывающих Deck вместо трёх.
- Последовательное открытие Deck 04–30.
- 5 timed barriers между группами по 5 уровней.
- Вертикальный wheel/drag/swipe по глубокой шахте.
- Bulk upgrades ×1 / ×10 / ×25 / MAX.
- Milestones 10 / 25 / 50 / 100 / 200 / 500.
- Dynamic regular managers для новых Deck.
- Bottleneck HUD: добыча / Lift / Logistics.
- Barrier status strip и interleaved barrier blocks на сцене.
- Stage 1–3 save migration в новую 30-level структуру.

### Changed
- Экономика масштабируется по глубине Deck.
- Панель объекта различает unlocked / accessible / sealed уровни.
- Team roster показывает менеджеров только открытых звеньев.
- Stage badge обновлён до Stage 4.

## Stage 5 — World Map / Rust Valley

### Added
- Full-screen Rust Valley world map.
- Five independent mine sites with their own progress and save state.
- Sequential site unlock progression.
- Per-mine resources, prices and production/logistics tuning.
- Background idle progression for inactive automated mines.
- Per-mine `lastSimulatedAt` timestamps.
- World map site cards with cash, income/s, Deck count and lifetime earnings.
- Mobile map layout and desktop side information panel.
- `worldConfig.ts` data-driven mine definitions.
- Save schema v3 and automatic single-mine save migration.
- Stage 5 world configuration and migration tests.

### Changed
- Top bar now displays the active Rust Valley site.
- Offline summary can aggregate multiple operating mines.
- Phaser environment receives a temporary theme per site.
- Stage badge updated to Stage 5.
