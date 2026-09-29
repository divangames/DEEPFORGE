import { useEffect, useMemo, useState } from 'react';
import { getApiHealth } from '../services/api';
import { formatCompact } from '../game/core/format';
import type { FacilityId, ManagerView } from '../game/core/types';
import { sendGameCommand } from '../game/runtime/gameRuntime';
import { useGameStore } from '../state/gameStore';
import { GameCanvas } from './GameCanvas';

function runFacility(id: FacilityId) {
  if (id === 'lift') {
    sendGameCommand({ type: 'START_LIFT' });
    return;
  }
  if (id === 'hub') {
    sendGameCommand({ type: 'START_HUB' });
    return;
  }
  sendGameCommand({ type: 'START_SHAFT', shaftId: id });
}

function facilityName(id: FacilityId) {
  if (id === 'lift') return 'Cargo Lift';
  if (id === 'hub') return 'Logistics Hub';
  return `Deck 0${Number(id.at(-1))}`;
}

function managerInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function abilityLabel(manager: ManagerView) {
  if (manager.activeRemaining > 0) return `⚡ ${manager.activeRemaining.toFixed(0)}с`;
  if (manager.cooldownRemaining > 0) return `⏱ ${manager.cooldownRemaining.toFixed(0)}с`;
  return `${manager.abilityName} ×${manager.abilityMultiplier}`;
}

export function App() {
  const [teamOpen, setTeamOpen] = useState(false);
  const quality = useGameStore((state) => state.quality);
  const apiOnline = useGameStore((state) => state.apiOnline);
  const simulation = useGameStore((state) => state.simulation);
  const selectedFacility = useGameStore((state) => state.selectedFacility);
  const selectedStats = useGameStore((state) => state.selectedStats);
  const selectedManager = useGameStore((state) => state.selectedManager);
  const managerRoster = useGameStore((state) => state.managerRoster);
  const canUpgradeSelected = useGameStore((state) => state.canUpgradeSelected);
  const setApiOnline = useGameStore((state) => state.setApiOnline);

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
  const hiredManagers = useMemo(() => managerRoster.filter((manager) => manager.hired).length, [managerRoster]);
  const selectedIsAutomated = selectedManager?.hired ?? false;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">DF</span>
          <div className="brand-copy">
            <strong>DEEPFORGE</strong>
            <span>RUST VALLEY · 01</span>
          </div>
        </div>
        <div className="topbar-meta">
          <div className="manager-count" aria-label="Нанятые менеджеры">
            <span>♟</span>{hiredManagers}/5
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
          <span><b>{formatCompact(simulation?.surfaceBuffer ?? 0)}</b> SURFACE</span>
        </div>

        <div className="stage-badge">
          <strong>STAGE 2</strong>
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
        </div>

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

        <div className="facility-actions">
          <button type="button" className="run-action" onClick={() => runFacility(selectedFacility)}>
            {selectedIsAutomated ? '↻ РУЧНОЙ ЗАПУСК' : '▶ ЗАПУСТИТЬ'}
          </button>
          <button
            type="button"
            className="upgrade-action"
            disabled={!canUpgradeSelected}
            onClick={() => sendGameCommand({ type: 'UPGRADE', facilityId: selectedFacility })}
          >
            ↑ ${formatCompact(selectedStats?.upgradeCost ?? 0)}
          </button>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Главная навигация">
        <button type="button" className={!teamOpen ? 'active' : ''} onClick={() => setTeamOpen(false)}><span>◆</span>Объект</button>
        <button type="button" disabled><span>⌖</span>Карта</button>
        <button type="button" className={teamOpen ? 'active' : ''} onClick={() => setTeamOpen(true)}><span>♟</span>Команда</button>
        <button type="button" disabled><span>•••</span>Ещё</button>
      </nav>

      {teamOpen && (
        <div className="team-overlay" role="dialog" aria-modal="true" aria-label="Команда менеджеров">
          <button className="team-backdrop" type="button" aria-label="Закрыть" onClick={() => setTeamOpen(false)} />
          <section className="team-panel">
            <header className="team-header">
              <div>
                <span>УПРАВЛЕНИЕ ОБЪЕКТОМ</span>
                <strong>Команда менеджеров</strong>
              </div>
              <button type="button" onClick={() => setTeamOpen(false)}>✕</button>
            </header>

            <div className="team-summary">
              <strong>{hiredManagers}/5</strong>
              <span>звеньев автоматизировано</span>
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

            <p className="team-note">Менеджер автоматически запускает своё звено цепочки. Активная способность временно ускоряет его работу.</p>
          </section>
        </div>
      )}
    </main>
  );
}
