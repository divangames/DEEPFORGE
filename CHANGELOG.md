# Changelog

## Stage 13 — Seasonal Campaign

- Четырёхнедельная seasonal campaign поверх Weekly Contract.
- 20 уровней Season Progress и формула cumulative XP.
- Weekly milestones теперь дают Season XP: суммарно 1910 XP за полный недельный контракт.
- Free Track с claimable meta rewards.
- Premium Track с готовым entitlement-state и ретроактивными наградами; покупка подключится на Stage 22.
- Season reward claim защищён от повторного получения.
- Используется единый server/local clock Live Ops.
- Save schema v11 + Stage 12 migration с компенсацией XP за уже claimed weekly milestones.
- Live Ops HUD объединён в компактный stack Weekly + Season.
- Season panel адаптирован под portrait 360–440 px, safe-area и Pro Max-class viewport.
- Seasonal system остаётся data-driven и не добавляет Phaser scenes/animation loops.

## Stage 12 — Weekly Contract

- Первый недельный live-ops контракт с отдельной event-экономикой.
- CT currency, 3 production facilities, event-managers и manual shift.
- Автоматический income через bottleneck после найма всей цепочки.
- 8 milestones с meta rewards.
- Weekly reset и 4h background event progress.
- `/api/time` и server-clock offset с local fallback.
- Save schema v10 + миграция Stage 11.
- Fullscreen portrait UI 360–440 px с safe-area.
- Event слой data-driven, без второй Phaser scene.

# CHANGELOG — DEEPFORGE

## 0.11.0 — Stage 11 Equipment + Collection + Relics

### Добавлено

- Equipment crafting: 8 предметов Common / Rare / Epic / Legendary.
- 3 crafting materials: Alloy, Circuits и Fiber.
- Один Equipment slot на Specialist с role compatibility.
- Equipment реально усиливает passive / active и может уменьшать cooldown.
- Academy Operations теперь также выдают crafting materials и Supply Keys.
- Crew Collection: 9 карточек/визуальных наборов в категориях Crew / Cargo Lift / Logistics.
- Supply Crates по 3 карточки; дубликаты повышают level до 5.
- Один активный Collection visual на каждую категорию.
- Collection bonuses реально влияют на Deck / Lift / Logistics throughput.
- Временные prototype-colors выбранных Collection visuals применяются прямо к Phaser scene; финальные арты позже заменяются Adobe assets.
- 6 permanent Corporate Relics с auto-unlock за Rebuild, mines, Specialists, Academy, Collection и Equipment.
- Relic bonuses действуют во всех 40 шахтах, включая background/offline income.
- `Команда → Meta` с отдельными вкладками Equipment / Collection / Relics.
- Save schema v9 и миграция Stage 10 → Stage 11 со starter materials/keys без потери старого прогресса.
- Unit coverage Equipment / Collection / Relics.

### Mobile / Performance

- Meta UI рассчитан на portrait 360–440 CSS px и iPhone Pro Max safe-area.
- Equipment Specialist selector использует лёгкий horizontal list вместо одновременной отрисовки дополнительных экранов.
- Collection содержит только 9 data-driven cards; Relics — 6 записей, без новых Phaser scenes.
- Collection visuals меняют цвета существующих объектов и не создают дополнительные sprites/particles.
- Relic context кэшируется и пересчитывается только при изменении meta-прогресса.

## 0.10.0 — Stage 10 Academy + Fragments + Rank / Promotion

### Добавлено

- Academy Operations: 30 data-driven timed operations.
- Recruit Data, Training Modules и Promotion Badges.
- Recruitment Signal Scan за Recruit Data.
- Specialist fragments и отдельный Recruit flow.
- Rank 1–5 с fragment cost и усилением passive/active.
- Promotion 0–3 с level cap 10 → 15 → 20 → 25.
- Training переведён с sector currency на Academy Training Modules.
- Reward fragments за Academy operations.
- Team получила третью вкладку Academy.
- Save schema v8.
- Stage 9 → Stage 10 migration сохраняет levels/assignments/timers и recruited-персонажей.
- Компенсация Training Modules за уже прокачанные Stage 9 levels.
- Academy и Specialist progression unit coverage.

### Mobile / Performance

- Academy portrait layout для 360–440 CSS px.
- 3-column Team tabs без горизонтального overflow.
- Academy operation list использует внутренний touch-scroll.
- iPhone safe-area / Dynamic Island / home indicator правила сохранены.
- Academy timer работает по absolute timestamp и не создаёт animation loop.
- Новых Phaser scenes для Academy нет.

## 0.9.0 — Stage 9 Specialists + iPhone Portrait Pass

### Добавлено

- 6 уникальных Specialists с rarity, role, level 1–10, passive и active abilities.
- 3 Specialist slots на каждую шахту: Extraction, Cargo Lift, Logistics.
- Глобальное назначение: один Specialist не может одновременно работать в нескольких шахтах.
- Starter Specialists + unlock milestones через суммарные Rebuild.
- Training за валюту активного сектора.
- Active ability duration/cooldown с сохранением.
- Specialist passives учитываются в live/background/offline calculations.
- Research Specialist branch теперь усиливает passives и уменьшает cooldown.
- Save schema v7 и миграция Stage 8 → Stage 9.
- Unit coverage assignment, unlocks, training, active cooldown и migration.

### iPhone / Portrait

- Отдельный adaptive pass для iPhone 11–17 Pro Max-class viewport.
- Исправлен двойной safe-area расход высоты на iPhone.
- Dynamic Island/notch учитывается верхней панелью, home indicator — нижней.
- `100dvh`/fixed viewport handling для Safari и PWA.
- Отдельные compact и Pro Max media rules в диапазоне 360–440 CSS px.
- Team / Research / Rebuild / Offline / World Map panels ограничены реальным viewport.
- На телефоне в landscape появляется экран поворота в portrait.

### Performance

- Specialist modifiers считаются только для трёх slots конкретной шахты.
- Inactive mines получают только passive modifiers, без дополнительных Phaser scenes.
- Specialist timers — лёгкая глобальная структура из 6 профилей.


## 0.8.0 — Stage 8 Research Grid

### Добавлено

- Глобальная Research Grid: 6 веток и 18 data-driven узлов.
- Research Cores (`◈`) как постоянный meta-resource.
- 3 стартовых Research Cores для новой игры.
- Research Cores за каждый успешный Rebuild.
- Dependencies между tier 1 → tier 2 → tier 3 внутри веток.
- Respec с возвратом Cores за вычетом комиссии.
- Research bonuses для добычи, цены сырья, Lift, Logistics, upgrade cost, manager passives/cooldowns, barriers, Deck unlock cost, offline income и offline cap.
- Global Research применяется ко всем 40 шахтам, включая background/offline calculations.
- Save schema v6 и миграция Stage 7 → Stage 8 с компенсацией Research Cores за уже сделанные Rebuild.
- Unit tests Research purchase/dependencies/respec и Research modifiers в MineSimulation.

### Mobile / Performance

- Research UI спроектирован portrait-first: один branch на экране, 3 node cards вместо отрисовки всего дерева.
- Branch tabs используют горизонтальный touch-scroll.
- Research panel ограничена `100dvh`, node list имеет собственный scroll.
- На 360–390 px research cards переходят в компактный однострочный формат.
- Bottom navigation адаптирована под 5 разделов без выхода за ширину вертикального телефона.
- Никаких дополнительных Phaser scenes или постоянных animation loops для Research.


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
