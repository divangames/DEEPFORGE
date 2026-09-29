# Stage 7 — Rebuild / Prestige + Mobile Portrait Optimization

## Цель

Добавить первый постоянный слой мета-прогрессии поверх отдельных шахт и одновременно провести обязательный mobile-first pass под вертикальные телефоны.

## Rebuild

У каждой шахты есть собственный `rebuildLevel`.

Rebuild доступен после выполнения двух условий:

1. открыто нужное количество Deck;
2. объект накопил требуемый `rebuildCycleCashEarned`.

Текущая таблица:

| Rebuild | Multiplier | Deck | Base cycle revenue |
|---|---:|---:|---:|
| R1 | ×1.8 | 12 | 25K |
| R2 | ×3.0 | 16 | 150K |
| R3 | ×4.7 | 20 | 900K |
| R4 | ×7.0 | 24 | 5M |
| R5 | ×10.5 | 27 | 25M |
| R6 | ×16.0 | 30 | 120M |

Для более дорогих объектов требование по выручке текущего Rebuild-цикла мягко масштабируется относительно цены ресурса.

### Что сбрасывается

- shaft levels;
- unlocked shafts до начальных 3;
- shaft / surface buffers;
- barriers;
- Lift level;
- Logistics level;
- все локальные Managers и их cooldown.

### Что сохраняется

- shared sector wallet;
- world unlock progression;
- lifetime cash / ore;
- Rebuild level;
- permanent multiplier.

Множитель применяется через effective resource price, поэтому работает одновременно для active и offline income и автоматически отражается в bottleneck income/s.

## Save

Schema version: **5**.

Stage 6 (`schemaVersion: 4`) автоматически получает `rebuildLevel: 0`, а `rebuildCycleCashEarned` заполняется из существующего `totalCashEarned`, чтобы старый прогресс учитывался для первого Rebuild. После каждого Rebuild счётчик выручки текущего цикла сбрасывается в 0. Старые миграции Stage 0–5 сохранены.

## UI

Добавлено:

- четвертая рабочая вкладка bottom navigation — `Rebuild`;
- Rebuild modal;
- текущий R-level;
- current → next multiplier;
- progress по Deck;
- progress по revenue текущего Rebuild-цикла;
- явный список того, что потеряется и что сохранится;
- Rebuild status на HUD;
- Rebuild level в карточке шахты на мировой карте.

## Portrait optimization

Основной диапазон: `360–430 px` в portrait.

Изменено:

- topbar компактнее;
- upgrade dock ограничен по высоте и имеет собственный вертикальный scroll;
- уменьшены второстепенные font sizes и gaps;
- bottom navigation снижена до компактной высоты;
- debug Stage badge скрывается на телефоне;
- карта больше не требует прокрутки всей страницы: canvas и info panel делят высоту viewport;
- info panel карты прокручивается отдельно;
- team bottom sheet использует больше доступной высоты;
- Rebuild modal адаптирован под 360 px;
- на 390 px и меньше часть второстепенного HUD скрывается;
- на коротких экранах до 700 px применяются ещё более плотные настройки;
- safe-area bottom сохраняется для iPhone / PWA.

## Runtime optimization

- Shaft visuals вне viewport получают `visible=false` и не обновляют текст / геометрию каждый кадр.
- Barrier visuals также cull-ятся по camera viewport.
- LOW profile: 30 FPS target, antialias off, resolution 1x.
- MEDIUM: 60 FPS target, resolution 1x.
- HIGH: 60 FPS target, render resolution capped at 1.5 DPR.
- Background mines остаются аналитическими и не создают дополнительные Phaser scenes.

## Definition of Done

- старый Stage 6 save открывается без потери прогресса;
- Rebuild нельзя выполнить раньше требований;
- Rebuild не трогает sector wallet;
- локальная шахта реально сбрасывается;
- multiplier влияет на active и offline economy;
- save / reload сохраняет R-level;
- 360×640 не требует системного page scroll;
- все модальные панели доступны через внутренний scroll;
- touch targets остаются около 40–48 px;
- Stage 7 проходит typecheck / tests / production build перед push.
