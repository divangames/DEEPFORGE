import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Dialog } from './components/Dialog';
import { Icon } from './components/Icon';
import { Tabs } from './components/Tabs';
import { togglePanel, validateFriendId, type PanelState } from './platform/uiState';


const branchLabels: Record<ResearchBranchId, string> = { industry: 'Добыча', logistics: 'Логистика', automation: 'Автоматизация', exploration: 'Разведка', specialists: 'Специалисты', events: 'Резервы' };
function branchName(id: ResearchBranchId) { return branchLabels[id]; }

function runFacility(id: FacilityId) {
  if (id === 'lift') return sendGameCommand({ type: 'START_LIFT' });
  if (id === 'hub') return sendGameCommand({ type: 'START_HUB' });
  sendGameCommand({ type: 'START_SHAFT', shaftId: id });
}

function facilityName(id: FacilityId) {
  if (id === 'lift') return 'Грузовой лифт';
  if (id === 'hub') return 'Склад';
  const depth = Number(id.slice('shaft-'.length));
  return `Уровень ${String(depth).padStart(2, '0')}`;
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
    <Dialog label="Карта мира" onClose={onClose} className="map-dialog"><section className="world-map-panel">
      <header className="world-map-header">
        <div>
          <span>{mode === 'atlas' ? 'ПРОМЫШЛЕННАЯ СЕТЬ · 8 СЕКТОРОВ' : `${selectedSector?.code ?? '—'} · ${selectedSector?.name ?? 'Sector'}`}</span>
          <strong>{mode === 'atlas' ? 'Карта мира' : 'Объекты сектора'}</strong>
          <small>
            {mode === 'atlas'
              ? `${sectors.filter((sector) => sector.unlocked).length}/${sectors.length} секторов открыто`
              : `${sectorMines.filter((mine) => mine.unlocked).length}/${sectorMines.length} объектов открыто · ${selectedSector?.currencyName ?? ''}`}
          </small>
        </div>
        <div className="world-map-header-actions">
          {mode === 'sector' && <button type="button" onClick={() => setMode('atlas')} aria-label="К секторам"><Icon name="back" /></button>}
          <button type="button" onClick={onClose} aria-label="Закрыть окно" data-dialog-initial><Icon name="close" /></button>
        </div>
      </header>

      <div className="world-map-layout">
        {mode === 'atlas' ? (
          <>
            <section className="world-map-canvas atlas-canvas" aria-label="Сектора мира">
              <div className="map-haze map-haze-a" />
              <div className="map-haze map-haze-b" />
              <div className="map-sector-label"><b>DEEPFORGE WORLD</b><span>8 СЕКТОРОВ · 40 ОБЪЕКТОВ</span></div>
              <div className="map-points">
              <svg className="world-route sector-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={sectorPoints} />
              </svg>
              {sectors.map((sector, index) => (
                <button
                  key={sector.id}
                  type="button"
                  className={`world-node sector-node ${sector.unlocked ? 'unlocked' : 'locked'} ${sector.active ? 'current' : ''} ${selectedSectorId === sector.id ? 'selected' : ''}`}
                  style={{ left: `${sector.mapX}%`, top: `${sector.mapY}%`, '--mine-accent': sector.accent, '--mine-soft': sector.accentSoft } as React.CSSProperties}
                  aria-label={`${sector.name}, ${sector.unlocked ? "открыт" : "закрыт"}`} aria-pressed={selectedSectorId === sector.id}
                  onClick={() => setSelectedSectorId(sector.id)}
                >
                  <span className="node-index">S{String(index + 1).padStart(2, '0')}</span>
                  <span className="node-core">{sector.unlocked ? (sector.active ? '◆' : '◇') : '×'}</span>
                  <span className="node-label"><b>{sector.code}</b><small>{sector.name}</small></span>
                </button>
              ))}
              </div>
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
                    <small>{formatCompact(selectedSector.previousSectorEarned)} / {formatCompact(selectedSector.unlockEarnedRequired)} заработано</small>
                  </div>
                )}

                {selectedSector.unlocked ? (
                  <button type="button" className="map-primary-action" onClick={() => setMode('sector')}>
                    Смотреть объекты
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
              <div className="map-sector-label"><b>{selectedSector?.name?.toUpperCase()}</b><span>{selectedSector?.currencyCode} · 5 ОБЪЕКТОВ</span></div>
              <div className="map-points">
              <svg className="world-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={minePoints} />
              </svg>
              {sectorMines.map((mine, index) => (
                <button
                  key={mine.id}
                  type="button"
                  className={`world-node ${mine.unlocked ? 'unlocked' : 'locked'} ${mine.active ? 'current' : ''} ${selectedMineId === mine.id ? 'selected' : ''}`}
                  style={{ left: `${mine.mapX}%`, top: `${mine.mapY}%`, '--mine-accent': mine.accent, '--mine-soft': mine.accentSoft } as React.CSSProperties}
                  aria-label={`${mine.name}, ${mine.unlocked ? "открыта" : "закрыта"}`} aria-pressed={selectedMineId === mine.id}
                  onClick={() => setSelectedMineId(mine.id)}
                >
                  <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="node-core">{mine.unlocked ? (mine.active ? '◆' : '◇') : '×'}</span>
                  <span className="node-label"><b>{mine.code}</b><small>{mine.name}</small></span>
                </button>
              ))}
              </div>
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
                  <div><span>Уровни</span><b>{selectedMine.unlockedDecks}/30</b></div>
                  <div><span>Всего заработано</span><b>{selectedMine.currencyCode} {formatCompact(selectedMine.totalCashEarned)}</b></div>
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
    </section></Dialog>
  );
}


function ResearchPanel({ research, onClose }: { research: ResearchView; onClose: () => void }) {
  const [branch, setBranch] = useState<ResearchBranchId>('industry');
  const [confirmReset, setConfirmReset] = useState(false);
  const branchDef = RESEARCH_BRANCHES.find((item) => item.id === branch) ?? RESEARCH_BRANCHES[0];
  const nodes = research.nodes.filter((node) => node.branch === branch);

  return (
    <Dialog label="Исследования" onClose={onClose} className="research-dialog">
      <section className="research-panel">
        <header className="research-header">
          <div>
            <span>ГЛОБАЛЬНОЕ РАЗВИТИЕ</span>
            <strong>Исследования</strong>
            <small>Постоянные улучшения действуют на все сектора и шахты.</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть окно" data-dialog-initial><Icon name="close" /></button>
        </header>
        <div className="panel-scroll">

        <div className="research-summary">
          <div><span>ЯДРА ИССЛЕДОВАНИЙ</span><strong>◈ {research.cores}</strong></div>
          <div><span>Изучено</span><strong>{research.purchasedCount}/{research.totalNodes}</strong></div>
          <div><span>Вложено</span><strong>{research.spentCores}</strong></div>
        </div>

        <Tabs id="research" label="Ветки исследований" value={branch} onChange={setBranch}
          options={RESEARCH_BRANCHES.map((item) => ({ value: item.id, label: branchName(item.id) }))} />
        <div id="research-panel" role="tabpanel" aria-labelledby={`research-${branch}`}>

        <div className="research-branch-head" style={{ '--research-accent': branchDef.accent } as React.CSSProperties}>
          <div><span>ВЕТКА РАЗВИТИЯ</span><strong>{branchName(branchDef.id)}</strong></div>
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
                {node.purchased ? 'Изучено' : `Изучить · ◈ ${node.cost}`}
              </button>
            </article>
          ))}
        </div>

        </div>
        <footer className="research-footer">
          <div>
            <strong>Как получить ядра</strong>
            <span>Перезапускайте развитые шахты, чтобы получить ядра исследований. Первые 3 доступны сразу.</span>
          </div>
          <button
            type="button"
            className="research-respec"
            disabled={research.purchasedCount === 0}
            onClick={() => { if (confirmReset) { sendGameCommand({ type: 'RESEARCH_RESET' }); setConfirmReset(false); } else setConfirmReset(true); }}
          >
            {confirmReset ? 'Подтвердить сброс' : 'Сбросить исследования'} · {research.respecRefund} ◈
          </button>
          {confirmReset && <div className="confirmation-box" role="status"><p>Все изученные узлы будут сброшены. Возврат: {research.respecRefund} ◈. Комиссия: {research.respecFee} ◈.</p><button type="button" onClick={() => setConfirmReset(false)}>Отмена</button></div>}
        </footer>
        </div>
      </section>
    </Dialog>
  );
}

