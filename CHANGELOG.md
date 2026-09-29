# CHANGELOG — DEEPFORGE

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
