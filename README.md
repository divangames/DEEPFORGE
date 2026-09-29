# DEEPFORGE: Idle Empire

Браузерная mobile-first idle/tycoon игра. Главный приоритет интерфейса — телефон, затем планшет и ПК.

**Текущий этап: Stage 3 — Offline Income & Save Recovery.**

Публичная игровая сборка после GitHub Actions deploy:

**https://divangames.github.io/DEEPFORGE/**

## Что уже работает

- Полная цепочка `Deck → Lift → Surface Buffer → Logistics → Cash`.
- 3 добывающих Deck.
- Cargo Lift и Logistics Hub.
- Ручной запуск каждого звена.
- Уровни и upgrades.
- 5 обычных менеджеров.
- Найм менеджеров за игровую валюту.
- Автоматическая работа объекта после найма.
- Passive bonus каждого менеджера.
- Active Ability с duration / multiplier / cooldown.
- Вкладка **Команда** с ростером всех менеджеров.
- Статусы `AUTO` и `BOOST` прямо на игровой сцене.
- Настоящий offline income по bottleneck производственной цепочки.
- Окно **«Пока вас не было»**.
- 8-часовой cap автономного дохода.
- Cooldown менеджеров продолжается во время отсутствия.
- Обработка сворачивания browser/PWA через `visibilitychange`.
- Autosave в IndexedDB.
- Primary + backup save recovery.
- Совместимость существующего Stage 2 save со Stage 3.
- PWA foundation.
- Fastify / PostgreSQL foundation для будущего server-authoritative слоя.
- Unit tests производственного цикла, автоматизации и offline-прогресса.

## Как играть сейчас

1. Запускай Deck вручную и получай Ferrite Ore.
2. Lift доставляет ресурс наверх.
3. Logistics превращает ресурс в деньги.
4. Улучшай звенья цепочки.
5. Нанимай менеджеров — каждый менеджер автоматизирует своё звено.
6. Для денежного offline income автоматизируй хотя бы один Deck, Cargo Lift и Logistics Hub.
7. Закрой или сверни игру минимум на 15 секунд.
8. При возврате появится отчёт о работе объекта в твоё отсутствие.

## Быстрый запуск Windows

`dev.bat`

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

Можно передать название коммита:

`publish.bat "feat: stage 3 offline income"`

Скрипт синхронизируется с `origin/main`, выполняет проверки, production build, commit и push в `divangames/DEEPFORGE`. После push GitHub Actions обновляет Pages.

## Где находится логика

Экономика, Managers и offline progression:

`client/src/game/core/MineSimulation.ts`

Баланс:

`client/src/game/core/balance.ts`

Сохранения и backup:

`client/src/db/saveRepository.ts`

Phaser-сцена и lifecycle браузера:

`client/src/game/scenes/FoundationScene.ts`

React UI:

`client/src/ui/App.tsx`

Документация Stage 3:

`docs/STAGE_3.md`

## Следующий этап

**Stage 4 — Full Mine.**

- 20–30 уровней шахты;
- barriers;
- vertical scrolling;
- unlock progression;
- bulk upgrades;
- milestones;
- bottleneck UI.