function specialistRoleLabel(role: SpecialistView['role']) {
  if (role === 'extraction') return 'ДОБЫЧА';
  if (role === 'lift') return 'ЛИФТ';
  if (role === 'logistics') return 'ЛОГИСТИКА';
  return 'УНИВЕРСАЛЬНЫЙ';
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
              <span>{specialistRoleLabel(slot.slot)}</span>
              <strong>{slot.specialistName ?? 'Пустой слот'}</strong>
            </div>
            {slot.specialistId ? (
              <button type="button" onClick={() => sendGameCommand({ type: 'SPECIALIST_UNASSIGN', slot: slot.slot })}>Снять</button>
            ) : <span className="inline-note">Не назначен</span>}
          </article>
        ))}
      </div>

      <div className="specialist-meta-line">
        <span>Назначено <b>{data.assignedCount}/3</b></span>
        <span>Всего Rebuild <b>{data.totalRebuilds}</b></span>
        <span>Развитие специалиста сохраняется во всех шахтах</span>
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
                <small>{specialistRoleLabel(item.role)} · РАНГ {item.rank}/{item.maxRank} · ПОВЫШЕНИЕ {item.promotion}/{item.maxPromotion}</small>
                {item.equipmentName && <div className="specialist-equipment-note">⚙ {item.equipmentName}</div>}
                <p><b>Пассивно +{item.passiveBonusPercent}%</b> · {item.passiveLabel}</p>
                <p><b>Навык ×{item.abilityMultiplier.toFixed(2)}</b> · {item.abilityDuration}с · {item.abilityName}</p>
                <div className="fragment-line">
                  <span>Фрагменты</span>
                  <b>{item.fragments}</b>
                  {!item.recruited && <em>/ {item.recruitFragments} для найма</em>}
                  {item.recruited && item.rankCost !== null && <em>/ {item.rankCost} на ранг</em>}
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
                    {lockedByProgress ? `REBUILD ${item.unlockRebuilds}` : `Нанять · ◆ ${item.recruitFragments}`}
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
                          {item.assignedHere && item.assignedSlot === slot ? '✓ В слоте' : `Назначить: ${slot === 'extraction' ? 'добыча' : slot === 'lift' ? 'лифт' : 'склад'}`}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="specialist-train"
                      disabled={!item.canTrain}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_TRAIN', specialistId: item.id })}
                    >
                      {item.level >= item.levelCap ? `Лимит ур. ${item.levelCap}` : `Обучить · ▲ ${item.trainingCost}`}
                    </button>
                    <button
                      type="button"
                      className="specialist-rank"
                      disabled={!item.canRankUp}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_RANK_UP', specialistId: item.id })}
                    >
                      {item.rank >= item.maxRank ? 'Макс. ранг' : `Ранг · ◆ ${item.rankCost ?? 0}`}
                    </button>
                    <button
                      type="button"
                      className="specialist-promote"
                      disabled={!item.canPromote}
                      onClick={() => sendGameCommand({ type: 'SPECIALIST_PROMOTE', specialistId: item.id })}
                    >
                      {item.promotion >= item.maxPromotion ? 'Макс. повышение' : `Повысить · ● ${item.promotionCost ?? 0}`}
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
      <p className="team-note">Академия даёт ресурсы для найма, обучения и повышения. Ранг усиливает навыки, повышение увеличивает лимит уровня до 25.</p>
    </div>
  );
}

