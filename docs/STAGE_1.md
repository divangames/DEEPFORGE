# Stage 1 — Core Vertical Slice

## Цель

Получить не макет, а минимальную рабочую idle/tycoon игру с настоящей производственной цепочкой.

## Производственная цепочка

`Deck → Deck Buffer → Cargo Lift → Surface Buffer → Logistics → Cash`

Каждое звено существует отдельно. Руда не превращается в деньги сразу после добычи.

### Excavation Deck

У каждого из 3 Deck собственные:

- level;
- buffer;
- yield;
- cycle duration;
- active task.

Пока task активен, повторный запуск того же Deck запрещён.

### Cargo Lift

При ручном запуске Lift ищет самый глубокий Deck с ненулевым buffer.

В середине цикла он физически забирает ограниченное количество руды согласно своей capacity.

В конце цикла груз попадает в `surfaceBuffer`.

### Logistics Hub

При запуске забирает из `surfaceBuffer` груз в пределах своей capacity.

После завершения цикла:

`revenue = cargo × resourcePrice`

Деньги начисляются игроку.

## Stage 1 balance

Все временные значения находятся в:

`client/src/game/core/balance.ts`

Их нельзя размазывать по React/Phaser-компонентам.

## Upgrade

Для объекта уровня L:

`cost = baseCost × growth^(L - 1)`

Deck upgrade:

- увеличивает yield;
- постепенно сокращает cycle duration.

Lift upgrade:

- увеличивает capacity;
- сокращает cycle duration.

Logistics upgrade:

- увеличивает capacity;
- сокращает cycle duration.

## Persistence

Stage 1 уже сохраняет в IndexedDB:

- cash;
- surfaceBuffer;
- Deck levels;
- Deck buffers;
- Lift level;
- Logistics level;
- lifetime ore;
- lifetime cash.

Активный незавершённый цикл при refresh не сохраняется. Полная offline/recovery логика запланирована на Stage 3.

## Mobile UX

Главные действия доступны без hover:

- tap по Deck;
- tap по Lift;
- tap по Logistics;
- большая кнопка запуска выбранного объекта;
- большая кнопка upgrade.

Минимальная зона основных UI-кнопок — около 44–48 px.

## Definition of Done

Stage 1 считается завершённым, если автоматические тесты подтверждают полный цикл и production client build собирается в GitHub Actions.
