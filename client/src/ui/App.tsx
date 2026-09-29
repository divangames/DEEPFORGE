import { useEffect } from 'react';
import { getApiHealth } from '../services/api';
import { formatCompact } from '../game/core/format';
import type { FacilityId } from '../game/core/types';
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

export function App() {
  const quality = useGameStore((state) => state.quality);
  const apiOnline = useGameStore((state) => state.apiOnline);
  const simulation = useGameStore((state) => state.simulation);
  const selectedFacility = useGameStore((state) => state.selectedFacility);
  const selectedStats = useGameStore((state) => state.selectedStats);
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
        <div className="resource-pill" aria-label="Деньги">
          <span>$</span>{formatCompact(simulation?.cash ?? 0)}
        </div>
      </header>

      <section className="game-stage">
        <GameCanvas />

        <div className="stage-status" aria-hidden="true">
          <span><b>{formatCompact(rawOre)}</b> ORE</span>
          <span><b>{formatCompact(simulation?.surfaceBuffer ?? 0)}</b> SURFACE</span>
        </div>

        <div className="stage-badge">
          <strong>STAGE 1</strong>
          <span>{quality}</span>
          <span className={apiOnline ? 'ok' : 'muted'}>{apiOnline ? 'API' : 'LOCAL'}</span>
        </div>
      </section>

      <section className="upgrade-dock" aria-label="Панель объекта">
        <div className="facility-copy">
          <div className="facility-title-row">
            <strong>{selectedStats?.name ?? 'Deck 01'}</strong>
            <span>LVL {selectedStats?.level ?? 1}</span>
          </div>
          <div className="facility-stats">
            <span>{selectedStats?.primaryLabel ?? 'За цикл'} <b>{selectedStats?.primaryValue ?? '—'}</b></span>
            <span>{selectedStats?.secondaryLabel ?? 'Цикл'} <b>{selectedStats?.secondaryValue ?? '—'}</b></span>
          </div>
        </div>

        <div className="facility-actions">
          <button type="button" className="run-action" onClick={() => runFacility(selectedFacility)}>
            ▶ ЗАПУСТИТЬ
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
        <button type="button" className="active"><span>◆</span>Объект</button>
        <button type="button" disabled><span>⌖</span>Карта</button>
        <button type="button" disabled><span>♟</span>Команда</button>
        <button type="button" disabled><span>•••</span>Ещё</button>
      </nav>
    </main>
  );
}