function AcademyPanel({ data }: { data: AcademyView }) {
  const active = data.activeOperation;
  const next = data.nextOperation;
  return (
    <div className="academy-view">
      <div className="academy-resource-grid">
        <div><span>ДАННЫЕ НАЙМА</span><strong>⬢ {data.resources.recruitData}</strong></div>
        <div><span>МОДУЛИ ОБУЧЕНИЯ</span><strong>▲ {data.resources.trainingModules}</strong></div>
        <div><span>ЗНАКИ ПОВЫШЕНИЯ</span><strong>● {data.resources.promotionBadges}</strong></div>
      </div>

      <section className="academy-hero">
        <div className="academy-progress-ring"><b>{data.completedOperations}</b><span>/ {data.totalOperations}</span></div>
        <div className="academy-hero-copy">
          <span>АКАДЕМИЯ</span>
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
            {data.canStartNext ? 'Начать операцию' : `НУЖНО ${next.requiredRebuilds} REBUILD`}
          </button>
        ) : <b className="academy-complete">COMPLETE</b>}
      </section>

      <section className="academy-recruit-scan">
        <div>
          <span>ПОИСК СПЕЦИАЛИСТОВ</span>
          <strong>Скан фрагментов Specialists</strong>
          <small>Каждое сканирование даёт пакет фрагментов. Стоимость не зависит от сектора.</small>
          {data.lastRecruit && <em>Последний сигнал: {data.lastRecruit.specialistName} +{data.lastRecruit.fragments} ◆</em>}
        </div>
        <button type="button" disabled={!data.canScan} onClick={() => sendGameCommand({ type: 'ACADEMY_RECRUIT_SCAN' })}>
          Сканировать · ⬢ {data.scanCost}
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
  if (role === 'extraction') return 'ДОБЫЧА';
  if (role === 'lift') return 'ЛИФТ';
  return 'ЛОГИСТИКА';
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
      <Tabs id="meta" label="Развитие" value={tab} onChange={setTab} options={[
        { value: 'equipment', label: 'Экипировка' }, { value: 'collection', label: 'Коллекция' }, { value: 'relics', label: 'Реликвии' },
      ]} />
      <div id="meta-panel" role="tabpanel" aria-labelledby={`meta-${tab}`}>

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
                      Создать · {item.cost.alloy}/{item.cost.circuits}/{item.cost.fiber}
                    </button>
                    <button
                      type="button"
                      className="equipment-equip"
                      disabled={!selectedSpecialist || !selectedSpecialist.recruited || !canUse || item.availableCopies <= 0 || isEquipped}
                      onClick={() => selectedSpecialist && sendGameCommand({ type: 'EQUIPMENT_EQUIP', specialistId: selectedSpecialist.id, equipmentId: item.id as EquipmentId })}
                    >
                      {isEquipped ? 'Надето' : 'Надеть'}
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
            <button type="button" disabled={!collection.canOpenCrate} onClick={() => sendGameCommand({ type: 'COLLECTION_OPEN_CRATE' })}>Открыть контейнер</button>
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
    </div>
  );
}


