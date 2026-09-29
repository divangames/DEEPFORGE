# DEEPFORGE: Idle Empire

Браузерная mobile-first idle/tycoon игра. Главный приоритет интерфейса — телефон, затем планшет и ПК.

**Текущий этап: Stage 2 — Managers & Automation.**

Публичная игровая сборка после GitHub Actions deploy:

**https://divangames.github.io/DEEPFORGE/**

## Что работает

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
- Отдельная вкладка **Команда** с ростером всех менеджеров.
- Статусы `AUTO` и `BOOST` прямо на игровой сцене.
- Сохранение менеджеров и cooldown в IndexedDB.
- Совместимость существующего Stage 1 save со Stage 2.
- PWA foundation.
- Fastify / PostgreSQL foundation для будущего server-authoritative слоя.
- Unit tests производственного цикла и автоматизации.

## Как играть сейчас

1. Запускай Deck вручную и получай Ferrite Ore.
2. Lift доставляет ресурс наверх.
3. Logistics превращает ресурс в деньги.
4. Улучшай звенья цепочки.
5. Нанимай менеджеров — каждый нанятый менеджер автоматизирует своё звено.
6. Нажимай ability менеджера для временного ускорения.
7. Открой **Команда**, чтобы управлять всеми 5 менеджерами из одного окна.

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

`publish.bat "feat: stage 2 managers and automation"`

Скрипт выполняет проверки, production build, commit, push в `divangames/DEEPFORGE`, после чего GitHub Actions обновляет Pages.

## Где находится логика

Экономика и Managers:

`client/src/game/core/MineSimulation.ts`

Баланс:

`client/src/game/core/balance.ts`

Phaser-сцена:

`client/src/game/scenes/FoundationScene.ts`

React UI:

`client/src/ui/App.tsx`

Документация Stage 2:

`docs/STAGE_2.md`

## Следующий этап

**Stage 3 — Idle + Save.**

- offline income;
- окно возврата;
- расчёт времени отсутствия;
- save migrations;
- recovery повреждённого save;
- защита от проблем с несколькими вкладками.
