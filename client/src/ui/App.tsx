import { useEffect, useMemo, useState } from 'react';
import { getApiHealth } from '../services/api';
import { formatCompact } from '../game/core/format';
import { RESEARCH_BRANCHES, type ResearchBranchId } from '../game/core/research';
import type { BulkUpgradeMode, BulkUpgradeQuote, FacilityId, ManagerView, MineId, ResearchView, SectorId, WorldMineView, WorldSectorView } from '../game/core/types';
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
  sectors,
  mines,
  activeSectorId,
  activeMineId,
  onClose,
}: {
  sectors: WorldSectorView[];
  mines: WorldMineView[];
  activeSectorId: SectorId;
  activeMineId: MineId;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'atlas' | 'sector'>('atlas');
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId>(activeSectorId);
  const [selectedMineId, setSelectedMineId] = useState<MineId>(activeMineId);
  const selectedSector = sectors.find((sector) => sector.id === selectedSectorId) ?? sectors[0];
  const sectorMines = mines.filter((mine) => mine.sectorId === selectedSectorId);
  const selectedMine = sectorMines.find((mine) => mine.id === selectedMineId) ?? sectorMines[0];
  const sectorPoints = sectors.map((sector) => `${sector.mapX},${sector.mapY}`).join(' ');
  const minePoints = sectorMines.map((mine) => `${mine.mapX},${mine.mapY}`).join(' ');

  useEffect(() => {
    if (mode !== 'sector') return;
    const activeInSector = sectorMines.find((mine) => mine.active);
    setSelectedMineId(activeInSector?.id ?? sectorMines[0]?.id ?? activeMineId);
  }, [mode, selectedSectorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectorProgress = selectedSector && !selectedSector.unlocked && selectedSector.unlockEarnedRequired > 0
    ? Math.min(100, (selectedSector.previousSectorEarned / selectedSector.unlockEarnedRequired) * 100)
    : 100;
  const mineProgress = selectedMine && !selectedMine.unlocked && selectedMine.unlockEarnedRequired > 0
    ? Math.min(100, (selectedMine.previousMineEarned / selectedMine.unlockEarnedRequired) * 100)
    : 100;

  return (
    <div className="world-map-overlay" role="dialog" aria-modal="true" aria-label="Мировая карта DEEPFORGE">
      <header className="world-map-header">
        <div>
          <span>{mode === 'atlas' ? 'WORLD ATLAS · 8 SECTORS' : `${selectedSector?.code ?? '—'} · ${selectedSector?.name ?? 'Sector'}`}</span>
          <strong>{mode === 'atlas' ? 'Глобальная карта промышленной сети' : 'Карта добывающих объектов'}</strong>
          <small>
            {mode === 'atlas'
              ? `${sectors.filter((sector) => sector.unlocked).length}/${sectors.length} секторов открыто`
              : `${sectorMines.filter((mine) => mine.unlocked).length}/${sectorMines.length} объектов открыто · ${selectedSector?.currencyName ?? ''}`}
          </small>
        </div>
        <div className="world-map-header-actions">
          {mode === 'sector' && <button type="button" onClick={() => setMode('atlas')}>←</button>}
          <button type="button" onClick={onClose}>✕</button>
        </div>
      </header>

      <div className="world-map-layout">
        {mode === 'atlas' ? (
          <>
            <section className="world-map-canvas atlas-canvas" aria-label="Сектора мира">
              <div className="map-haze map-haze-a" />
              <div className="map-haze map-haze-b" />
              <svg className="world-route sector-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={sectorPoints} />
              </svg>
              <div className="map-sector-label"><b>DEEPFORGE WORLD</b><span>8 INDUSTRIAL SECTORS · 40 MINING SITES</span></div>
              {sectors.map((sector, index) => (
                <button
                  key={sector.id}
                  type="button"
                  className={`world-node sector-node ${sector.unlocked ? 'unlocked' : 'locked'} ${sector.active ? 'current' : ''} ${selectedSectorId === sector.id ? 'selected' : ''}`}
                  style={{ left: `${sector.mapX}%`, top: `${sector.mapY}%`, '--mine-accent': sector.accent, '--mine-soft': sector.accentSoft } as React.CSSProperties}
                  onClick={() => setSelectedSectorId(sector.id)}
                >
                  <span className="node-index">S{String(index + 1).padStart(2, '0')}</span>
                  <span className="node-core">{sector.unlocked ? (sector.active ? '◆' : '◇') : '×'}</span>
                  <span className="node-label"><b>{sector.code}</b><small>{sector.name}</small></span>
                </button>
              ))}
              <div className="map-legend"><span>◆ текущий</span><span>◇ открыт</span><span>× закрыт</span></div>
            </section>

            {selectedSector && (
              <aside className="world-map-info" style={{ '--mine-accent': selectedSector.accent, '--mine-soft': selectedSector.accentSoft } as React.CSSProperties}>
                <div className="map-info-kicker"><span>{selectedSector.code}</span><em>{selectedSector.active ? 'ТЕКУЩИЙ СЕКТОР' : selectedSector.unlocked ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</em></div>
                <h2>{selectedSector.name}</h2>
                <p>{selectedSector.description}</p>
                <div className="map-resource"><span>ВАЛЮТА СЕКТОРА</span><b>{selectedSector.currencyCode} · {selectedSector.currencyName}</b></div>
                <div className="map-stats-grid">
                  <div><span>Кошелёк</span><b>{selectedSector.currencyCode} {formatCompact(selectedSector.wallet)}</b></div>
                  <div><span>Доход</span><b>{selectedSector.currencyCode} {formatCompact(selectedSector.incomePerSecond)}/с</b></div>
                  <div><span>Объекты</span><b>{selectedSector.unlockedMines}/{selectedSector.totalMines}</b></div>
                  <div><span>Всего добыто</span><b>{selectedSector.currencyCode} {formatCompact(selectedSector.totalCashEarned)}</b></div>
                </div>

                {!selectedSector.unlocked && (
                  <div className="map-unlock-progress">
                    <div><span>Условие открытия</span><b>{selectedSector.previousSectorName ?? '—'}</b></div>
                    <div className="map-progress-track"><i style={{ width: `${sectorProgress}%` }} /></div>
                    <small>{formatCompact(selectedSector.previousSectorEarned)} / {formatCompact(selectedSector.unlockEarnedRequired)} lifetime earnings</small>
                  </div>
                )}

                {selectedSector.unlocked ? (
                  <button type="button" className="map-primary-action" onClick={() => setMode('sector')}>
                    СМОТРЕТЬ 5 ОБЪЕКТОВ
                  </button>
                ) : (
                  <button
                    type="button"
                    className="map-primary-action"
                    disabled={!selectedSector.canUnlock}
                    onClick={() => sendGameCommand({ type: 'UNLOCK_SECTOR', sectorId: selectedSector.id })}
                  >
                    {selectedSector.canUnlock ? 'ОТКРЫТЬ СЕКТОР' : 'ТРЕБОВАНИЕ НЕ ВЫПОЛНЕНО'}
                  </button>
                )}
              </aside>
            )}
          </>
        ) : (
          <>
            <section className="world-map-canvas" aria-label={`Маршрут ${selectedSector?.name ?? ''}`}>
              <div className="map-haze map-haze-a" />
              <div className="map-haze map-haze-b" />
              <svg className="world-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={minePoints} />
              </svg>
              <div className="map-sector-label"><b>{selectedSector?.name?.toUpperCase()}</b><span>{selectedSector?.currencyCode} · 5 MINING SITES</span></div>
              {sectorMines.map((mine, index) => (
                <button
                  key={mine.id}
                  type="button"
                  className={`world-node ${mine.unlocked ? 'unlocked' : 'locked'} ${mine.active ? 'current' : ''} ${selectedMineId === mine.id ? 'selected' : ''}`}
                  style={{ left: `${mine.mapX}%`, top: `${mine.mapY}%`, '--mine-accent': mine.accent, '--mine-soft': mine.accentSoft } as React.CSSProperties}
                  onClick={() => setSelectedMineId(mine.id)}
                >
                  <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="node-core">{mine.unlocked ? (mine.active ? '◆' : '◇') : '×'}</span>
                  <span className="node-label"><b>{mine.code}</b><small>{mine.name}</small></span>
                </button>
              ))}
              <div className="map-legend"><span>◆ текущий</span><span>◇ открыт</span><span>× закрыт</span></div>
            </section>

            {selectedMine && (
              <aside className="world-map-info" style={{ '--mine-accent': selectedMine.accent, '--mine-soft': selectedMine.accentSoft } as React.CSSProperties}>
                <div className="map-info-kicker"><span>{selectedMine.code}</span><em>{selectedMine.active ? 'ТЕКУЩИЙ ОБЪЕКТ' : selectedMine.unlocked ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</em></div>
                <h2>{selectedMine.name}</h2>
                <p>{selectedMine.description}</p>
                <div className="map-resource"><span>РЕСУРС</span><b>{selectedMine.resourceName}</b></div>
                <div className="map-stats-grid">
                  <div><span>Кошелёк сектора</span><b>{selectedMine.currencyCode} {formatCompact(selectedMine.cash)}</b></div>
                  <div><span>Доход объекта</span><b>{selectedMine.currencyCode} {formatCompact(selectedMine.incomePerSecond)}/с</b></div>
                  <div><span>Deck</span><b>{selectedMine.unlockedDecks}/30</b></div>
                  <div><span>Lifetime</span><b>{selectedMine.currencyCode} {formatCompact(selectedMine.totalCashEarned)}</b></div>
                  <div><span>Rebuild</span><b>R{selectedMine.rebuildLevel} · ×{selectedMine.rebuildMultiplier}</b></div>
                </div>

                {!selectedMine.unlocked && (
                  <div className="map-unlock-progress">
                    <div><span>Условие открытия</span><b>{selectedMine.previousMineName ?? '—'}</b></div>
                    <div className="map-progress-track"><i style={{ width: `${mineProgress}%` }} /></div>
                    <small>{formatCompact(selectedMine.previousMineEarned)} / {formatCompact(selectedMine.unlockEarnedRequired)} заработано</small>
                  </div>
                )}

                {selectedMine.unlocked ? (
                  <button
                    type="button"
                    className="map-primary-action"
                    disabled={selectedMine.active}
                    onClick={() => {
                      sendGameCommand({ type: 'OPEN_MINE', mineId: selectedMine.id });
                      onClose();
                    }}
                  >
                    {selectedMine.active ? 'ВЫ УЖЕ ЗДЕСЬ' : 'ПЕРЕЙТИ НА ОБЪЕКТ'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="map-primary-action"
                    disabled={!selectedMine.canUnlock}
                    onClick={() => sendGameCommand({ type: 'UNLOCK_MINE', mineId: selectedMine.id })}
                  >
                    {selectedMine.canUnlock ? 'ОТКРЫТЬ ОБЪЕКТ' : 'ТРЕБОВАНИЕ НЕ ВЫПОЛНЕНО'}
                  </button>
                )}
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}


function ResearchPanel({ research, onClose }: { research: ResearchView; onClose: () => void }) {
  const [branch, setBranch] = useState<ResearchBranchId>('industry');
  const branchDef = RESEARCH_BRANCHES.find((item) => item.id === branch) ?? RESEARCH_BRANCHES[0];
  const nodes = research.nodes.filter((node) => node.branch === branch);

  return (
    <div className="research-overlay" role="dialog" aria-modal="true" aria-label="Research Grid">
      <button type="button" className="research-backdrop" aria-label="Закрыть исследования" onClick={onClose} />
      <section className="research-panel">
        <header className="research-header">
          <div>
            <span>GLOBAL PROGRESSION · STAGE 8</span>
            <strong>Research Grid</strong>
            <small>Постоянные улучшения действуют на все сектора и шахты.</small>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </header>

        <div className="research-summary">
          <div><span>RESEARCH CORES</span><strong>◈ {research.cores}</strong></div>
          <div><span>Открыто</span><strong>{research.purchasedCount}/{research.totalNodes}</strong></div>
          <div><span>Вложено</span><strong>{research.spentCores}</strong></div>
        </div>

        <div className="research-tabs" role="tablist" aria-label="Ветки исследований">
          {RESEARCH_BRANCHES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={branch === item.id}
              className={branch === item.id ? 'active' : ''}
              style={{ '--research-accent': item.accent } as React.CSSProperties}
              onClick={() => setBranch(item.id)}
            >
              <b>{item.shortName}</b><span>{item.name}</span>
            </button>
          ))}
        </div>

        <div className="research-branch-head" style={{ '--research-accent': branchDef.accent } as React.CSSProperties}>
          <div><span>{branchDef.shortName} BRANCH</span><strong>{branchDef.name}</strong></div>
          <p>{branchDef.description}</p>
        </div>

        <div className="research-node-list">
          {nodes.map((node) => (
            <article
              key={node.id}
              className={`research-node ${node.purchased ? 'purchased' : node.available ? 'available' : 'locked'}`}
              style={{ '--research-accent': branchDef.accent } as React.CSSProperties}
            >
              <div className="research-tier">T{node.tier}</div>
              <div className="research-node-copy">
                <strong>{node.title}</strong>
                <p>{node.description}</p>
                {!node.purchased && node.lockedBy.length > 0 && <small>Нужен предыдущий узел</small>}
              </div>
              <button
                type="button"
                disabled={node.purchased || !node.available}
                onClick={() => sendGameCommand({ type: 'RESEARCH_BUY', nodeId: node.id })}
              >
                {node.purchased ? '✓ ИЗУЧЕНО' : `◈ ${node.cost}`}
              </button>
            </article>
          ))}
        </div>

        <footer className="research-footer">
          <div>
            <strong>Получение Research Cores</strong>
            <span>Каждый успешный Rebuild выдаёт новые ◈ Cores. Первые 3 доступны сразу.</span>
          </div>
          <button
            type="button"
            className="research-respec"
            disabled={research.purchasedCount === 0}
            onClick={() => sendGameCommand({ type: 'RESEARCH_RESET' })}
          >
            RESET · вернуть {research.respecRefund} ◈ · комиссия {research.respecFee}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function App() {
  const [teamOpen, setTeamOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkUpgradeMode>(1);
  const quality = useGameStore((state) => state.quality);
  const apiOnline = useGameStore((state) => state.apiOnline);
  const simulation = useGameStore((state) => state.simulation);
  const activeMineId = useGameStore((state) => state.activeMineId);
  const activeSectorId = useGameStore((state) => state.activeSectorId);
  const worldMines = useGameStore((state) => state.worldMines);
  const worldSectors = useGameStore((state) => state.worldSectors);
  const selectedFacility = useGameStore((state) => state.selectedFacility);
  const selectedStats = useGameStore((state) => state.selectedStats);
  const selectedManager = useGameStore((state) => state.selectedManager);
  const managerRoster = useGameStore((state) => state.managerRoster);
  const selectedBulkQuotes = useGameStore((state) => state.selectedBulkQuotes);
  const bottleneck = useGameStore((state) => state.bottleneck);
  const barrier = useGameStore((state) => state.barrier);
  const rebuild = useGameStore((state) => state.rebuild);
  const research = useGameStore((state) => state.research);
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
  const activeSector = worldSectors.find((sector) => sector.id === activeSectorId);
  const currencyCode = activeSector?.currencyCode ?? 'RC';
  const offlineSectorRewards = useMemo(() => {
    return Object.entries(offlineReport?.sectorRewards ?? {})
      .map(([sectorId, amount]) => ({
        sector: worldSectors.find((sector) => sector.id === sectorId),
        amount: Number(amount) || 0,
      }))
      .filter((entry) => entry.amount > 0);
  }, [offlineReport, worldSectors]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">DF</span>
          <div className="brand-copy">
            <strong>DEEPFORGE</strong>
            <span>{activeSector?.name?.toUpperCase() ?? 'RUST VALLEY'} · {activeMine?.code ?? 'RV-01'} · {activeMine?.name ?? 'Scrapline Quarry'}</span>
          </div>
        </div>
        <div className="topbar-meta">
          <div className="manager-count" aria-label="Нанятые менеджеры">
            <span>♟</span>{hiredManagers}/{managerRoster.length || 5}
          </div>
          <div className="resource-pill" aria-label="Валюта сектора" title={activeSector?.currencyName}>
            <span>{currencyCode}</span>{formatCompact(simulation?.cash ?? 0)}
          </div>
        </div>
      </header>

      <section className="game-stage">
        <GameCanvas />

        <div className="stage-status" aria-hidden="true">
          <span><b>{formatCompact(rawOre)}</b> ORE</span>
          <span><b>{unlockedShafts}/30</b> DECKS</span>
          <span><b>{formatCompact(simulation?.surfaceBuffer ?? 0)}</b> SURFACE</span>
          <span className="rebuild-status"><b>R{rebuild?.level ?? 0}</b> ×{rebuild?.currentMultiplier ?? 1}</span>
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
                CLEAR · {currencyCode} {formatCompact(barrier.cost)}
              </button>
            )}
          </div>
        )}

        <div className="stage-badge">
          <strong>STAGE 8</strong>
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
              {selectedStats.isAccessible ? `UNLOCK · ${currencyCode} ${formatCompact(selectedStats.unlockCost)}` : 'SEALED'}
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
                    НАНЯТЬ · {currencyCode} {formatCompact(selectedManager.hireCost)}
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
                ↑ {selectedQuote?.levels ? `+${selectedQuote.levels}` : ''} · {currencyCode} {formatCompact(selectedQuote?.totalCost ?? 0)}
              </button>
            </div>
          </>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Главная навигация">
        <button type="button" className={!teamOpen && !mapOpen && !rebuildOpen && !researchOpen ? 'active' : ''} onClick={() => { setTeamOpen(false); setMapOpen(false); setRebuildOpen(false); setResearchOpen(false); }}><span>◆</span>Объект</button>
        <button type="button" className={mapOpen ? 'active' : ''} onClick={() => { setTeamOpen(false); setRebuildOpen(false); setResearchOpen(false); setMapOpen(true); }}><span>⌖</span>Карта</button>
        <button type="button" className={teamOpen ? 'active' : ''} onClick={() => { setMapOpen(false); setRebuildOpen(false); setResearchOpen(false); setTeamOpen(true); }}><span>♟</span>Команда</button>
        <button type="button" className={rebuildOpen ? 'active rebuild-nav' : 'rebuild-nav'} onClick={() => { setMapOpen(false); setTeamOpen(false); setResearchOpen(false); setRebuildOpen(true); }}><span>↻</span>Rebuild</button>
        <button type="button" className={researchOpen ? 'active research-nav' : 'research-nav'} onClick={() => { setMapOpen(false); setTeamOpen(false); setRebuildOpen(false); setResearchOpen(true); }}><span>◈</span>Research</button>
      </nav>

      {mapOpen && (
        <WorldMap
          sectors={worldSectors}
          mines={worldMines}
          activeSectorId={activeSectorId}
          activeMineId={activeMineId}
          onClose={() => setMapOpen(false)}
        />
      )}

      {rebuildOpen && rebuild && (
        <div className="rebuild-overlay" role="dialog" aria-modal="true" aria-label="Rebuild объекта">
          <button type="button" className="rebuild-backdrop" aria-label="Закрыть" onClick={() => setRebuildOpen(false)} />
          <section className="rebuild-panel">
            <header className="rebuild-header">
              <div>
                <span>PERMANENT PROGRESSION</span>
                <strong>Rebuild объекта</strong>
                <small>{activeMine?.code ?? '—'} · {activeMine?.name ?? 'Mining Site'}</small>
              </div>
              <button type="button" onClick={() => setRebuildOpen(false)}>✕</button>
            </header>

            <div className="rebuild-hero">
              <div className="rebuild-rank">R{rebuild.level}</div>
              <div>
                <span>Текущий постоянный множитель</span>
                <strong>×{rebuild.currentMultiplier}</strong>
                <small>{rebuild.maxed ? 'Максимальный уровень Rebuild достигнут' : `После Rebuild: ×${rebuild.nextMultiplier}`}</small>
              </div>
            </div>

            {!rebuild.maxed && (
              <div className="rebuild-requirements">
                <div className="rebuild-progress-item">
                  <div><span>Глубина объекта</span><b>{rebuild.unlockedDecks}/{rebuild.requiredDecks} Deck</b></div>
                  <div className="rebuild-track"><i style={{ width: `${Math.round(rebuild.deckProgress * 100)}%` }} /></div>
                </div>
                <div className="rebuild-progress-item">
                  <div><span>Выручка текущего цикла</span><b>{currencyCode} {formatCompact(rebuild.cycleEarned)} / {formatCompact(rebuild.requiredRevenue)}</b></div>
                  <div className="rebuild-track"><i style={{ width: `${Math.round(rebuild.revenueProgress * 100)}%` }} /></div>
                </div>
              </div>
            )}

            <div className="rebuild-columns">
              <div className="rebuild-loss">
                <strong>СБРОСИТСЯ</strong>
                <span>• уровни Deck / Lift / Logistics</span>
                <span>• открытые Deck и барьеры</span>
                <span>• локальные менеджеры</span>
                <span>• руда в буферах</span>
              </div>
              <div className="rebuild-keep">
                <strong>СОХРАНИТСЯ</strong>
                <span>• кошелёк сектора</span>
                <span>• открытые шахты и сектора</span>
                <span>• lifetime статистика</span>
                <span>• Rebuild multiplier навсегда</span>
              </div>
            </div>

            <p className="rebuild-note">Rebuild применяется только к текущему объекту. Остальные шахты сектора продолжают работать и не сбрасываются.</p>

            <button
              type="button"
              className="rebuild-confirm"
              disabled={!rebuild.canRebuild || rebuild.maxed}
              onClick={() => {
                sendGameCommand({ type: 'REBUILD_MINE' });
                setRebuildOpen(false);
              }}
            >
              {rebuild.maxed ? 'MAX REBUILD' : rebuild.canRebuild ? `REBUILD → R${rebuild.level + 1} · ×${rebuild.nextMultiplier}` : 'ТРЕБОВАНИЯ НЕ ВЫПОЛНЕНЫ'}
            </button>
          </section>
        </div>
      )}


      {researchOpen && research && (
        <ResearchPanel research={research} onClose={() => setResearchOpen(false)} />
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
              <small>ЗАРАБОТАНО ПО СЕКТОРАМ</small>
              {offlineSectorRewards.length > 0 ? (
                <div className="offline-sector-rewards">
                  {offlineSectorRewards.map(({ sector, amount }) => (
                    <div key={sector?.id ?? 'unknown'}>
                      <span>{sector?.name ?? 'Sector'}</span>
                      <strong>{sector?.currencyCode ?? '¤'} {formatCompact(amount)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <strong>{currencyCode} 0</strong>
              )}
              <span>{formatCompact(offlineReport.processedOre)} ore обработано</span>
            </div>
            <div className="offline-stats">
              <div><span>Работало объектов</span><b>{offlineReport.operatingMines ?? (offlineReport.fullChainAutomated ? 1 : 0)}/{offlineReport.unlockedMines ?? 1}</b></div>
              <div><span>Открыто секторов</span><b>{offlineReport.unlockedSectors ?? worldSectors.filter((sector) => sector.unlocked).length}/{worldSectors.length || 8}</b></div>
              <div><span>Засчитано</span><b>{formatAwayTime(offlineReport.creditedSeconds)}</b></div>
            </div>
            {!offlineReport.fullChainAutomated && (
              <p className="offline-warning">Для фонового дохода объекту нужны менеджеры хотя бы на одном Deck, Cargo Lift и Logistics Hub.</p>
            )}
            {offlineReport.capped && <p className="offline-cap">Лимит автономной работы: {formatAwayTime(offlineReport.creditedSeconds)}. Исследования могут его увеличить.</p>}
            <button type="button" className="offline-collect" onClick={() => setOfflineReport(null)}>
              ЗАБРАТЬ ДОХОД
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
                      <em>{manager.hired ? `AUTO +${manager.passiveBonusPercent}%` : `Найм ${currencyCode} ${formatCompact(manager.hireCost)}`}</em>
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
