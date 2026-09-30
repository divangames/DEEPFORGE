# Stage 13 — Seasonal Campaign

## Цель

Связать Weekly Contract в долгосрочную четырёхнедельную сезонную прогрессию без создания тяжёлой дополнительной игровой сцены.

## Основные системы

- сезон длится 4 недели и синхронизируется с тем же server clock, что Weekly Contract;
- 20 уровней Season Progress;
- Season XP выдаётся за получение milestones Weekly Contract;
- Free Track доступен всем;
- Premium Track имеет готовый entitlement-layer, покупка подключается на Store/Monetization Stage 22;
- достигнутые Premium-награды можно будет получить ретроактивно после активации entitlement;
- сезонные награды используют существующие meta-ресурсы: Research Cores, Recruit Data, Training Modules, Promotion Badges, Supply Keys и Craft Materials;
- reward claim защищён от повторного получения;
- новый сезон автоматически создаёт новый seasonal state.

## Баланс XP

Weekly Contract milestones дают:

`100 / 120 / 150 / 180 / 220 / 280 / 360 / 500 XP`

Полное закрытие одного Weekly Contract даёт `1910 XP`.

Требование уровня:

`XP(level) = level × 100 + level² × 10`

Максимальный LV20 требует `6000 XP`, поэтому активный игрок способен закончить сезон за четыре недельных контракта с запасом.

## Mobile / Portrait

- один компактный Live Ops stack вместо разрастания верхнего HUD;
- Weekly и Season занимают одну область справа;
- Stage Status перенесён в левую часть экрана;
- Season panel использует `100dvh` и safe-area;
- 20 уровней находятся во внутреннем touch-scroll;
- reward cards уплотняются для 360–390 px;
- отдельные правила для 420–450 px Pro Max-class viewport.

## Save

Schema: `v11`.

При миграции Stage 12 → Stage 13 уже полученные milestones текущего Weekly Contract автоматически конвертируются в Season XP, поэтому игрок не теряет сезонный прогресс из-за обновления.

## Производительность

Seasonal Campaign — data-driven meta layer. Никаких новых Phaser scenes, sprites, particles или дополнительных simulation loops не создаётся.
