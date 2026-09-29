import { useEffect, useMemo, useState } from 'react';
import { getApiHealth } from '../services/api';
import { formatCompact } from '../game/core/format';
import type { BulkUpgradeMode, BulkUpgradeQuote, FacilityId, ManagerView, MineId, WorldMineView } from '../game/core/types';
import { sendGameCommand } from '../game/runtime/gameRuntime';
import { useGameStore } from '../state/gameStore';
import { GameCanvas } from './GameCanvas';

function runFacility(id: FacilityId) {
  if (id === 'lift') return sendGameCommand({ type: 'START_LIFT' });
  if (id === 'hub') return sendGameCommand({ type: 'START_HUB' });
  sendGameCommand({ type: 'START_SHAFT', shaftId: id });
}

function facilityName(id: FacilityId) {
  if (id === 'lift') return 'Cargo Lift';
  if (id === 'hub') return 'Logistics Hub';
  const depth = Number(id.slice('shaft-'.length));
  return `Deck ${String(depth).padStart(2, '0')}`;
}

function managerInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function abilityLabel(manager: ManagerView) {
  if (manager.activeRemaining > 0) return `⚡ ${manager.activeRemaining.toFixed(0)}с`;
  if (manager.cooldownRemaining > 0) return `⏱ ${manager.cooldownRemaining.toFixed(0)}с`;
  return `${manager.abilityName} ×${manager.abilityMultiplier}`;
}

function formatAwayTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин ${secs} сек`;
  return `${secs} сек`;
}

function quoteLabel(quote: BulkUpgradeQuote | null, mode: BulkUpgradeMode) {
  if (!quote) return mode === 'MAX' ? 'MAX' : `×${mode}`;
  if (mode === 'MAX') return quote.levels > 0 ? `MAX +${quote.levels}` : 'MAX';
  return `×${mode}`;
}

function WorldMap({
  mines,
  selectedId,
  onSelect,
  onClose,
}: {
  mines: WorldMineView[];
  selectedId: MineId;
  onSelect: (id: MineId) => void;
  onClose: () => void;
}) {
  const selected = mines.find((mine) => mine.id === selectedId) ?? mines[0];
  const unlockedCount = mines.filter((mine) => mine.unlocked).length;
  const points = mines.map((mine) => `${mine.mapX},${mine.mapY}`).join(' ');
  const progress = selected && !selected.unlocked && selected.unlockEarnedRequired > 0
    ? Math.min(100, (selected.previousMineEarned / selected.unlockEarnedRequired) * 100)
    : 100;

  return (
    <div className="world-map-overlay" role="dialog" aria-modal="true" aria-label="Карта Rust Valley">
      <header className="world-map-header">
        <div>
          <span>SECTOR 01 · RUST VALLEY</span>
          <strong>Карта добывающих объектов</strong>
          <small>{unlockedCount}/{mines.length} объектов открыто</small>
        </div>
        <button type="button" onClick={onClose}>✕</button>
      </header>

      <div className="world-map-layout">
        <section className="world-map-canvas" aria-label="Маршрут Rust Valley">
          <div className="map-haze map-haze-a" />
          <div className="map-haze map-haze-b" />
          <svg className="world-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} />
          </svg>
          <div className="map-sector-label"><b>RUST VALLEY</b><span>INDUSTRIAL FRONTIER · 5 SITES</span></div>
          {mines.map((mine, index) => (
            <button
              key={mine.id}
              type="button"
              className={`world-node ${mine.unlocked ? 'unlocked' : 'locked'} ${mine.active ? 'current' : ''} ${selectedId === mine.id ? 'selected' : ''}`}
              style={{ left: `${mine.mapX}%`, top: `${mine.mapY}%`, '--mine-accent': mine.accent, '--mine-soft': mine.accentSoft } as React.CSSProperties}
              onClick={() => onSelect(mine.id)}
            >
              <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="node-core">{mine.unlocked ? (mine.active ? '◆' : '◇') : '×'}</span>
              <span className="node-label"><b>{mine.code}</b><small>{mine.name}</small></span>
            </button>
          ))}
          <div className="map-legend"><span>◆ текущий</span><span>◇ открыт</span><span>× закрыт</span></div>
        </section>

        {selected && (
          <aside className="world-map-info" style={{ '--mine-accent': selected.accent, '--mine-soft': selected.accentSoft } as React.CSSProperties}>
            <div className="map-info-kicker"><span>{selected.code}</span><em>{selected.active ? 'ТЕКУЩИЙ ОБЪЕКТ' : selected.unlocked ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</em></div>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <div className="map-resource"><span>РЕСУРС</span><b>{selected.resourceName}</b></div>
            <div className="map-stats-grid">
              <div><span>Касса</span><b>$ {formatCompact(selected.cash)}</b></div>
              <div><span>Доход</span><b>$ {formatCompact(selected.incomePerSecond)}/с</b></div>
              <div><span>Deck</span><b>{selected.unlockedDecks}/30</b></div>
              <div><span>Всего</span><b>$ {formatCompact(selected.totalCashEarned)}</b></div>
            </div>

            {!selected.unlocked && (
              <div className="map-unlock-progress">
                <div><span>Условие открытия</span><b>{selected.previousMineName ?? '—'}</b></div>
                <div className="map-progress-track"><i style={{ width: `${progress}%` }} /></div>
                <small>$ {formatCompact(selected.previousMineEarned)} / $ {formatCompact(selected.unlockEarnedRequired)} заработано</small>
              </div>
            )}

            {selected.unlocked ? (
              <button
                type="button"
                className="map-primary-action"
                disabled={selected.active}
                onClick={() => {
                  sendGameCommand({ type: 'OPEN_MINE', mineId: selected.id });
                  onClose();
                }}
              >
                {selected.active ? 'ВЫ УЖЕ ЗДЕСЬ' : 'ПЕРЕЙТИ НА ОБЪЕКТ'}
              </button>
            ) : (
              <button
                type="button"
                className="map-primary-action"
                disabled={!selected.canUnlock}
                onClick={() => sendGameCommand({ type: 'UNLOCK_MINE', mineId: selected.id })}
              >
                {selected.canUnlock ? 'ОТКРЫТЬ ОБЪЕКТ' : 'ТРЕБОВАНИЕ НЕ ВЫПОЛНЕНО'}
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export function App() {
  const [teamOpen, setTeamOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSelection, setMapSelection] = useState<MineId>('rust-01');
  const [bulkMode, setBulkMode] = useState<BulkUpgradeMode>(1);
  const quality = useGameStore((state) => state.quality);
  const apiOnline = useGameStore((state) => state.apiOnline);
  const simulation = useGameStore((state) => state.simulation);
  const activeMineId = useGameStore((state) => state.activeMineId);
  const worldMines = useGameStore((state) => state.worldMines);
  const selectedFacility = useGameStore((state) => state.selectedFacility);
  const selectedStats = useGameStore((state) => state.selectedStats);
  const selectedManager = useGameStore((state) => state.selectedManager);
  const managerRoster = useGameStore((state) => state.managerRoster);
  const selectedBulkQuotes = useGameStore((state) => state.selectedBulkQuotes);
  const bottleneck = useGameStore((state) => state.bottleneck);
  const barrier = useGameStore((state) => state.barrier);
  const offlineReport = useGameStore((state) => state.offlineReport);
  const setApiOnline = useGameStore((state) => state.setApiOnline);
  const setOfflineReport = useGameStore((state) => state.setOfflineReport);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1800);
    getApiHealth(controller.signal)
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [setApiOnline]);

  const rawOre = simulation?.shafts.reduce((sum, shaft) => sum + shaft.buffer, 0) ?? 0;
  const unlockedShafts = simulation?.shafts.filter((shaft) => shaft.unlocked).length ?? 0;
  const hiredManagers = useMemo(() => managerRoster.filter((manager) => manager.hired).length, [managerRoster]);
  const selectedIsAutomated = selectedManager?.hired ?? false;
  const selectedQuote = bulkMode === 1
    ? selectedBulkQuotes?.x1
    : bulkMode === 10
      ? selectedBulkQuotes?.x10
      : bulkMode === 25
        ? selectedBulkQuotes?.x25
        : selectedBulkQuotes?.max;
  const activeMine = worldMines.find((mine) => mine.id === activeMineId);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">DF</span>
          <div className="brand-copy">
            <strong>DEEPFORGE</strong>
            <span>RUST VALLEY · {activeMine?.code ?? 'RV-01'} · {activeMine?.name ?? 'Scrapline Quarry'}</span>
          </div>
        </div>
        <div className="topbar-meta">
          <div className="manager-count" aria-label="Нанятые менеджеры">
            <span>♟</span>{hiredManagers}/{managerRoster.length || 5}
          </div>
          <div className="resource-pill" aria-label="Деньги">
            <span>$</span>{formatCompact(simulation?.cash ?? 0)}
          </div>
        </div>
      </header>

      <section className="game-stage">
        <GameCanvas />

        <div className="stage-status" aria-hidden="true">
          <span><b>{formatCompact(rawOre)}</b> ORE</span>
          <span><b>{unlockedShafts}/30</b> DECKS</span>
          <span><b>{formatCompact(simulation?.surfaceBuffer ?? 0)}</b> SURFACE</span>
        </div>

        {bottleneck && (
          <div className="bottleneck-hud">
            <span className={bottleneck.bottleneck === 'shafts' ? 'hot' : ''}>⛏ {formatCompact(bottleneck.shaftOrePerSecond)}/s</span>
            <span className={bottleneck.bottleneck === 'lift' ? 'hot' : ''}>↕ {formatCompact(bottleneck.liftOrePerSecond)}/s</span>
            <span className={bottleneck.bottleneck === 'hub' ? 'hot' : ''}>▰ {formatCompact(bottleneck.hubOrePerSecond)}/s</span>
            <strong>УЗКОЕ МЕСТО: {bottleneck.label.toUpperCase()}</strong>
          </div>
        )}

        {barrier && (
          <div className={`barrier-strip ${barrier.active ? 'active' : ''}`}>
            <div>
              <strong>БАРЬЕР {barrier.boundaryDepth}00 м</strong>
              <span>
                {barrier.active
                  ? `Расчистка: ${Math.ceil(barrier.remaining)} сек`
                  : barrier.requirementsMet
                    ? `Откроет глубину до ${barrier.targetDepth}00 м`
                    : `Сначала откройте Deck ${barrier.boundaryDepth}`}
              </span>
            </div>
            {!barrier.active && (
              <button
                type="button"
                disabled={!barrier.canStart}
                onClick={() => sendGameCommand({ type: 'START_BARRIER' })}
              >
                CLEAR · ${formatCompact(barrier.cost)}
              </button>
            )}
          </div>
        )}

        <div className="stage-badge">
          <strong>STAGE 5</strong>
          <span>{quality}</span>
          <span className={apiOnline ? 'ok' : 'muted'}>{apiOnline ? 'API' : 'LOCAL'}</span>
        </div>
      </section>

      <section className="upgrade-dock" aria-label="Панель объекта">
        <div className="facility-copy">
          <div className="facility-title-row">
            <strong>{selectedStats?.name ?? 'Deck 01'}</strong>
            <span>LVL {selectedStats?.level ?? 1}</span>
            {selectedIsAutomated && <em>AUTO</em>}
          </div>
          <div className="facility-stats">
            <span>{selectedStats?.primaryLabel ?? 'За цикл'} <b>{selectedStats?.primaryValue ?? '—'}</b></span>
            <span>{selectedStats?.secondaryLabel ?? 'Цикл'} <b>{selectedStats?.secondaryValue ?? '—'}</b></span>
          </div>
          {selectedStats?.isUnlocked && (
            <div className="milestone-line">
              <span>Текущий множитель <b>×{selectedStats.milestone.currentMultiplier}</b></span>
              {selectedStats.milestone.nextLevel ? (
                <span>Следующий milestone: <b>LVL {selectedStats.milestone.nextLevel} · ×{selectedStats.milestone.nextMultiplier}</b></span>
              ) : (
                <span>Все milestones открыты</span>
              )}
            </div>
          )}
        </div>

        {selectedStats && !selectedStats.isUnlocked ? (
          <div className="locked-facility-card">
            <strong>{selectedStats.isAccessible ? 'НОВЫЙ ДОБЫВАЮЩИЙ УРОВЕНЬ' : 'УРОВЕНЬ ЗА БАРЬЕРОМ'}</strong>
            <span>
              {selectedStats.isAccessible
                ? 'Откройте уровень, чтобы запустить добычу и нанять менеджера.'
                : 'Сначала расчистите текущий каменный барьер.'}
            </span>
            <button
              type="button"
              disabled={!selectedStats.canUnlock}
              onClick={() => {
                if (selectedFacility !== 'lift' && selectedFacility !== 'hub') {
                  sendGameCommand({ type: 'UNLOCK_SHAFT', shaftId: selectedFacility });
                }
              }}
            >
              {selectedStats.isAccessible ? `UNLOCK · $${formatCompact(selectedStats.unlockCost)}` : 'SEALED'}
            </button>
          </div>
        ) : (
          <>
            {selectedManager && (
              <div className={`manager-card ${selectedManager.hired ? 'hired' : ''}`}>
                <div className="manager-avatar">{managerInitials(selectedManager.name)}</div>
                <div className="manager-copy">
                  <strong>{selectedManager.name}</strong>
                  <span>{selectedManager.role}</span>
                  <small>
                    {selectedManager.hired
                      ? `AUTO · +${selectedManager.passiveBonusPercent}% мощности`
                      : 'Автоматизирует выбранный объект'}
                  </small>
                </div>

                {!selectedManager.hired ? (
                  <button
                    type="button"
                    className="manager-hire"
                    disabled={!selectedManager.canHire}
                    onClick={() => sendGameCommand({ type: 'HIRE_MANAGER', facilityId: selectedFacility })}
                  >
                    НАНЯТЬ · ${formatCompact(selectedManager.hireCost)}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`manager-ability ${selectedManager.activeRemaining > 0 ? 'active' : ''}`}
                    disabled={!selectedManager.abilityReady}
                    onClick={() => sendGameCommand({ type: 'ACTIVATE_MANAGER', facilityId: selectedFacility })}
                  >
                    {abilityLabel(selectedManager)}
                  </button>
                )}
              </div>
            )}

            <div className="bulk-selector" aria-label="Количество уровней улучшения">
              {([1, 10, 25, 'MAX'] as BulkUpgradeMode[]).map((mode) => {
                const quote = mode === 1
                  ? selectedBulkQuotes?.x1 ?? null
                  : mode === 10
                    ? selectedBulkQuotes?.x10 ?? null
                    : mode === 25
                      ? selectedBulkQuotes?.x25 ?? null
                      : selectedBulkQuotes?.max ?? null;
                return (
                  <button
                    key={String(mode)}
                    type="button"
                    className={bulkMode === mode ? 'active' : ''}
                    onClick={() => setBulkMode(mode)}
                  >
                    {quoteLabel(quote, mode)}
                  </button>
                );
              })}
            </div>

            <div className="facility-actions">
              <button type="button" className="run-action" onClick={() => runFacility(selectedFacility)}>
                {selectedIsAutomated ? '↻ РУЧНОЙ ЗАПУСК' : '▶ ЗАПУСТИТЬ'}
              </button>
              <button
                type="button"
                className="upgrade-action"
                disabled={!selectedQuote?.affordable}
                onClick={() => sendGameCommand({ type: 'UPGRADE_BULK', facilityId: selectedFacility, mode: bulkMode })}
              >
                ↑ {selectedQuote?.levels ? `+${selectedQuote.levels}` : ''} · ${formatCompact(selectedQuote?.totalCost ?? 0)}
              </button>
            </div>
          </>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Главная навигация">
        <button type="button" className={!teamOpen && !mapOpen ? 'active' : ''} onClick={() => { setTeamOpen(false); setMapOpen(false); }}><span>◆</span>Объект</button>
        <button type="button" className={mapOpen ? 'active' : ''} onClick={() => { setTeamOpen(false); setMapSelection(activeMineId); setMapOpen(true); }}><span>⌖</span>Карта</button>
        <button type="button" className={teamOpen ? 'active' : ''} onClick={() => { setMapOpen(false); setTeamOpen(true); }}><span>♟</span>Команда</button>
        <button type="button" disabled><span>•••</span>Ещё</button>
      </nav>

      {mapOpen && (
        <WorldMap
          mines={worldMines}
          selectedId={mapSelection}
          onSelect={setMapSelection}
          onClose={() => setMapOpen(false)}
        />
      )}

      {offlineReport && (
        <div className="offline-overlay" role="dialog" aria-modal="true" aria-label="Доход за время отсутствия">
          <div className="offline-backdrop" />
          <section className="offline-panel">
            <div className="offline-icon" aria-hidden="true">DF</div>
            <span className="offline-eyebrow">АВТОНОМНЫЙ РЕЖИМ</span>
            <h2>Пока вас не было</h2>
            <p className="offline-away">Объект работал <b>{formatAwayTime(offlineReport.rawSeconds)}</b></p>
            <div className="offline-reward">
              <small>ЗАРАБОТАНО</small>
              <strong>$ {formatCompact(offlineReport.rewardCash)}</strong>
              <span>{formatCompact(offlineReport.processedOre)} ore обработано</span>
            </div>
            <div className="offline-stats">
              <div><span>Idle доход</span><b>$ {formatCompact(offlineReport.incomePerSecond)}/с</b></div>
              <div><span>Работало объектов</span><b>{offlineReport.operatingMines ?? (offlineReport.fullChainAutomated ? 1 : 0)}/{offlineReport.unlockedMines ?? 1}</b></div>
              <div><span>Засчитано</span><b>{formatAwayTime(offlineReport.creditedSeconds)}</b></div>
            </div>
            {!offlineReport.fullChainAutomated && (
              <p className="offline-warning">Для фонового дохода объекту нужны менеджеры хотя бы на одном Deck, Cargo Lift и Logistics Hub.</p>
            )}
            {offlineReport.capped && <p className="offline-cap">Лимит автономной работы сейчас — 8 часов.</p>}
            <button type="button" className="offline-collect" onClick={() => setOfflineReport(null)}>
              ЗАБРАТЬ · $ {formatCompact(offlineReport.rewardCash)}
            </button>
          </section>
        </div>
      )}

      {teamOpen && (
        <div className="team-overlay" role="dialog" aria-modal="true" aria-label="Команда менеджеров">
          <button className="team-backdrop" type="button" aria-label="Закрыть" onClick={() => setTeamOpen(false)} />
          <section className="team-panel">
            <header className="team-header">
              <div><span>УПРАВЛЕНИЕ ОБЪЕКТОМ</span><strong>Команда менеджеров</strong></div>
              <button type="button" onClick={() => setTeamOpen(false)}>✕</button>
            </header>
            <div className="team-summary">
              <strong>{hiredManagers}/{managerRoster.length}</strong>
              <span>открытых звеньев автоматизировано</span>
            </div>
            <div className="manager-list">
              {managerRoster.map((manager) => (
                <article
                  className={`manager-list-item ${manager.hired ? 'hired' : ''} ${manager.facilityId === selectedFacility ? 'selected' : ''}`}
                  key={manager.facilityId}
                >
                  <button
                    type="button"
                    className="manager-list-main"
                    onClick={() => sendGameCommand({ type: 'SELECT', facilityId: manager.facilityId })}
                  >
                    <span className="manager-avatar">{managerInitials(manager.name)}</span>
                    <span className="manager-list-copy">
                      <b>{manager.name}</b>
                      <small>{facilityName(manager.facilityId)} · {manager.role}</small>
                      <em>{manager.hired ? `AUTO +${manager.passiveBonusPercent}%` : `Найм $${formatCompact(manager.hireCost)}`}</em>
                    </span>
                  </button>
                  {!manager.hired ? (
                    <button
                      className="manager-list-action"
                      type="button"
                      disabled={!manager.canHire}
                      onClick={() => sendGameCommand({ type: 'HIRE_MANAGER', facilityId: manager.facilityId })}
                    >
                      Нанять
                    </button>
                  ) : (
                    <button
                      className={`manager-list-action ability ${manager.activeRemaining > 0 ? 'active' : ''}`}
                      type="button"
                      disabled={!manager.abilityReady}
                      onClick={() => sendGameCommand({ type: 'ACTIVATE_MANAGER', facilityId: manager.facilityId })}
                    >
                      {manager.activeRemaining > 0 ? 'BOOST' : manager.cooldownRemaining > 0 ? `${manager.cooldownRemaining.toFixed(0)}с` : '⚡ Пуск'}
                    </button>
                  )}
                </article>
              ))}
            </div>
            <p className="team-note">Новые менеджеры появляются в списке по мере открытия добывающих уровней.</p>
          </section>
        </div>
      )}
    </main>
  );
}
