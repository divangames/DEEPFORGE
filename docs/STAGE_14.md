# Stage 14 — Friends + Crew Missions

Stage 14 добавляет социальный слой без тяжёлых игровых сцен и без нарушения mobile-first архитектуры.

## Player ID

- каждому save автоматически назначается стабильный ID вида `DF-XXXX-XXXX`;
- ID хранится в save и не меняется между перезапусками;
- в Crew-панели ID можно скопировать;
- до подключения аккаунтов синхронизация списка друзей работает локально, а таймеры используют server-time при доступном backend.

## Friends

- максимум 20 записей в списке;
- добавление по Player ID;
- нельзя добавить себя или один ID повторно;
- каждый друг даёт +2% глобального income;
- бонус ограничен +10%;
- bonus применяется к live, background и offline экономике всех 40 шахт.

## Crew Missions

Одновременно показываются три операции. После завершения набор ротируется.

- Common — 6 часов;
- Rare — 12 часов;
- Epic — 24 часа;
- Legendary — 48 часов и периодически заменяет Epic-слот.

Операция работает по absolute timestamp. После старта можно подключить до 3 друзей. Каждый присоединившийся друг уменьшает оставшееся время на 15%.

Награды включают:

- Research Cores;
- Recruit Data;
- Training Modules;
- Promotion Badges;
- Supply Keys;
- Craft Materials.

Claim защищён от повторного получения, а количество завершённых операций хранится в save.

## Mobile / Portrait

Crew Network расположен внутри `Команда → Crew`, чтобы не расширять нижнюю навигацию.

- 360–440 CSS px portrait;
- отдельный внутренний scroll;
- iPhone 11 → 17 Pro Max safe-area;
- input имеет 16px font-size на iOS, чтобы Safari не делал auto-zoom;
- 5 Team tabs листаются горизонтально и не ломают ширину панели;
- на 360–390 px mission cards и friend controls перестраиваются в один столбец.

## Performance

- Social/Crew — data-only слой;
- новых Phaser scenes нет;
- friend bonus — один числовой multiplier;
- одновременно хранится максимум 20 friend records и одна активная Crew Mission;
- countdown использует существующий UI sync tick и не создаёт отдельный animation loop.

## Save

Schema version: **v12**.

Stage 13 автоматически получает новый Player ID и пустой social state без потери остального прогресса.
