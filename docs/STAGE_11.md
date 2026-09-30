# Stage 11 — Equipment + Collection + Relics

## Цель

Добавить три постоянных meta-слоя поверх Specialists без тяжёлых сцен и без нарушения mobile-first архитектуры.

## Equipment

- 8 data-driven предметов.
- Редкости: Common / Rare / Epic / Legendary.
- Ресурсы крафта: Alloy, Circuits, Fiber.
- Один предмет на Specialist.
- Role-specific предметы нельзя назначить несовместимому Specialist.
- Эффекты: passive multiplier, active multiplier, cooldown multiplier.
- Несколько копий одного предмета можно скрафтить и использовать на разных Specialists.

## Collection

- 9 карточек: по 3 для Crew, Cargo Lift и Logistics.
- Supply Crate стоит 1 Supply Key и выдаёт 3 карточки.
- Новая карточка сразу становится LV1.
- Дубликаты повышают уровень до LV5.
- В каждой категории активен один визуальный набор.
- Crew усиливает добычу Deck, Lift — вместимость лифта, Logistics — Hub.
- В Stage 11 графика временная: выбранный набор меняет prototype-colors существующих Phaser objects. Финальный art pass будет через Adobe.

## Relics

Relics открываются автоматически и не требуют ручного claim:

1. First Spark — 1 Rebuild.
2. Five Sites — открыть 5 шахт.
3. Crew Bond — нанять 3 Specialists.
4. Academy Seal — пройти 10 Academy Operations.
5. Collector Sigil — 9 суммарных Collection levels.
6. Forge Emblem — скрафтить 5 Equipment items.

Relics дают permanent modifiers всем шахтам.

## Academy integration

Academy rewards дополнены:

- Alloy;
- Circuits;
- Fiber;
- Supply Keys на отдельных этапах.

Это связывает Specialist progression и Stage 11 meta-loop в один цикл.

## Save

Schema: **v9**.

Stage 10 save получает starter Equipment/Collection state, а весь существующий world/research/specialist/academy progression сохраняется.

## Mobile portrait

Основной диапазон: 360–440 CSS px.

- Team tabs: 4 раздела, горизонтально безопасны на узких экранах.
- Meta panel имеет собственный internal scroll.
- Equipment cards перестраиваются в 2-row layout на телефоне.
- Collection сохраняет 3 компактные карточки в ряд.
- Relics переходят в одну колонку.
- `100dvh` и safe-area правила Stage 9–10 сохраняются.

## Performance

- Ноль новых Phaser scenes.
- Equipment modifiers считаются только для назначенных Specialists.
- Collection modifiers — 3 выбранных card ids.
- Relics — максимум 6 флагов.
- Relic condition evaluation кэшируется по контекстному ключу.
