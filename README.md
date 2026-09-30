# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 10 — Academy + Fragments + Rank / Promotion**.

## Уже работает

- 8 секторов / 40 data-driven шахт;
- отдельная валюта каждого сектора;
- общий wallet пяти шахт сектора;
- независимый прогресс каждой шахты;
- Rebuild / Prestige с постоянными multiplier;
- Research Grid: 6 веток / 18 узлов;
- 6 Specialists с rarity, roles, passive/active abilities;
- **Academy: 30 timed operations**;
- **Recruit Data / Training Modules / Promotion Badges**;
- **fragments, recruitment, Rank 1–5, Promotion 0–3**;
- Specialist level cap до 25 через Promotion;
- 3 Specialist slots на шахту: Extraction / Lift / Logistics;
- Managers, AUTO и active abilities;
- 30 Deck, Cargo Lift, Logistics Hub;
- barriers, bulk upgrades, milestones и bottleneck HUD;
- background / offline income;
- primary + backup IndexedDB save;
- save schema v8 с миграцией старых версий;
- PWA + GitHub Pages;
- mobile-first portrait UI 360–440 CSS px;
- отдельный iPhone 11–17 Pro Max safe-area pass;
- LOW / MEDIUM / HIGH quality tiers и offscreen culling.

## Stage 10 — Academy

Открой `Команда → Academy`.

Academy содержит 30 последовательных операций. Они работают по timestamp, поэтому операция продолжает идти после закрытия браузера или PWA.

Награды:

- `⬢ Recruit Data` — Recruitment Signal;
- `▲ Training Modules` — повышение Level;
- `● Promotion Badges` — Promotion;
- `◆ Fragments` — Recruit и Rank Up.

Recruitment Signal стоит 100 Recruit Data и гарантированно выдаёт fragment-пак.

## Specialists

Прогресс Specialist теперь состоит из четырёх слоёв:

1. **Recruit** — собрать fragments и нанять персонажа.
2. **Level** — Training Modules повышают базовые параметры.
3. **Rank** — fragments усиливают passive и active.
4. **Promotion** — Promotion Badges повышают level cap.

Level caps:

`P0 → LV10 → P1 → LV15 → P2 → LV20 → P3 → LV25`

Один Specialist может быть назначен только в одну шахту. Passive работает также в background/offline income; active ability — в открытой шахте.

## Mobile portrait

Основной телефонный режим — **вертикальный**.

Проверять минимум:

- 360×780;
- 375×812;
- 390×844;
- 393×852;
- 402×874;
- 414×896;
- 428×926;
- **430×932 — iPhone 14/15 Pro Max class**;
- 440×956 — large Pro Max class.

Team / Academy / Specialists / Research / Rebuild / World Map используют собственные scroll areas и `100dvh`. На iPhone верхний safe-area расходуется только topbar, а home indicator — только bottom navigation / нижняя часть panel.

## Запуск

```bat
dev.bat
```

Клиент: `http://localhost:5173`

API: `http://localhost:3001/api/health`

## Проверка production

```bat
build.bat
```

## Публикация

```bat
publish.bat "feat: stage 10 academy fragments rank promotion"
```

`publish.bat` синхронизируется с `origin/main`, запускает typecheck, tests, production build, commit и push. GitHub Actions обновляет Pages.

Публичная версия:

`https://divangames.github.io/DEEPFORGE/`

## Документация

`docs/STAGE_0.md` … `docs/STAGE_10.md`
