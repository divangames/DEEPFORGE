# Stage 12 — Weekly Contract

Stage 12 добавляет первый полноценный временный live-ops режим DEEPFORGE.

## Что реализовано

- недельный контракт Monday 00:00 UTC → Monday 00:00 UTC;
- 8 циклических визуальных тем контракта;
- отдельная валюта `CT` и отдельная event-экономика;
- три звена производства: Extraction / Cargo Lift / Logistics;
- ручная смена для старта без автоматизации;
- отдельные event-менеджеры для каждого звена;
- автоматический доход только после автоматизации всей цепочки;
- отдельные уровни и стоимость upgrades;
- bottleneck расчёт;
- 8 milestones;
- постоянные meta-награды: Research Cores, Academy resources, Supply Keys и Craft Materials;
- 4-часовой лимит фонового event-дохода;
- автоматический reset при начале нового недельного контракта;
- серверное время через `/api/time`;
- локальный fallback для GitHub Pages, пока backend не развёрнут публично;
- защита от отката часов внутри сессии;
- save schema v10 и миграция Stage 11 → Stage 12.

## Mobile / portrait

Weekly Contract открывается полноэкранной панелью с `100dvh`, safe-area и внутренним scroll. На 360–440 px:

- 3 event-звена переходят в вертикальный список;
- actions не выходят за правый край;
- milestones скроллятся внутри панели;
- нижний home indicator учитывается через safe-area;
- экран не создаёт отдельную Phaser scene.

## Backend

Новый endpoint:

`GET /api/time`

Возвращает `unixMs` и ISO timestamp. Клиент рассчитывает offset с учётом RTT и использует server-time для начала/конца события, когда API доступен.

На статическом GitHub Pages API пока недоступен, поэтому UI явно показывает `LOCAL FALLBACK`. После развёртывания backend переключение на `SERVER` происходит автоматически.
