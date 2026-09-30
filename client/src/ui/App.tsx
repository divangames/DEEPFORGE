import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiHealth } from '../services/api';
import { resetServerClockToLocal, syncServerClock } from '../services/serverClock';
import { formatCompact } from '../game/core/format';
import { RESEARCH_BRANCHES, type ResearchBranchId } from '../game/core/research';
import { SPECIALIST_SLOTS, type SpecialistSlot, type SpecialistSystemView, type SpecialistView } from '../game/core/specialists';
import type { AcademyView } from '../game/core/academy';
import type { EquipmentId, EquipmentView } from '../game/core/equipment';
import type { CollectionCardId, CollectionView } from '../game/core/collection';
import type { RelicView } from '../game/core/relics';
import type { WeeklyContractView } from '../game/core/weeklyContract';
import type { SeasonalCampaignView } from '../game/core/seasonalCampaign';
import type { SocialView } from '../game/core/social';
import type { BulkUpgradeMode, BulkUpgradeQuote, FacilityId, ManagerView, MineId, ResearchView, SectorId, WorldMineView, WorldSectorView } from '../game/core/types';
import { sendGameCommand } from '../game/runtime/gameRuntime';
import { useGameStore } from '../state/gameStore';
import { GameCanvas } from './GameCanvas';
import { BlitzPanel } from './BlitzPanel';
import { RiftPanel } from './RiftPanel';
import { EventsMenu, type EventScreen } from './EventsMenu';

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

function formatLongTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return `${days} д ${hours} ч`;
  return formatAwayTime(total);
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

function specialistRoleLabel(role: SpecialistView['role']) {
  if (role === 'extraction') return 'EXTRACTION';
  if (role === 'lift') return 'CARGO LIFT';
  if (role === 'logistics') return 'LOGISTICS';
  return 'UNIVERSAL';
}

function specialistAbilityLabel(item: SpecialistView) {
  if (item.activeRemaining > 0) return `BOOST ${item.activeRemaining.toFixed(0)}с`;
  if (item.cooldownRemaining > 0) return `CD ${item.cooldownRemaining.toFixed(0)}с`;
  return `⚡ ${item.abilityName}`;
}