function ContractPanel({ contract, onClose }: { contract: WeeklyContractView; onClose: () => void }) {
  const remaining = Math.max(0, contract.remainingSeconds);
  const nextMilestone = contract.milestones.find((item) => !item.claimed);
  const facilityIcon = (id: string) => id === 'extraction' ? '⛏' : id === 'lift' ? '↕' : '▰';
  const bottleneckName = contract.bottleneck === 'extraction' ? 'EXTRACTION' : contract.bottleneck === 'lift' ? 'CARGO LIFT' : 'LOGISTICS';

  return (
    <Dialog label="Недельный контракт" onClose={onClose} className="contract-dialog">
      <section className="contract-panel" style={{ '--contract-accent': contract.accent } as React.CSSProperties}>
        <header className="contract-header">
          <div>
            <span>WEEKLY CONTRACT · STAGE 12</span>
            <strong>{contract.title}</strong>
            <small>{contract.subtitle}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть окно" data-dialog-initial><Icon name="close" /></button>
        </header>
        <div className="panel-scroll">

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
        </div>
      </section>
    </Dialog>
  );
}


function SeasonPanel({ season, onClose }: { season: SeasonalCampaignView; onClose: () => void }) {
  const nextTarget = season.nextLevelXp ?? season.xp;
  return (
    <Dialog label="Сезон" onClose={onClose} className="season-dialog">
      <section className="season-panel" style={{ '--season-accent': season.accent } as React.CSSProperties}>
        <header className="season-header">
          <div>
            <span>SEASONAL CAMPAIGN · STAGE 13</span>
            <strong>{season.title}</strong>
            <small>{season.subtitle}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть окно" data-dialog-initial><Icon name="close" /></button>
        </header>
        <div className="panel-scroll">

        <div className="season-summary">
          <div><span>УРОВЕНЬ СЕЗОНА</span><strong>LV {season.currentLevel}/{season.maxLevel}</strong></div>
          <div><span>SEASON XP</span><strong>✦ {season.xp}</strong></div>
          <div><span>ОСТАЛОСЬ</span><strong>{formatLongTime(season.remainingSeconds)}</strong></div>
          <div><span>TIME</span><strong>{season.timeSource === 'server' ? 'SERVER' : 'LOCAL'}</strong></div>
        </div>

        <div className="season-xp-progress">
          <div><span>{season.nextLevel ? `До LV ${season.nextLevel}` : 'Сезон завершён'}</span><b>{season.nextLevel ? `${season.xp} / ${nextTarget} XP` : 'MAX LEVEL'}</b></div>
          <div className="season-progress-track"><i style={{ width: `${Math.round(season.levelProgress * 100)}%` }} /></div>
        </div>

        <div className={`season-premium-banner ${season.premiumUnlocked ? 'unlocked' : 'locked'}`}>
          <div><span>ПРЕМИУМ</span><strong>{season.premiumUnlocked ? 'Активирован' : 'Пока недоступен'}</strong></div>
          <small>{season.premiumUnlocked ? 'Все достигнутые Premium-награды доступны ретроактивно.' : 'Платная дорожка появится после подключения магазина. Бесплатные награды доступны без покупки.'}</small>
          <b>{season.premiumUnlocked ? '✓ PREMIUM' : '🔒 PREMIUM'}</b>
        </div>

        <div className="season-track-head">
          <span>LV</span><strong>БЕСПЛАТНО</strong><strong>ПРЕМИУМ</strong>
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
                  {level.freeClaimed ? 'Получено' : level.canClaimFree ? 'Забрать' : level.reached ? 'Готово' : 'Закрыто'}
                </button>
              </div>
              <div className={`season-reward-card premium ${level.premiumClaimed ? 'claimed' : ''} ${season.premiumUnlocked ? 'enabled' : 'locked'}`}>
                <span>PREMIUM</span><strong>{level.premiumReward.label}</strong>
                <button
                  type="button"
                  disabled={!level.canClaimPremium}
                  onClick={() => sendGameCommand({ type: 'SEASON_CLAIM_REWARD', level: level.level, track: 'premium' })}
                >
                  {level.premiumClaimed ? 'Получено' : !season.premiumUnlocked ? 'Нет доступа' : level.canClaimPremium ? 'Забрать' : 'Закрыто'}
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className="season-footer">
          <span>Season XP выдаётся за получение milestones в Weekly Contract.</span>
          <span>Прогресс сезона длится 4 недели и сбрасывается с началом новой кампании.</span>
        </footer>
        </div>
      </section>
    </Dialog>
  );
}


