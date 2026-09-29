# Changelog

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