function SpecialistRoster({
  data,
  activeMineId: _activeMineId,
}: {
  data: SpecialistSystemView;
  activeMineId: MineId;
}) {
  const roleSlots = (specialist: SpecialistView): SpecialistSlot[] => {
    if (specialist.role === 'universal') return SPECIALIST_SLOTS.map((slot) => slot.id);
    return [specialist.role];
  };

  return (
    <div className="specialists-view">
      <div className="specialist-resource-strip">
        <span><b>⬢ {data.academyResources.recruitData}</b> Recruit Data</span>
        <span><b>▲ {data.academyResources.trainingModules}</b> Training</span>
        <span><b>● {data.academyResources.promotionBadges}</b> Promotion</span>
      </div>

      <div className="specialist-slot-grid">
        {data.slots.map((slot) => (
          <article className={`specialist-slot ${slot.specialistId ? 'filled' : ''}`} key={slot.slot}>
            <div>
              <span>{slot.label.toUpperCase()}</span>
              <strong>{slot.specialistName ?? 'Пустой слот'}</strong>
            </div>
            {slot.specialistId ? (
              <button type="button" onClick={() => sendGameCommand({ type: 'SPECIALIST_UNASSIGN', slot: slot.slot })}>Снять</button>
            ) : <b>+</b>}
          </article>
        ))}
      </div>

      <div className="specialist-meta-line">
        <span>Назначено <b>{data.assignedCount}/3</b></span>
        <span>Всего Rebuild <b>{data.totalRebuilds}</b></span>
        <span>Fragments / Rank / Promotion — <b>глобальные</b></span>
      </div>

      <div className="specialist-list">
        {data.roster.map((item) => {
          const availableSlots = roleSlots(item);
          const lockedByProgress = !item.available;
          const awaitingRecruit = item.available && !item.recruited;
          return (
            <article className={`specialist-card rarity-${item.rarity.toLowerCase()} ${lockedByProgress ? 'locked' : ''} ${awaitingRecruit ? 'recruitable' : ''} ${item.assignedHere ? 'assigned' : ''}`} key={item.id}>
              <div className="specialist-avatar">
                <b>{item.codename.slice(0, 2)}</b>
                <span>LV {item.level}/{item.levelCap}</span>
              </div>
              <div className="specialist-copy">
                <div className="specialist-title-row">
                  <strong>{item.name}</strong>
                  <em>{item.rarity}</em>
                </div>
                <small>{specialistRoleLabel(item.role)} · RANK {item.rank}/{item.maxRank} · PROMO {item.promotion}/{item.maxPromotion}</small>
                {item.equipmentName && <div className="specialist-equipment-note">⚙ {item.equipmentName}</div>}
                <p><b>PASSIVE +{item.passiveBonusPercent}%</b> · {item.passiveLabel}</p>
                <p><b>ACTIVE ×{item.abilityMultiplier.toFixed(2)}</b> · {item.abilityDuration}с · {item.abilityName}</p>
                <div className="fragment-line">
                  <span>FRAGMENTS</span>
                  <b>{item.fragments}</b>
                  {!item.recruited && <em>/ {item.recruitFragments} recruit</em>}
                  {item.recruited && item.rankCost !== null && <em>/ {item.rankCost} next rank</em>}
                </div>
                {lockedByProgress && <div className="specialist-lock">Доступ после {item.unlockRebuilds} суммарных Rebuild</div>}
                {item.recruited && item.assignedMineId && !item.assignedHere && (
                  <div className="specialist-assignment-note">Назначен: {item.assignedMineId.toUpperCase()} · {item.assignedSlot}</div>
                )}
              </div>
              <div className="specialist-actions">
                {!item.recruited ? (
                  <button
                    type="button"
                    className="specialist-recruit"
                    disabled={!item.canRecruit}
                    onClick={() => sendGameCommand({ type: 'SPECIALIST_RECRUIT', specialistId: item.id })}
                  >
                    {lockedByProgress ? `REBUILD ${item.unlockRebuilds}` : `RECRUIT · ◆ ${item.recruitFragments}`}
                  </button>
                ) : (
                  <>
                    <div className="specialist-assign-actions">
                      {availableSlots.map((slot) => (
                        <button
                          type="button"
                          key={slot}
                          disabled={item.assignedHere && item.assignedSlot === slot}
                          onClick={() => sendGameCommand({ type: 'SPECIALIST_ASSIGN', specialistId: item.id, slot })}
                        >
                          {item.assignedHere && item.assignedSlot === slot ? '✓ В слоте' : `→ ${slot === 'extraction' ? 'Deck' : slot === 'lift' ? 'Lift' : 'Hub'}`}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="specialist-train"
                      disabled={!item.canTrain}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_TRAIN', specialistId: item.id })}
                    >
                      {item.level >= item.levelCap ? `CAP LV ${item.levelCap}` : `TRAIN · ▲ ${item.trainingCost}`}
                    </button>
                    <button
                      type="button"
                      className="specialist-rank"
                      disabled={!item.canRankUp}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_RANK_UP', specialistId: item.id })}
                    >
                      {item.rank >= item.maxRank ? 'MAX RANK' : `RANK UP · ◆ ${item.rankCost ?? 0}`}
                    </button>
                    <button
                      type="button"
                      className="specialist-promote"
                      disabled={!item.canPromote}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_PROMOTE', specialistId: item.id })}
                    >
                      {item.promotion >= item.maxPromotion ? 'MAX PROMO' : `PROMOTE · ● ${item.promotionCost ?? 0}`}
                    </button>
                    <button
                      type="button"
                      className={`specialist-ability ${item.activeRemaining > 0 ? 'active' : ''}`}
                      disabled={!item.abilityReady}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_ACTIVATE', specialistId: item.id })}
                    >
                      {specialistAbilityLabel(item)}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="team-note">Academy даёт Recruit Data, Training Modules, Promotion Badges и fragments. Rank усиливает навыки, Promotion повышает лимит уровня до 25.</p>
    </div>
  );
}

function AcademyPanel({ data }: { data: AcademyView }) {
  const active = data.activeOperation;
  const next = data.nextOperation;
  return (
    <div className="academy-view">
      <div className="academy-resource-grid">
        <div><span>RECRUIT DATA</span><strong>⬢ {data.resources.recruitData}</strong></div>
        <div><span>TRAINING MODULES</span><strong>▲ {data.resources.trainingModules}</strong></div>
        <div><span>PROMOTION BADGES</span><strong>● {data.resources.promotionBadges}</strong></div>
      </div>

      <section className="academy-hero">
        <div className="academy-progress-ring"><b>{data.completedOperations}</b><span>/ {data.totalOperations}</span></div>
        <div className="academy-hero-copy">
          <span>ACADEMY OPERATIONS</span>
          <strong>{active?.title ?? next?.title ?? 'Все операции завершены'}</strong>
          <small>
            {active
              ? active.subtitle
              : next
                ? `Требование: ${next.requiredRebuilds} суммарных Rebuild`
                : 'Текущая линейка Academy полностью пройдена'}
          </small>
        </div>
        {active ? (
          <button
            type="button"
            className={data.activeReady ? 'academy-claim' : 'academy-timer'}
            disabled={!data.activeReady}
            onClick={() => sendGameCommand({ type: 'ACADEMY_CLAIM' })}
          >
            {data.activeReady ? 'ЗАБРАТЬ НАГРАДУ' : `⏱ ${formatAwayTime(data.activeRemaining)}`}
          </button>
        ) : next ? (
          <button type="button" className="academy-start" disabled={!data.canStartNext} onClick={() => sendGameCommand({ type: 'ACADEMY_START' })}>
            {data.canStartNext ? 'НАЧАТЬ DRILL' : `НУЖНО ${next.requiredRebuilds} REBUILD`}
          </button>
        ) : <b className="academy-complete">COMPLETE</b>}
      </section>

      <section className="academy-recruit-scan">
        <div>
          <span>RECRUITMENT SIGNAL</span>
          <strong>Скан фрагментов Specialists</strong>
          <small>Каждый scan гарантирует fragment-пак. Стоимость фиксирована и не зависит от сектора.</small>
          {data.lastRecruit && <em>Последний сигнал: {data.lastRecruit.specialistName} +{data.lastRecruit.fragments} ◆</em>}
        </div>
        <button type="button" disabled={!data.canScan} onClick={() => sendGameCommand({ type: 'ACADEMY_RECRUIT_SCAN' })}>
          SCAN · ⬢ {data.scanCost}
        </button>
      </section>

      <div className="academy-operation-list">
        {data.operations.map((operation) => (
          <article className={`academy-operation ${operation.completed ? 'completed' : ''} ${operation.current ? 'current' : ''} ${operation.available ? 'available' : ''} ${operation.locked ? 'locked' : ''}`} key={operation.id}>
            <div className="academy-op-index">{String(operation.index).padStart(2, '0')}</div>
            <div className="academy-op-copy">
              <strong>{operation.title}</strong>
              <span>{operation.subtitle}</span>
              <small>{operation.durationSeconds}с · Rebuild {operation.requiredRebuilds}+</small>
            </div>
            <div className="academy-op-rewards">
              <span>⬢ {operation.rewards.recruitData}</span>
              <span>▲ {operation.rewards.trainingModules}</span>
              {operation.rewards.promotionBadges > 0 && <span>● {operation.rewards.promotionBadges}</span>}
              <span>◆ {operation.rewards.fragments}</span>
              <span>⚙ {operation.rewards.alloy}/{operation.rewards.circuits}/{operation.rewards.fiber}</span>
              {operation.rewards.supplyKeys > 0 && <span>▣ {operation.rewards.supplyKeys}</span>}
            </div>
            <b className="academy-op-state">{operation.completed ? '✓' : operation.current ? 'LIVE' : operation.available ? 'NEXT' : 'LOCK'}</b>
          </article>
        ))}
      </div>
    </div>
  );
}


function equipmentRoleLabel(role: string) {
  if (role === 'any') return 'ANY SPECIALIST';
  if (role === 'universal') return 'UNIVERSAL ONLY';
  if (role === 'extraction') return 'EXTRACTION';
  if (role === 'lift') return 'CARGO LIFT';
  return 'LOGISTICS';
}

function ProgressionPanel({
  equipment,
  collection,
  relics,
  specialists,
}: {
  equipment: EquipmentView;
  collection: CollectionView;
  relics: RelicView;
  specialists: SpecialistSystemView;
}) {
  const [tab, setTab] = useState<'equipment' | 'collection' | 'relics'>('equipment');
  const recruited = specialists.roster.filter((item) => item.recruited);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState(recruited[0]?.id ?? specialists.roster[0]?.id);
  const selectedSpecialist = specialists.roster.find((item) => item.id === selectedSpecialistId) ?? recruited[0] ?? specialists.roster[0];
  const assignment = equipment.assignments.find((item) => item.specialistId === selectedSpecialist?.id);

  const compatible = (role: string) => {
    if (!selectedSpecialist) return false;
    return role === 'any' || role === selectedSpecialist.role || (role === 'universal' && selectedSpecialist.role === 'universal');
  };

  return (
    <div className="progression-view">
      <div className="progression-tabs" role="tablist">
        <button type="button" className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>⚙ Equipment</button>
        <button type="button" className={tab === 'collection' ? 'active' : ''} onClick={() => setTab('collection')}>▣ Collection</button>
        <button type="button" className={tab === 'relics' ? 'active' : ''} onClick={() => setTab('relics')}>✦ Relics</button>
      </div>

      {tab === 'equipment' && (
        <div className="equipment-view">
          <div className="equipment-materials">
            <span><b>▰ {equipment.materials.alloy}</b> Alloy</span>
            <span><b>▧ {equipment.materials.circuits}</b> Circuits</span>
            <span><b>⌁ {equipment.materials.fiber}</b> Fiber</span>
            <span><b>{equipment.craftedCount}</b> Crafted</span>
          </div>

          <div className="equipment-specialists" aria-label="Выбор Specialist для экипировки">
            {recruited.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedSpecialist?.id === item.id ? 'active' : ''}
                onClick={() => setSelectedSpecialistId(item.id)}
              >
                <b>{item.codename}</b><span>{item.equipmentName ?? 'NO GEAR'}</span>
              </button>
            ))}
          </div>

          {selectedSpecialist && (
            <div className="equipment-current">
              <div><span>ВЫБРАН</span><strong>{selectedSpecialist.name}</strong><small>{specialistRoleLabel(selectedSpecialist.role)}</small></div>
              <div><span>EQUIPPED</span><strong>{assignment?.equipmentName ?? 'Нет предмета'}</strong></div>
              {assignment?.equipmentId && (
                <button type="button" onClick={() => sendGameCommand({ type: 'EQUIPMENT_UNEQUIP', specialistId: selectedSpecialist.id })}>СНЯТЬ</button>
              )}
            </div>
          )}

          <div className="equipment-list">
            {equipment.items.map((item) => {
              const canUse = compatible(item.role);
              const isEquipped = assignment?.equipmentId === item.id;
              return (
                <article className={`equipment-card rarity-${item.rarity.toLowerCase()} ${!canUse ? 'incompatible' : ''}`} key={item.id}>
                  <div className="equipment-icon">⚙</div>
                  <div className="equipment-copy">
                    <div><strong>{item.name}</strong><em>{item.rarity}</em></div>
                    <small>{item.slotLabel} · {equipmentRoleLabel(item.role)}</small>
                    <p>{item.description}</p>
                    <span>OWNED {item.crafted} · FREE {item.availableCopies}</span>
                  </div>
                  <div className="equipment-actions">
                    <button
                      type="button"
                      className="equipment-craft"
                      disabled={!item.canCraft}
                      onClick={() => sendGameCommand({ type: 'EQUIPMENT_CRAFT', equipmentId: item.id as EquipmentId })}
                    >
                      CRAFT · {item.cost.alloy}/{item.cost.circuits}/{item.cost.fiber}
                    </button>
                    <button
                      type="button"
                      className="equipment-equip"
                      disabled={!selectedSpecialist || !selectedSpecialist.recruited || !canUse || item.availableCopies <= 0 || isEquipped}
                      onClick={() => selectedSpecialist && sendGameCommand({ type: 'EQUIPMENT_EQUIP', specialistId: selectedSpecialist.id, equipmentId: item.id as EquipmentId })}
                    >
                      {isEquipped ? '✓ EQUIPPED' : 'EQUIP'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'collection' && (
        <div className="collection-view">
          <section className="collection-hero">
            <div><span>SUPPLY KEYS</span><strong>▣ {collection.supplyKeys}</strong><small>{collection.cratesOpened} crates opened · {collection.totalLevels} collection levels</small></div>
            <button type="button" disabled={!collection.canOpenCrate} onClick={() => sendGameCommand({ type: 'COLLECTION_OPEN_CRATE' })}>OPEN SUPPLY CRATE</button>
          </section>
          {collection.lastCrate.length > 0 && (
            <div className="collection-last-crate"><span>ПОСЛЕДНИЙ CRATE</span>{collection.lastCrate.map((id, index) => <b key={`${id}-${index}`}>{id}</b>)}</div>
          )}
          <div className="collection-list">
            {(['crew', 'lift', 'logistics'] as const).map((category) => (
              <section className="collection-category" key={category}>
                <header><span>{category === 'crew' ? 'CREW VISUAL' : category === 'lift' ? 'CARGO LIFT VISUAL' : 'LOGISTICS VISUAL'}</span><b>ACTIVE BONUS</b></header>
                <div className="collection-card-grid">
                  {collection.cards.filter((card) => card.category === category).map((card) => (
                    <article className={`collection-card rarity-${card.rarity.toLowerCase()} ${card.selected ? 'selected' : ''} ${!card.owned ? 'locked' : ''}`} key={card.id}>
                      <div className="collection-card-art"><span>{card.visualLabel}</span></div>
                      <strong>{card.name}</strong>
                      <small>LV {card.level}/{card.maxLevel} · +{card.bonusPercent}%</small>
                      <div className="collection-progress"><i style={{ width: `${card.nextLevelCopies ? Math.min(100, card.progress / card.nextLevelCopies * 100) : 100}%` }} /></div>
                      <button
                        type="button"
                        disabled={!card.owned || card.selected}
                        onClick={() => sendGameCommand({ type: 'COLLECTION_SELECT', cardId: card.id as CollectionCardId })}
                      >
                        {card.selected ? '✓ ACTIVE' : card.owned ? 'SELECT' : 'LOCKED'}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {tab === 'relics' && (
        <div className="relic-view">
          <div className="relic-summary"><span>PERMANENT RELICS</span><strong>{relics.unlockedCount}/{relics.total}</strong><small>Реликвии открываются автоматически за долгосрочный прогресс и действуют во всех секторах.</small></div>
          <div className="relic-grid">
            {relics.items.map((item) => (
              <article className={`relic-card ${item.unlocked ? 'unlocked' : 'locked'}`} key={item.id}>
                <div className="relic-symbol">✦</div>
                <div><strong>{item.name}</strong><span>{item.requirement}</span><p>{item.description}</p></div>
                <b>{item.unlocked ? 'UNLOCKED' : 'LOCKED'}</b>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function ContractPanel({ contract, onClose }: { contract: WeeklyContractView; onClose: () => void }) {
  const remaining = Math.max(0, contract.remainingSeconds);
  const nextMilestone = contract.milestones.find((item) => !item.claimed);
  const facilityIcon = (id: string) => id === 'extraction' ? '⛏' : id === 'lift' ? '↕' : '▰';
  const bottleneckName = contract.bottleneck === 'extraction' ? 'EXTRACTION' : contract.bottleneck === 'lift' ? 'CARGO LIFT' : 'LOGISTICS';

  return (
    <div className="contract-overlay" role="dialog" aria-modal="true" aria-label="Weekly Contract">
      <button type="button" className="contract-backdrop" aria-label="Закрыть событие" onClick={onClose} />
      <section className="contract-panel" style={{ '--contract-accent': contract.accent } as React.CSSProperties}>
        <header className="contract-header">
          <div>
            <span>WEEKLY CONTRACT · STAGE 12</span>
            <strong>{contract.title}</strong>
            <small>{contract.subtitle}</small>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </header>

        <div className="contract-timer-strip">
          <div><span>ДО КОНЦА</span><strong>{formatAwayTime(remaining)}</strong></div>
          <div><span>ВРЕМЯ</span><strong>{contract.timeSource === 'server' ? 'SERVER' : 'LOCAL FALLBACK'}</strong></div>
          <div><span>MILESTONES</span><strong>{contract.claimedCount}/{contract.milestones.length}</strong></div>
        </div>

        <div className="contract-hero">
          <div>
            <span>EVENT CURRENCY</span>
            <strong>{contract.currencyCode} {formatCompact(contract.cash)}</strong>
            <small>{contract.resourceName} · lifetime {formatCompact(contract.totalCashEarned)}</small>
          </div>
          <div>
            <span>AUTO INCOME</span>
            <strong>{contract.currencyCode} {formatCompact(contract.incomePerSecond)}/с</strong>
            <small>Узкое место: {bottleneckName}</small>
          </div>
        </div>

        <button type="button" className="contract-shift" onClick={() => sendGameCommand({ type: 'CONTRACT_MANUAL_SHIFT' })}>
          ⚡ РУЧНАЯ СМЕНА · +4 СЕК ПРОИЗВОДСТВА
        </button>

        <div className="contract-facilities">
          {contract.facilities.map((facility) => (
            <article className={`contract-facility ${contract.bottleneck === facility.id ? 'bottleneck' : ''}`} key={facility.id}>
              <div className="contract-facility-icon">{facilityIcon(facility.id)}</div>
              <div className="contract-facility-copy">
                <span>{facility.id.toUpperCase()}</span>
                <strong>{facility.name}</strong>
                <small>LV {facility.level} · {formatCompact(facility.rate)} ore/s</small>
              </div>
              <div className="contract-facility-actions">
                <button
                  type="button"
                  disabled={contract.cash < facility.upgradeCost}
                  onClick={() => sendGameCommand({ type: 'CONTRACT_UPGRADE', facilityId: facility.id })}
                >
                  UPGRADE · {contract.currencyCode} {formatCompact(facility.upgradeCost)}
                </button>
                <button
                  type="button"
                  className={facility.managerHired ? 'hired' : ''}
                  disabled={facility.managerHired || contract.cash < facility.managerCost}
                  onClick={() => sendGameCommand({ type: 'CONTRACT_HIRE_MANAGER', facilityId: facility.id })}
                >
                  {facility.managerHired ? '✓ AUTO' : `MANAGER · ${contract.currencyCode} ${formatCompact(facility.managerCost)}`}
                </button>
              </div>
            </article>
          ))}
        </div>

        <section className="contract-milestones">
          <header>
            <div><span>CONTRACT PROGRESS</span><strong>Milestones</strong></div>
            {nextMilestone && <small>Следующая цель: {contract.currencyCode} {formatCompact(nextMilestone.requiredCash)}</small>}
          </header>
          <div className="contract-milestone-list">
            {contract.milestones.map((milestone, index) => (
              <article className={`contract-milestone ${milestone.claimed ? 'claimed' : milestone.ready ? 'ready' : ''}`} key={milestone.id}>
                <b className="contract-milestone-index">{String(index + 1).padStart(2, '0')}</b>
                <div>
                  <strong>{contract.currencyCode} {formatCompact(milestone.requiredCash)}</strong>
                  <span>{milestone.reward.label} · +{milestone.seasonXp} Season XP</span>
                  <div className="contract-progress"><i style={{ width: `${Math.round(milestone.progress * 100)}%` }} /></div>
                </div>
                <button
                  type="button"
                  disabled={!milestone.ready}
                  onClick={() => sendGameCommand({ type: 'CONTRACT_CLAIM_MILESTONE', milestoneId: milestone.id })}
                >
                  {milestone.claimed ? '✓' : milestone.ready ? 'CLAIM' : `${Math.round(milestone.progress * 100)}%`}
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="contract-footer">
          <span>Отдельная event-экономика сбрасывается с началом нового недельного контракта.</span>
          <span>Автодоход работает только после найма всех 3 event-менеджеров.</span>
        </footer>
      </section>
    </div>
  );
}


function SeasonPanel({ season, onClose }: { season: SeasonalCampaignView; onClose: () => void }) {
  const nextTarget = season.nextLevelXp ?? season.xp;
  return (
    <div className="season-overlay" role="dialog" aria-modal="true" aria-label="Seasonal Campaign">
      <button type="button" className="season-backdrop" aria-label="Закрыть сезон" onClick={onClose} />
      <section className="season-panel" style={{ '--season-accent': season.accent } as React.CSSProperties}>
        <header className="season-header">
          <div>
            <span>SEASONAL CAMPAIGN · STAGE 13</span>
            <strong>{season.title}</strong>
            <small>{season.subtitle}</small>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </header>

        <div className="season-summary">
          <div><span>SEASON LEVEL</span><strong>LV {season.currentLevel}/{season.maxLevel}</strong></div>
          <div><span>SEASON XP</span><strong>✦ {season.xp}</strong></div>
          <div><span>ОСТАЛОСЬ</span><strong>{formatLongTime(season.remainingSeconds)}</strong></div>
          <div><span>TIME</span><strong>{season.timeSource === 'server' ? 'SERVER' : 'LOCAL'}</strong></div>
        </div>

        <div className="season-xp-progress">
          <div><span>{season.nextLevel ? `До LV ${season.nextLevel}` : 'Сезон завершён'}</span><b>{season.nextLevel ? `${season.xp} / ${nextTarget} XP` : 'MAX LEVEL'}</b></div>
          <div className="season-progress-track"><i style={{ width: `${Math.round(season.levelProgress * 100)}%` }} /></div>
        </div>

        <div className={`season-premium-banner ${season.premiumUnlocked ? 'unlocked' : 'locked'}`}>
          <div><span>PREMIUM TRACK</span><strong>{season.premiumUnlocked ? 'Активирован' : 'Готов к подключению магазина'}</strong></div>
          <small>{season.premiumUnlocked ? 'Все достигнутые Premium-награды доступны ретроактивно.' : 'Механика entitlement готова; покупка Premium появится на Stage 22.'}</small>
          <b>{season.premiumUnlocked ? '✓ PREMIUM' : '🔒 PREMIUM'}</b>
        </div>

        <div className="season-track-head">
          <span>LV</span><strong>FREE TRACK</strong><strong>PREMIUM TRACK</strong>
        </div>

        <div className="season-level-list">
          {season.levels.map((level) => (
            <article className={`season-level ${level.reached ? 'reached' : ''}`} key={level.level}>
              <div className="season-level-badge"><b>{level.level}</b><span>{level.requiredXp} XP</span></div>
              <div className={`season-reward-card free ${level.freeClaimed ? 'claimed' : ''}`}>
                <span>FREE</span><strong>{level.freeReward.label}</strong>
                <button
                  type="button"
                  disabled={!level.canClaimFree}
                  onClick={() => sendGameCommand({ type: 'SEASON_CLAIM_REWARD', level: level.level, track: 'free' })}
                >
                  {level.freeClaimed ? '✓ CLAIMED' : level.canClaimFree ? 'CLAIM' : level.reached ? 'READY' : 'LOCKED'}
                </button>
              </div>
              <div className={`season-reward-card premium ${level.premiumClaimed ? 'claimed' : ''} ${season.premiumUnlocked ? 'enabled' : 'locked'}`}>
                <span>PREMIUM</span><strong>{level.premiumReward.label}</strong>
                <button
                  type="button"
                  disabled={!level.canClaimPremium}
                  onClick={() => sendGameCommand({ type: 'SEASON_CLAIM_REWARD', level: level.level, track: 'premium' })}
                >
                  {level.premiumClaimed ? '✓ CLAIMED' : !season.premiumUnlocked ? '🔒' : level.canClaimPremium ? 'CLAIM' : 'LOCKED'}
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className="season-footer">
          <span>Season XP выдаётся за получение milestones в Weekly Contract.</span>
          <span>Прогресс сезона длится 4 недели и сбрасывается с началом новой кампании.</span>
        </footer>
      </section>
    </div>
  );
}


function SocialPanel({ data }: { data: SocialView }) {
  const [friendId, setFriendId] = useState('');
  const [copied, setCopied] = useState(false);
  const active = data.activeMission;

  const copyPlayerId = async () => {
    try {
      await navigator.clipboard?.writeText(data.playerId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const addFriend = () => {
    const value = friendId.trim();
    if (!value) return;
    sendGameCommand({ type: 'SOCIAL_ADD_FRIEND', playerId: value });
    setFriendId('');
  };

  return (
    <div className="social-view">
      <section className="social-profile-card">
        <div className="social-avatar">DF</div>
        <div className="social-profile-copy">
          <span>PLAYER ID · {data.timeSource === 'server' ? 'SERVER TIME' : 'LOCAL FALLBACK'}</span>
          <strong>{data.nickname}</strong>
          <button type="button" className="social-id-copy" onClick={copyPlayerId}>{copied ? '✓ СКОПИРОВАНО' : data.playerId}</button>
        </div>
        <div className="social-bonus-card">
          <span>FRIEND BONUS</span>
          <b>+{data.friendBonusPercent}%</b>
          <small>до +{data.friendBonusCapPercent}% глобального дохода</small>
        </div>
      </section>

      <section className="friend-add-card">
        <div>
          <span>ДОБАВИТЬ ОПЕРАТОРА</span>
          <strong>Player ID друга</strong>
          <small>Формат: DF-XXXX-XXXX · максимум {data.maxFriends} друзей.</small>
        </div>
        <div className="friend-add-controls">
          <input
            value={friendId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFriendId(event.target.value.toUpperCase())}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') addFriend(); }}
            placeholder="DF-ABCD-2345"
            maxLength={12}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" disabled={!friendId.trim()} onClick={addFriend}>ДОБАВИТЬ</button>
        </div>
      </section>

      <section className="crew-mission-zone">
        <header className="crew-section-head">
          <div><span>CREW MISSIONS</span><strong>Совместные операции</strong></div>
          <div><b>{data.completedMissions}</b><small>завершено</small></div>
        </header>

        {active ? (
          <article className={`crew-active-mission rarity-${active.rarity} ${active.ready ? 'ready' : ''}`}>
            <div className="crew-mission-topline">
              <span>{active.rarity.toUpperCase()}</span>
              <b>{active.ready ? 'READY' : `⏱ ${formatLongTime(active.remainingSeconds)}`}</b>
            </div>
            <h3>{active.title}</h3>
            <p>{active.description}</p>
            <div className="crew-progress"><i style={{ width: `${Math.round(active.progress * 100)}%` }} /></div>
            <div className="crew-mission-meta">
              <span>Команда <b>{active.participantCount + 1}/{4}</b></span>
              <span>Награда <b>{active.reward.label}</b></span>
            </div>
            <small className="crew-help">Каждый присоединившийся друг сокращает оставшееся время операции на 15%. До 3 помощников.</small>
            <button
              type="button"
              className="crew-claim"
              disabled={!active.ready}
              onClick={() => sendGameCommand({ type: 'CREW_MISSION_CLAIM' })}
            >
              {active.ready ? 'ЗАБРАТЬ НАГРАДУ' : 'ОПЕРАЦИЯ ВЫПОЛНЯЕТСЯ'}
            </button>
          </article>
        ) : (
          <div className="crew-offer-grid">
            {data.offers.map((offer) => (
              <article className={`crew-offer rarity-${offer.rarity}`} key={offer.id}>
                <div className="crew-mission-topline"><span>{offer.rarity.toUpperCase()}</span><b>{offer.durationLabel}</b></div>
                <strong>{offer.title}</strong>
                <p>{offer.description}</p>
                <small>{offer.reward.label}</small>
                <button type="button" onClick={() => sendGameCommand({ type: 'CREW_MISSION_START', missionId: offer.id })}>НАЧАТЬ ОПЕРАЦИЮ</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="friend-list-zone">
        <header className="crew-section-head">
          <div><span>CREW NETWORK</span><strong>Друзья · {data.friendCount}/{data.maxFriends}</strong></div>
          <div><b>+{data.friendBonusPercent}%</b><small>income</small></div>
        </header>
        {data.friends.length === 0 ? (
          <div className="friends-empty">Добавь первый Player ID — каждый друг даёт +2% к глобальному доходу, максимум +10%.</div>
        ) : (
          <div className="friend-list">
            {data.friends.map((friend) => (
              <article className={`friend-row ${friend.inActiveMission ? 'joined' : ''}`} key={friend.playerId}>
                <div className="friend-avatar">{friend.nickname.slice(-2)}</div>
                <div className="friend-copy"><strong>{friend.nickname}</strong><span>{friend.playerId}</span></div>
                {active && (
                  <button
                    type="button"
                    className="friend-join"
                    disabled={!friend.canJoinMission}
                    onClick={() => sendGameCommand({ type: 'CREW_MISSION_JOIN', friendId: friend.playerId })}
                  >
                    {friend.inActiveMission ? '✓ CREW' : '+ JOIN'}
                  </button>
                )}
                <button type="button" className="friend-remove" onClick={() => sendGameCommand({ type: 'SOCIAL_REMOVE_FRIEND', playerId: friend.playerId })}>×</button>
              </article>
            ))}
          </div>
        )}
      </section>

      {data.lastCompleted && (
        <div className="crew-last-completed"><span>ПОСЛЕДНЯЯ ОПЕРАЦИЯ</span><b>{data.lastCompleted.title}</b><small>{data.lastCompleted.rewardLabel}</small></div>
      )}
      <p className="social-network-note">Stage 15 уже использует этот Player ID для server-authoritative Blitz Drill. Друзья пока остаются локальными до этапа серверной авторизации аккаунтов.</p>
    </div>
  );
}

export function App() {
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamTab, setTeamTab] = useState<'managers' | 'specialists' | 'academy' | 'progression' | 'crew'>('managers');
  const [mapOpen, setMapOpen] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [blitzOpen, setBlitzOpen] = useState(false);
  const [riftOpen, setRiftOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const closeRift = useCallback(() => setRiftOpen(false), []);
  const openEvent = (screen: EventScreen) => {
    setEventsOpen(false); setTeamOpen(false); setMapOpen(false); setRebuildOpen(false); setResearchOpen(false);
    setContractOpen(screen === 'weekly'); setSeasonOpen(screen === 'season');
    setBlitzOpen(screen === 'blitz'); setRiftOpen(screen === 'rift');
  };
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
  const specialists = useGameStore((state) => state.specialists);
  const academy = useGameStore((state) => state.academy);
  const equipment = useGameStore((state) => state.equipment);
  const collection = useGameStore((state) => state.collection);
  const relics = useGameStore((state) => state.relics);
  const weeklyContract = useGameStore((state) => state.weeklyContract);
  const seasonalCampaign = useGameStore((state) => state.seasonalCampaign);
  const social = useGameStore((state) => state.social);
  const offlineReport = useGameStore((state) => state.offlineReport);
  const setApiOnline = useGameStore((state) => state.setApiOnline);
  const setOfflineReport = useGameStore((state) => state.setOfflineReport);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1800);
    Promise.all([getApiHealth(controller.signal), syncServerClock(controller.signal)])
      .then(() => setApiOnline(true))
      .catch(() => { resetServerClockToLocal(); setApiOnline(false); })
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
      <div className="portrait-required" aria-hidden="true"><b>DEEPFORGE</b><span>Поверните телефон вертикально</span></div>
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

        <button type="button" className="events-launcher" aria-haspopup="dialog" onClick={() => setEventsOpen(true)}>
          <span>События</span><b>4</b>
        </button>

        <div className="stage-badge">
          <strong>STAGE 16</strong>
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
        <button type="button" className={!teamOpen && !mapOpen && !rebuildOpen && !researchOpen && !contractOpen && !seasonOpen && !blitzOpen && !riftOpen && !eventsOpen ? 'active' : ''} onClick={() => { setTeamOpen(false); setMapOpen(false); setRebuildOpen(false); setResearchOpen(false); setContractOpen(false); setSeasonOpen(false); setBlitzOpen(false); setRiftOpen(false); setEventsOpen(false); }}><span>◆</span>Объект</button>
        <button type="button" className={mapOpen ? 'active' : ''} onClick={() => { setTeamOpen(false); setRebuildOpen(false); setResearchOpen(false); setContractOpen(false); setSeasonOpen(false); setBlitzOpen(false); setRiftOpen(false); setEventsOpen(false); setMapOpen(true); }}><span>⌖</span>Карта</button>
        <button type="button" className={teamOpen ? 'active' : ''} onClick={() => { setMapOpen(false); setRebuildOpen(false); setResearchOpen(false); setContractOpen(false); setSeasonOpen(false); setBlitzOpen(false); setRiftOpen(false); setEventsOpen(false); setTeamOpen(true); }}><span>♟</span>Команда</button>
        <button type="button" className={rebuildOpen ? 'active rebuild-nav' : 'rebuild-nav'} onClick={() => { setMapOpen(false); setTeamOpen(false); setResearchOpen(false); setContractOpen(false); setSeasonOpen(false); setBlitzOpen(false); setRiftOpen(false); setEventsOpen(false); setRebuildOpen(true); }}><span>↻</span>Rebuild</button>
        <button type="button" className={researchOpen ? 'active research-nav' : 'research-nav'} onClick={() => { setMapOpen(false); setTeamOpen(false); setRebuildOpen(false); setContractOpen(false); setSeasonOpen(false); setBlitzOpen(false); setRiftOpen(false); setEventsOpen(false); setResearchOpen(true); }}><span>◈</span>Research</button>
      </nav>

      {eventsOpen && <EventsMenu onSelect={openEvent} onClose={() => setEventsOpen(false)} />}
      {riftOpen && <RiftPanel nickname={social?.nickname ?? 'Operator'} onClose={closeRift} />}

      {contractOpen && weeklyContract && (
        <ContractPanel contract={weeklyContract} onClose={() => setContractOpen(false)} />
      )}

      {seasonOpen && seasonalCampaign && (
        <SeasonPanel season={seasonalCampaign} onClose={() => setSeasonOpen(false)} />
      )}

      {blitzOpen && social && (
        <BlitzPanel
          playerId={social.playerId}
          nickname={social.nickname}
          apiOnline={apiOnline}
          onClose={() => setBlitzOpen(false)}
        />
      )}

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
        <div className="team-overlay" role="dialog" aria-modal="true" aria-label="Команда объекта">
          <button className="team-backdrop" type="button" aria-label="Закрыть" onClick={() => setTeamOpen(false)} />
          <section className="team-panel stage9-team-panel stage10-team-panel stage11-team-panel stage14-team-panel">
            <header className="team-header">
              <div><span>УПРАВЛЕНИЕ КОМАНДОЙ</span><strong>{teamTab === 'managers' ? 'Менеджеры объекта' : teamTab === 'specialists' ? 'Specialists' : teamTab === 'academy' ? 'Academy Operations' : teamTab === 'crew' ? 'Friends · Crew Missions' : 'Equipment · Collection · Relics'}</strong></div>
              <button type="button" onClick={() => setTeamOpen(false)}>✕</button>
            </header>
            <div className="team-tabs" role="tablist">
              <button type="button" className={teamTab === 'managers' ? 'active' : ''} onClick={() => setTeamTab('managers')}>♟ Менеджеры</button>
              <button type="button" className={teamTab === 'specialists' ? 'active' : ''} onClick={() => setTeamTab('specialists')}>★ Specialists</button>
              <button type="button" className={teamTab === 'academy' ? 'active' : ''} onClick={() => setTeamTab('academy')}>▣ Academy</button>
              <button type="button" className={teamTab === 'crew' ? 'active' : ''} onClick={() => setTeamTab('crew')}>◎ Crew</button>
              <button type="button" className={teamTab === 'progression' ? 'active' : ''} onClick={() => setTeamTab('progression')}>⚙ Meta</button>
            </div>

            {teamTab === 'managers' ? (
              <>
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
              </>
            ) : teamTab === 'specialists' ? (
              specialists ? <SpecialistRoster data={specialists} activeMineId={activeMineId} /> : <div className="team-summary"><span>Specialists загружаются…</span></div>
            ) : teamTab === 'academy' ? (
              academy ? <AcademyPanel data={academy} /> : <div className="team-summary"><span>Academy загружается…</span></div>
            ) : teamTab === 'crew' ? (
              social ? <SocialPanel data={social} /> : <div className="team-summary"><span>Crew Network загружается…</span></div>
            ) : (
              equipment && collection && relics && specialists
                ? <ProgressionPanel equipment={equipment} collection={collection} relics={relics} specialists={specialists} />
                : <div className="team-summary"><span>Meta-прогрессия загружается…</span></div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