function SocialPanel({ data }: { data: SocialView }) {
  const [friendId, setFriendId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
  const active = data.activeMission;

  const copyPlayerId = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(data.playerId);
      setError(null);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setError('Не удалось скопировать. Ваш ID можно выделить в тексте ниже.');
    }
  };

  const addFriend = () => {
    const value = friendId.trim();
    const message = validateFriendId(value, data.playerId, data.friends.map((friend) => friend.playerId), data.maxFriends);
    setError(message);
    if (message) return;
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
          <label htmlFor="friend-id"><strong>Player ID друга</strong></label>
          <small>Формат: DF-XXXX-XXXX · максимум {data.maxFriends} друзей.</small>
        </div>
        <div className="friend-add-controls">
          <input
            id="friend-id" aria-invalid={Boolean(error)} aria-describedby="friend-feedback" autoComplete="off" enterKeyHint="done"
            value={friendId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setFriendId(event.target.value.toUpperCase()); setError(null); }}
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

      <p id="friend-feedback" className={error ? "inline-error" : "inline-note"} role="status">{error ?? `Ваш ID: ${data.playerId}. Список друзей пока хранится на этом устройстве.`}</p>
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
                <button type="button" className="friend-remove" aria-label={`Удалить ${friend.nickname} из друзей`} onClick={() => sendGameCommand({ type: 'SOCIAL_REMOVE_FRIEND', playerId: friend.playerId })}>×</button>
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
  const [panel, setPanel] = useState<PanelState>(null);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [teamTab, setTeamTab] = useState<'managers' | 'specialists' | 'academy' | 'progression' | 'crew'>('managers');
  const teamOpen = panel === 'team', mapOpen = panel === 'map', rebuildOpen = panel === 'rebuild';
  const researchOpen = panel === 'research', contractOpen = panel === 'weekly', seasonOpen = panel === 'season';
  const blitzOpen = panel === 'blitz', riftOpen = panel === 'rift', eventsOpen = panel === 'events';
  const setTeamOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'team', open));
  const setMapOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'map', open));
  const setRebuildOpen = (open: boolean) => { setConfirmRebuild(false); setPanel((current) => togglePanel(current, 'rebuild', open)); };
  const setResearchOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'research', open));
  const setContractOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'weekly', open));
  const setSeasonOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'season', open));
  const setBlitzOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'blitz', open));
  const setEventsOpen = (open: boolean) => setPanel((current) => togglePanel(current, 'events', open));
  const closeRift = useCallback(() => setPanel(null), []);
  const openEvent = (screen: EventScreen) => setPanel(screen);
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
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><Icon name="mine" size={22} /></span>
          <div className="brand-copy"><strong>DEEPFORGE</strong><span>{activeMine?.code ?? 'RV-01'} · {activeSector?.name ?? 'Rust Valley'}</span></div>
        </div>
        <div className="topbar-meta">
          <div className="resource-pill" aria-label={`Кошелёк сектора: ${formatCompact(simulation?.cash ?? 0)} ${currencyCode}`}>
            <small>{currencyCode}</small><strong>{formatCompact(simulation?.cash ?? 0)}</strong>
          </div>
          <button type="button" className="icon-button" aria-label="Информация об объекте" onClick={() => setPanel('system')}><Icon name="info" /></button>
        </div>
      </header>

      <section className="production-bar" aria-label="Производственная цепочка">
        <div className="flow-heading"><span>Производственная линия</span><small>Мощность · ед/с</small></div>
        <div className="flow-stages">
          {([{ id: 'shaft-1', kind: 'shafts', icon: 'mine', title: 'Добыча', rate: bottleneck?.shaftOrePerSecond },
             { id: 'lift', kind: 'lift', icon: 'lift', title: 'Лифт', rate: bottleneck?.liftOrePerSecond },
             { id: 'hub', kind: 'hub', icon: 'hub', title: 'Склад', rate: bottleneck?.hubOrePerSecond }] as const).map((item) => (
            <button key={item.id} type="button" className={`flow-step ${bottleneck?.bottleneck === item.kind ? 'bottleneck' : ''}`}
              aria-label={`${item.title}: ${formatCompact(item.rate ?? 0)} в секунду${bottleneck?.bottleneck === item.kind ? ', узкое место' : ''}. Выбрать объект.`}
              onClick={() => sendGameCommand({ type: 'SELECT', facilityId: item.id })}>
              <Icon name={item.icon} size={18} /><span>{item.title}<strong>{formatCompact(item.rate ?? 0)}</strong></span>
              {bottleneck?.bottleneck === item.kind && <i aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      <section className="game-stage" aria-label="Шахта">
        <GameCanvas />
        {!simulation && <div className="game-loading" role="status">Восстанавливаем шахту…</div>}
        <div className="mine-hint" aria-hidden="true">{unlockedShafts}/30 уровней · потяните шахту вверх</div>
      </section>

      <section className={`upgrade-dock ${dockExpanded ? 'expanded' : ''}`} aria-label="Улучшения выбранного объекта">
        <div className="dock-titlebar">
          <label className="facility-picker">
            <span>Объект · ур. {selectedStats?.level ?? 1}{selectedIsAutomated ? ' · АВТО' : ''}</span>
            <select aria-label="Выбрать уровень, лифт или склад" value={selectedFacility}
              onChange={(event) => sendGameCommand({ type: 'SELECT', facilityId: event.target.value as FacilityId })}>
              {simulation?.shafts.map((shaft) => <option key={shaft.id} value={shaft.id}>{facilityName(shaft.id)}{shaft.unlocked ? '' : ' · закрыт'}</option>)}
              {!simulation && <option value="shaft-1">Уровень 01</option>}
              <option value="lift">Грузовой лифт</option><option value="hub">Склад</option>
            </select>
          </label>
          <button type="button" className="dock-toggle" aria-expanded={dockExpanded} aria-controls="dock-details" onClick={() => setDockExpanded((value) => !value)}>
            {dockExpanded ? 'Свернуть' : 'Менеджер'}<Icon name="down" size={16} style={{ transform: dockExpanded ? 'rotate(180deg)' : undefined }} />
          </button>
        </div>
        <div className="dock-scroll">
          <div className="facility-stats">
            <span>{selectedStats?.primaryLabel ?? 'За цикл'} <b>{selectedStats?.primaryValue ?? '—'}</b></span>
            <span>{selectedStats?.secondaryLabel ?? 'Цикл'} <b>{selectedStats?.secondaryValue ?? '—'}</b></span>
          </div>
          <div id="dock-details" className="dock-details" hidden={!dockExpanded}>
            {selectedManager && selectedStats?.isUnlocked && <div className={`manager-card ${selectedManager.hired ? 'hired' : ''}`}>
              <div className="manager-avatar" aria-hidden="true">{managerInitials(selectedManager.name)}</div>
              <div className="manager-copy"><strong>{selectedManager.name}</strong><small>{selectedManager.hired ? `Автоматизация · +${selectedManager.passiveBonusPercent}%` : 'Запускает производство автоматически'}</small></div>
              {!selectedManager.hired ? <button type="button" className="manager-hire" disabled={!selectedManager.canHire}
                onClick={() => sendGameCommand({ type: 'HIRE_MANAGER', facilityId: selectedFacility })}>Нанять · {formatCompact(selectedManager.hireCost)} {currencyCode}</button>
                : <button type="button" className="manager-ability" disabled={!selectedManager.abilityReady}
                  onClick={() => sendGameCommand({ type: 'ACTIVATE_MANAGER', facilityId: selectedFacility })}>{abilityLabel(selectedManager)}</button>}
            </div>}
            {selectedStats?.isUnlocked && <p className="milestone-line">Множитель ×{selectedStats.milestone.currentMultiplier}. {selectedStats.milestone.nextLevel ? `Следующий рубеж: ур. ${selectedStats.milestone.nextLevel}, ×${selectedStats.milestone.nextMultiplier}.` : 'Все рубежи открыты.'}</p>}
            {barrier && <div className="barrier-strip"><div><strong>Барьер · {barrier.boundaryDepth}00 м</strong><span>{barrier.active ? `Осталось ${formatAwayTime(barrier.remaining)}` : barrier.requirementsMet ? `Откроет уровни до ${barrier.targetDepth}` : `Откройте уровень ${barrier.boundaryDepth}`}</span></div>
              {!barrier.active && <button type="button" disabled={!barrier.canStart} onClick={() => sendGameCommand({ type: 'START_BARRIER' })}>Расчистить · {formatCompact(barrier.cost)} {currencyCode}</button>}
            </div>}
            <button type="button" className="rebuild-entry" onClick={() => setRebuildOpen(true)}><Icon name="reset" /><span>Перезапуск шахты<small>R{rebuild?.level ?? 0} · постоянный множитель ×{rebuild?.currentMultiplier ?? 1}</small></span><Icon name="chevron" size={16} /></button>
          </div>
        </div>
        <div className="dock-purchase">
          {selectedStats && !selectedStats.isUnlocked ? <div className="locked-facility-card">
            <p>{selectedStats.isAccessible ? 'Новый добывающий уровень. Откройте его, чтобы начать работу.' : 'Этот уровень находится за барьером. Расчистка — в разделе «Менеджер» выше.'}</p>
            <button type="button" className="primary-button" disabled={!selectedStats.canUnlock} onClick={() => {
              if (selectedFacility !== 'lift' && selectedFacility !== 'hub') sendGameCommand({ type: 'UNLOCK_SHAFT', shaftId: selectedFacility });
            }}>{selectedStats.isAccessible ? `Открыть · ${formatCompact(selectedStats.unlockCost)} ${currencyCode}` : 'Сначала расчистите барьер'}</button>
          </div> : <>
            <div className="bulk-selector" role="group" aria-label="Количество улучшений">
              {([1, 10, 25, 'MAX'] as BulkUpgradeMode[]).map((mode) => <button key={String(mode)} type="button" aria-pressed={bulkMode === mode} className={bulkMode === mode ? 'active' : ''} onClick={() => setBulkMode(mode)}>{mode === 'MAX' ? 'Макс.' : `+${mode}`}</button>)}
            </div>
            <div className="facility-actions">
              <button type="button" className="run-action" onClick={() => runFacility(selectedFacility)}><Icon name="play" size={17} />{selectedIsAutomated ? 'Ручной пуск' : 'Запустить'}</button>
              <button type="button" className="upgrade-action" disabled={!selectedQuote?.affordable} onClick={() => sendGameCommand({ type: 'UPGRADE_BULK', facilityId: selectedFacility, mode: bulkMode })}>
                <span>Улучшить {selectedQuote?.levels ? `+${selectedQuote.levels}` : ''}</span><small>{formatCompact(selectedQuote?.totalCost || selectedBulkQuotes?.x1.totalCost || 0)} {currencyCode}</small>
              </button>
            </div>
          </>}
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Главная навигация">
        <button type="button" className={!panel ? 'active' : ''} aria-current={!panel ? 'page' : undefined} onClick={() => setPanel(null)}><Icon name="mine" /><span>Шахта</span></button>
        <button type="button" className={mapOpen ? 'active' : ''} onClick={() => setPanel('map')}><Icon name="map" /><span>Карта</span></button>
        <button type="button" className={teamOpen ? 'active' : ''} onClick={() => setPanel('team')}><Icon name="team" /><span>Команда</span></button>
        <button type="button" className={researchOpen ? 'active' : ''} onClick={() => setPanel('research')}><Icon name="research" /><span>Наука</span></button>
        <button type="button" className={eventsOpen || riftOpen || blitzOpen || contractOpen || seasonOpen ? 'active' : ''} onClick={() => setPanel('events')}><Icon name="events" /><span>События</span></button>
      </nav>

      {panel === 'system' && <Dialog label="Объект и подключение" onClose={() => setPanel(null)} className="system-dialog"><section className="system-panel">
        <header className="panel-header"><div><span>Обзор</span><strong>Объект и подключение</strong></div><button type="button" className="icon-button" aria-label="Закрыть обзор" data-dialog-initial onClick={() => setPanel(null)}><Icon name="close" /></button></header>
        <div className="panel-scroll">
          <h2>{activeMine?.name ?? 'Scrapline Quarry'}</h2><p className="inline-note">{activeSector?.name ?? 'Rust Valley'} · {currencyCode}</p>
          <div className="system-stats"><div><span>Менеджеры</span><b>{hiredManagers}/{managerRoster.length}</b></div><div><span>Уровни</span><b>{unlockedShafts}/30</b></div><div><span>В шахте</span><b>{formatCompact(rawOre)} руды</b></div><div><span>На поверхности</span><b>{formatCompact(simulation?.surfaceBuffer ?? 0)} руды</b></div></div>
          <div className="status-message"><b>{apiOnline ? 'Сервер подключён' : 'Локальная игра'}</b><p>{apiOnline ? 'Сетевые режимы используют подключённый API.' : 'Шахты и сохранения работают на этом устройстве. Для рейтингов Blitz и Rift нужен отдельный сервер.'}</p></div>
          <button type="button" className="rebuild-entry" onClick={() => setRebuildOpen(true)}><Icon name="reset" /><span>Перезапуск шахты<small>R{rebuild?.level ?? 0} · множитель ×{rebuild?.currentMultiplier ?? 1}</small></span><Icon name="chevron" /></button>
          <p className="inline-note">Stage 17 · UI 16.1 · автоматическое качество: {quality}. Сохранения основной игры остаются в браузере; не очищайте данные сайта.</p>
        </div>
      </section></Dialog>}

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
        <Dialog label="Перезапуск шахты" onClose={() => setRebuildOpen(false)} className="rebuild-dialog">
          <section className="rebuild-panel">
            <header className="rebuild-header">
              <div>
                <span>ПОСТОЯННОЕ РАЗВИТИЕ</span>
                <strong>Перезапуск шахты</strong>
                <small>{activeMine?.code ?? '—'} · {activeMine?.name ?? 'Mining Site'}</small>
              </div>
              <button type="button" onClick={() => setRebuildOpen(false)} aria-label="Закрыть перезапуск" data-dialog-initial><Icon name="close" /></button>
            </header>
            <div className="panel-scroll">

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

            {confirmRebuild && <div className="confirmation-box" role="status"><p>Вы сбросите уровни, местных менеджеров и руду только этой шахты. Отменить выполненный перезапуск нельзя.</p><button type="button" onClick={() => setConfirmRebuild(false)}>Отмена</button></div>}
            <button
              type="button"
              className="rebuild-confirm"
              disabled={!rebuild.canRebuild || rebuild.maxed}
              onClick={() => {
                if (!confirmRebuild) { setConfirmRebuild(true); return; }
                sendGameCommand({ type: 'REBUILD_MINE' });
                setRebuildOpen(false);
              }}
            >
              {rebuild.maxed ? 'MAX REBUILD' : rebuild.canRebuild ? `${confirmRebuild ? 'Подтвердить сброс' : 'Перезапустить'} → R${rebuild.level + 1} · ×${rebuild.nextMultiplier}` : 'ТРЕБОВАНИЯ НЕ ВЫПОЛНЕНЫ'}
            </button>
            </div>
          </section>
        </Dialog>
      )}


      {researchOpen && research && (
        <ResearchPanel research={research} onClose={() => setResearchOpen(false)} />
      )}

      {offlineReport && !panel && (
        <Dialog label="Пока вас не было" onClose={() => setOfflineReport(null)} className="offline-dialog">
          <section className="offline-panel panel-scroll">
            <div className="offline-icon" aria-hidden="true">DF</div>
            <span className="offline-eyebrow">АВТОНОМНЫЙ РЕЖИМ</span>
            <h2>Пока вас не было</h2>
            <p className="inline-note">Доход уже сохранён. Повторное открытие окна не начисляет его заново.</p>
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
              <span>{formatCompact(offlineReport.processedOre)} ед. сырья обработано</span>
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
              Продолжить
            </button>
          </section>
        </Dialog>
      )}

      {teamOpen && (
        <Dialog label="Команда" onClose={() => setTeamOpen(false)} className="team-dialog">
          <section className="team-panel stage9-team-panel stage10-team-panel stage11-team-panel stage14-team-panel">
            <header className="team-header">
              <div><span>УПРАВЛЕНИЕ КОМАНДОЙ</span><strong>{teamTab === 'managers' ? 'Менеджеры объекта' : teamTab === 'specialists' ? 'Специалисты' : teamTab === 'academy' ? 'Академия' : teamTab === 'crew' ? 'Друзья и операции' : 'Коллекция и экипировка'}</strong></div>
              <button type="button" onClick={() => setTeamOpen(false)} aria-label="Закрыть команду" data-dialog-initial><Icon name="close" /></button>
            </header>
            <Tabs id="team" label="Раздел команды" value={teamTab} onChange={setTeamTab} options={[
              { value: 'managers', label: 'Менеджеры' }, { value: 'specialists', label: 'Специалисты' },
              { value: 'academy', label: 'Академия' }, { value: 'crew', label: 'Друзья' }, { value: 'progression', label: 'Развитие' },
            ]} />
            <div className="panel-scroll" id="team-panel" role="tabpanel" aria-labelledby={`team-${teamTab}`}>


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
            </div>
          </section>
        </Dialog>
      )}
    </main>
  );
}
