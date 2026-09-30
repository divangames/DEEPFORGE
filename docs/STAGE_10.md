# Stage 10 — Academy + Fragments + Rank / Promotion

## Цель

Превратить Specialists из набора уже открытых персонажей в полноценную meta-прогрессию с отдельным источником ресурсов и долгосрочным развитием.

## Academy Operations

Добавлена отдельная вкладка `Команда → Academy`.

Система содержит 30 data-driven операций. Каждая операция имеет:

- номер и название;
- duration;
- требование по суммарным Rebuild;
- Recruit Data;
- Training Modules;
- Promotion Badges;
- fragment-награду конкретного Specialist.

Операция запускается один раз, использует абсолютный timestamp и поэтому продолжает идти при закрытой вкладке / PWA / офлайн-сессии. После завершения награда забирается вручную.

## Academy resources

- `⬢ Recruit Data` — используется для Recruitment Signal Scan.
- `▲ Training Modules` — оплата Level Up Specialists.
- `● Promotion Badges` — Promotion Specialists.
- `◆ Fragments` — recruitment и Rank Up конкретного персонажа.

## Recruitment Signal

За 100 Recruit Data запускается scan, который гарантированно выдаёт fragment-пак одного из Specialists. Результат сохраняется.

На этом этапе распределение deterministic, чтобы перезагрузка страницы не превращалась в exploit random-roll.

## Specialist progression

Каждый Specialist теперь имеет:

- recruited state;
- fragments;
- rank 1–5;
- promotion 0–3;
- level;
- level cap;
- passive;
- active ability;
- assignment.

### Recruitment

Для найма необходимо:

1. выполнить Rebuild-gate персонажа;
2. собрать нужное число fragments;
3. нажать Recruit.

### Rank

Rank Up тратит fragments и усиливает passive + active параметры.

### Training

Training больше не тратит валюту сектора. Используются только Training Modules Academy.

### Promotion

Promotion требует:

- достижения текущего level cap;
- необходимого Rank;
- Promotion Badges.

Promotion повышает максимальный уровень:

- Promotion 0 → LV 10;
- Promotion 1 → LV 15;
- Promotion 2 → LV 20;
- Promotion 3 → LV 25.

## Migration

Save schema: `v8`.

Stage 9 → Stage 10:

- уровень каждого Specialist сохраняется;
- все персонажи, которые уже были доступны по Rebuild-gate в Stage 9, считаются recruited;
- сохраняются assignment и timers;
- выдаётся компенсация Training Modules за уже сделанные уровни;
- основной world / sector / mine progress не меняется.

## Mobile portrait

Academy и Specialist progression спроектированы под вертикальный телефон:

- отдельный внутренний scroll;
- 3 resource cards с компактным режимом;
- operation rows перестраиваются на 360–440 CSS px;
- Team tabs теперь 3 колонки и не выходят за ширину;
- iPhone safe-area / Dynamic Island / home indicator продолжают учитываться;
- Academy не создаёт новую Phaser scene и почти не влияет на render budget.

## Performance

- Academy operations используют timestamp вместо frame-by-frame симуляции.
- 30 operation definitions — обычные data records.
- Specialist modifiers вычисляются только для назначенных 3 slots текущей шахты.
- inactive mines продолжают использовать только аналитическую экономику.
