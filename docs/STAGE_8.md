# Stage 8 — Research Grid

## Цель

Добавить первый полноценный глобальный meta-progression слой поверх Rebuild. Исследования сохраняются навсегда, действуют на все шахты и не сбрасываются Rebuild.

## Ветки

- Industry — добыча, цена ресурса, upgrade cost.
- Logistics — Lift и Hub.
- Automation — manager passives и cooldown.
- Exploration — barriers, Deck unlock, offline cap.
- Specialists — подготовка meta-bonuses к Stage 9.
- Events — подготовка глобальных бонусов к будущему Live Ops.

Всего в Stage 8: 18 узлов, по 3 tier на ветку.

## Research Cores

- новая игра: 3 ◈;
- успешный Rebuild: `2 + floor(newRebuildLevel / 2)` ◈;
- Stage 7 save получает стартовые 3 ◈ плюс компенсацию по 2 ◈ за каждый уже существующий Rebuild level.

## Respec

Reset снимает все исследования и возвращает вложенные Cores за вычетом комиссии: 15%, минимум 1 Core.

## Save

Schema v6. Research хранится в `world.research`:

- `cores`;
- `purchased[]`;
- `respecCount`.

## Mobile portrait

Основной target: 360–430 px. Research overlay не рендерит 18 cards одновременно: отображается только выбранная ветка (3 cards). Tabs прокручиваются горизонтально, node list вертикально. Основные touch targets остаются около 40–48 px.
