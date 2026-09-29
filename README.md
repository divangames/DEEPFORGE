# DEEPFORGE: Idle Empire

Браузерная mobile-first idle/tycoon игра. Главный приоритет интерфейса — телефон, затем планшет и ПК.

**Текущий этап: Stage 1 — Core Vertical Slice.**

Публичная игровая сборка после успешного GitHub Actions deploy:

**https://divangames.github.io/DEEPFORGE/**

## Что работает в Stage 1

- 3 добывающих Deck.
- Ручной запуск добычи тапом/кликом.
- Реальные отдельные буферы руды каждого Deck.
- Cargo Lift, который забирает руду с самого глубокого непустого Deck.
- Surface Buffer.
- Logistics Hub, превращающий доставленную руду в деньги.
- Полный цикл: `добыча → Deck Buffer → Lift → Surface → Logistics → Cash`.
- Уровни и апгрейды всех 3 Deck, Lift и Logistics.
- Цена улучшений растёт по формуле из balance config.
- Улучшения влияют на производительность, вместимость и скорость цикла.
- Временная интерактивная Phaser-графика.
- Mobile-first UI без hover-зависимых действий.
- Локальное сохранение Stage 1 в IndexedDB.
- PWA-заготовка.
- Fastify backend foundation.
- PostgreSQL foundation.
- Unit tests для производственного цикла.

## Управление

1. Нажми на один из трёх Deck — рабочий начнёт добычу.
2. Когда в одном из Deck появилась руда, нажми на жёлтый Lift.
3. После доставки руды наверх нажми на Logistics.
4. Полученные деньги трать на улучшения выбранного объекта.

То же самое можно запускать большой кнопкой `ЗАПУСТИТЬ` под сценой.

## Быстрый запуск Windows

`dev.bat`

При первом запуске автоматически выполняется `npm install`.

Клиент:

`http://localhost:5173`

API:

`http://localhost:3001/api/health`

## Проверка

`build.bat`

Порядок:

1. TypeScript typecheck.
2. Unit tests.
3. Production build клиента и сервера.

## Публикация одной кнопкой

`publish.bat`

Он:

1. устанавливает зависимости, если нужно;
2. выполняет typecheck;
3. выполняет тесты;
4. делает production build;
5. добавляет изменённые файлы в Git;
6. создаёт commit;
7. делает push в `divangames/DEEPFORGE`;
8. GitHub Actions автоматически пересобирает GitHub Pages;
9. открывает игровую страницу в браузере.

Можно передать свой текст коммита:

`publish.bat "feat: stage 2 automation"`

Без аргумента создаётся автоматический commit message с датой и временем.

## Архитектура Stage 1

Экономическая симуляция вынесена из Phaser в чистый TypeScript:

`client/src/game/core/MineSimulation.ts`

Графика:

`client/src/game/scenes/FoundationScene.ts`

Баланс:

`client/src/game/core/balance.ts`

UI:

`client/src/ui/App.tsx`

Это позволяет далее менять всю графику через Adobe без переписывания экономики.

## Следующий этап

**Stage 2 — Automation.**

- обычные Managers;
- назначение Manager на Deck / Lift / Logistics;
- автоматическая работа;
- базовые manager bonuses;
- cooldown активных способностей;
- экран назначения Manager;
- сохранение назначений.
