# DEEPFORGE: Idle Empire

Browser-first idle / tycoon game. Текущая версия: **Stage 11 — Equipment + Collection + Relics**.

## Уже работает

- 8 секторов / 40 data-driven шахт;
- отдельная валюта каждого сектора и общий wallet пяти шахт;
- независимый прогресс каждой шахты;
- Rebuild / Prestige с permanent multiplier;
- Research Grid: 6 веток / 18 узлов;
- 6 Specialists с rarity, roles, passive/active abilities;
- Academy: 30 timed operations;
- fragments, Recruitment, Rank 1–5, Promotion 0–3, level cap до 25;
- **Equipment crafting: 8 предметов + Alloy/Circuits/Fiber**;
- **Crew Collection: 9 карточек/визуалов, Supply Crates, уровни до 5**;
- **6 permanent Relics с auto-unlock**;
- 30 Deck, Cargo Lift, Logistics Hub;
- managers, AUTO, barriers, bulk upgrades, milestones, bottleneck HUD;
- background / offline income;
- primary + backup IndexedDB save;
- save schema **v9** с миграцией старых версий;
- PWA + GitHub Pages;
- mobile-first portrait UI 360–440 CSS px;
- iPhone 11–17 Pro Max safe-area / Dynamic Island / home indicator pass;
- LOW / MEDIUM / HIGH quality tiers и offscreen culling.

## Stage 11 — Meta progression

Открой `Команда → Meta`.

### Equipment

- `▰ Alloy`, `▧ Circuits`, `⌁ Fiber` выдаются Academy Operations;
- крафт создаёт реальные копии предметов;
- один Specialist носит один предмет;
- role-specific gear нельзя назначить несовместимому персонажу;
- предметы усиливают passive / active и иногда сокращают cooldown.

### Collection

- `▣ Supply Keys` выдаются отдельными Academy Operations;
- Supply Crate содержит 3 карточки;
- дубликаты повышают уровень карточки до 5;
- одновременно выбран один Crew, один Cargo Lift и один Logistics visual;
- выбранные карты дают реальные throughput bonuses;
- пока art pass не начался, визуальные наборы меняют prototype-colors работников, лифта и транспорта на Phaser scene.

### Relics

Relics открываются автоматически за долгосрочные достижения: Rebuild, количество шахт, Specialists, Academy, Collection и Equipment. Их бонусы постоянные и работают во всех секторах, включая background/offline расчёты.

## Academy

Academy Operations теперь выдают:

- `⬢ Recruit Data`;
- `▲ Training Modules`;
- `● Promotion Badges`;
- `◆ Fragments`;
- Alloy / Circuits / Fiber;
- Supply Keys на отдельных этапах.

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

Team / Academy / Specialists / Meta / Research / Rebuild / World Map используют собственные scroll areas и `100dvh`. Safe-area верхней части и home indicator не должны дважды съедать полезную высоту.

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
publish.bat "feat: stage 11 equipment collection relics"
```

`publish.bat` синхронизируется с `origin/main`, запускает typecheck, tests, production build, commit и push. GitHub Actions обновляет Pages.

Публичная версия:

`https://divangames.github.io/DEEPFORGE/`

## Документация

`docs/STAGE_0.md` … `docs/STAGE_11.md`
