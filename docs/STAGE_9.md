# Stage 9 — Specialists + iPhone Portrait Pass

## Цель

Добавить первый глобальный слой уникальных персонажей поверх локальных Managers и исправить portrait UX для iPhone 11–17 Pro Max.

## Specialists

Stage 9 добавляет 6 уникальных Specialists:

- Rook Hale — COMMON / Extraction;
- Mara Vex — RARE / Extraction;
- Ion Reyes — EPIC / Cargo Lift;
- Talia Cruz — RARE / Logistics;
- Kael Soren — EPIC / Logistics;
- Sera Knox — LEGENDARY / Universal.

У каждой шахты есть 3 Specialist-слота: Extraction, Cargo Lift и Logistics. Один Specialist может быть назначен только в одну шахту мира одновременно.

Каждый персонаж имеет:

- rarity;
- role;
- level 1–10;
- passive multiplier;
- active ability;
- duration;
- cooldown;
- assignment.

Стартовые Rook / Ion / Talia доступны сразу. Остальные открываются за суммарные Rebuild milestone, чтобы система работала до появления Academy/Fragments в Stage 10.

Training оплачивается валютой активного сектора. Stage 10 заменит/расширит этот слой Academy-ресурсами и fragments.

Passive Specialists учитываются в live и offline income. Active ability применяется только к открытой шахте и не используется для офлайн-симуляции.

Research branch Specialists теперь реально усиливает passive bonus и уменьшает cooldown.

## iPhone portrait

Phone UI рассчитан на диапазон примерно 360–440 CSS px и современные длинные iPhone viewport.

Особое внимание:

- iPhone 11 / 11 Pro / 11 Pro Max;
- iPhone 12–13, включая mini и Pro Max;
- iPhone 14 / 14 Pro / 14 Pro Max;
- iPhone 15 series;
- iPhone 16 series;
- iPhone 17 series, включая Pro Max-class viewport.

Исправления:

- safe-area больше не вычитается дважды сверху/снизу;
- Dynamic Island / notch учитывается topbar;
- home indicator учитывается bottom navigation;
- `100dvh` используется для browser/PWA;
- upgrade dock имеет ограниченную высоту и собственный scroll;
- карты, Research, Rebuild, Offline и Team panels ограничены viewport;
- Pro Max / Plus class получает отдельный layout;
- компактные iPhone получают более плотный layout;
- на телефоне в landscape показывается просьба повернуть устройство вертикально.

## Save

Schema: `v7`.

Stage 8 (`v6`) автоматически получает default Specialist roster без потери Research, Rebuild, валют или шахт.
