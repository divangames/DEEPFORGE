import { useCallback, useEffect, useMemo, useState } from 'react';
import { BLITZ_FACILITY_LABELS, type BlitzActionId, type BlitzStatusView } from '../game/core/blitz';
import { formatCompact } from '../game/core/format';
import { finishBlitzSession, getBlitzStatus, sendBlitzAction, startBlitzSession } from '../services/blitzApi';

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}ч ${minutes % 60}м`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function movementLabel(movement: BlitzStatusView['profile']['previousMovement']) {
  if (movement === 'promoted') return '↑ PROMOTED';
  if (movement === 'demoted') return '↓ DEMOTED';
  if (movement === 'stable') return '— STABLE';
  return null;
}

export function BlitzPanel({
  playerId,
  nickname,
  apiOnline,
  onClose,
}: {
  playerId: string;
  nickname: string;
  apiOnline: boolean | null;
  onClose: () => void;
}) {
  const identity = useMemo(() => ({ playerId, nickname }), [playerId, nickname]);
  const [status, setStatus] = useState<BlitzStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!apiOnline) return;
    if (!silent) setLoading(true);
    try {
      const next = await getBlitzStatus(identity);
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BLITZ_UNAVAILABLE');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [apiOnline, identity]);

  useEffect(() => {
    void refresh();
    if (!apiOnline) return undefined;
    const timer = window.setInterval(() => void refresh(true), status?.activeSession ? 2000 : 7000);
    return () => window.clearInterval(timer);
  }, [apiOnline, refresh, Boolean(status?.activeSession)]);

  async function start() {
    setBusy('start');
    try {
      setStatus(await startBlitzSession(identity));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'START_FAILED');
    } finally {
      setBusy(null);
    }
  }

  async function upgrade(action: BlitzActionId) {
    const session = status?.activeSession;
    if (!session) return;
    setBusy(action);
    try {
      await sendBlitzAction(identity, session.id, action);
      await refresh(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ACTION_FAILED');
      await refresh(true);
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    const session = status?.activeSession;
    if (!session) return;
    setBusy('finish');
    try {
      setStatus(await finishBlitzSession(identity, session.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FINISH_FAILED');
    } finally {
      setBusy(null);
    }
  }

  const movement = status ? movementLabel(status.profile.previousMovement) : null;

  return (
    <div className="blitz-overlay" role="dialog" aria-modal="true" aria-label="Blitz Drill Leaderboard">
      <button type="button" className="blitz-backdrop" aria-label="Закрыть" onClick={onClose} />
      <section className="blitz-panel">
        <header className="blitz-header">
          <div>
            <span>SERVER-AUTHORITATIVE COMPETITION</span>
            <strong>Blitz Drill</strong>
            <small>{status?.event.title ?? 'Velocity Run'} · 10 минут</small>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </header>

        {!apiOnline ? (
          <div className="blitz-server-offline">
            <b>SERVER REQUIRED</b>
            <strong>Рейтинговый режим недоступен без backend</strong>
            <span>GitHub Pages остаётся игровой демо-версией. После подключения VPS этот экран автоматически станет сетевым.</span>
          </div>
        ) : loading && !status ? (
          <div className="blitz-loading">Синхронизация рейтинга…</div>
        ) : status ? (
          <div className="blitz-scroll">
            <section className="blitz-profile-grid">
              <div><span>ДИВИЗИОН</span><strong>{status.profile.division}</strong><small>{status.profile.groupId}</small></div>
              <div><span>БИЛЕТЫ</span><strong>{status.profile.ticketsLeft}/{status.profile.ticketsMax}</strong><small>на цикл</small></div>
              <div><span>МЕДАЛИ</span><strong>{status.profile.medals}</strong><small>server reward</small></div>
              <div><span>ДО КОНЦА</span><strong>{formatTime(status.event.remainingSeconds)}</strong><small>server time</small></div>
            </section>

            {movement && status.profile.previousRank && (
              <div className={`blitz-movement ${status.profile.previousMovement}`}>
                <b>{movement}</b>
                <span>Прошлый цикл: #{status.profile.previousRank} / {status.profile.previousParticipants}</span>
              </div>
            )}

            {error && <div className="blitz-error">{error === 'NOT_ENOUGH_CREDITS' ? 'Недостаточно Drill Credits.' : error}</div>}

            {status.activeSession ? (
              <section className="blitz-session-card">
                <div className="blitz-session-head">
                  <div><span>ACTIVE RUN</span><strong>{formatTime(status.activeSession.remainingSeconds)}</strong></div>
                  <div><span>SCORE</span><strong>{formatCompact(status.activeSession.score)}</strong></div>
                  <div><span>DRILL CR</span><strong>{formatCompact(status.activeSession.credits)}</strong></div>
                  <div><span>FLOW</span><strong>{status.activeSession.throughput.toFixed(1)}/s</strong></div>
                </div>
                <div className="blitz-facilities">
                  {status.activeSession.facilities.map((facility) => {
                    const action = `upgrade-${facility.id}` as BlitzActionId;
                    return (
                      <article key={facility.id}>
                        <div><span>{BLITZ_FACILITY_LABELS[facility.id]}</span><strong>LV {facility.level}</strong><small>{facility.rate.toFixed(1)}/s</small></div>
                        <button
                          type="button"
                          disabled={Boolean(busy) || status.activeSession!.credits < facility.upgradeCost}
                          onClick={() => void upgrade(action)}
                        >
                          {busy === action ? '…' : `↑ ${facility.upgradeCost}`}
                        </button>
                      </article>
                    );
                  })}
                </div>
                <div className="blitz-session-actions">
                  <span>Score считается только на сервере. Клиент отправляет лишь upgrade-action.</span>
                  <button type="button" disabled={Boolean(busy)} onClick={() => void finish()}>{busy === 'finish' ? 'ЗАВЕРШЕНИЕ…' : 'ЗАВЕРШИТЬ RUN'}</button>
                </div>
              </section>
            ) : (
              <section className="blitz-start-card">
                <div>
                  <span>VELOCITY RUN</span>
                  <strong>Постройте максимально эффективную цепочку за 10 минут</strong>
                  <small>Extraction → Cargo Lift → Logistics. Каждое улучшение проверяет и считает сервер.</small>
                </div>
                <button type="button" disabled={Boolean(busy) || status.profile.ticketsLeft <= 0} onClick={() => void start()}>
                  {status.profile.ticketsLeft <= 0 ? 'БИЛЕТЫ ЗАКОНЧИЛИСЬ' : busy === 'start' ? 'СТАРТ…' : '▶ НАЧАТЬ RUN'}
                </button>
              </section>
            )}

            <section className="blitz-board">
              <header>
                <div><span>GROUP LEADERBOARD</span><strong>{status.profile.division} · {status.profile.groupId}</strong></div>
                <div><b>{status.participants}</b><small>игроков</small></div>
              </header>
              {status.participants < 5 && <div className="blitz-waiting">Для движения между дивизионами нужно минимум 5 завершивших игроков в группе.</div>}
              <div className="blitz-zone-legend"><span className="promotion">↑ TOP 15%</span><span>SAFE</span><span className="demotion">↓ BOTTOM 15%</span></div>
              <div className="blitz-board-list">
                {status.leaderboard.length === 0 ? (
                  <div className="blitz-empty">Пока никто не завершил Run. Станьте первым.</div>
                ) : status.leaderboard.map((entry) => (
                  <div key={entry.playerId} className={`blitz-board-row ${entry.self ? 'self' : ''} ${entry.zone}`}>
                    <b>#{entry.rank}</b>
                    <div><strong>{entry.nickname}</strong><span>{entry.self ? 'YOU · ' : ''}{entry.playerId}</span></div>
                    <em>{formatCompact(entry.score)}</em>
                  </div>
                ))}
              </div>
            </section>

            <p className="blitz-security-note">Защита Stage 15: server time, server credits, server upgrade cost, server score, session ownership и rate limit. Клиент не имеет API для отправки произвольного score.</p>
          </div>
        ) : (
          <div className="blitz-loading">{error ?? 'Не удалось загрузить рейтинг.'}</div>
        )}
      </section>
    </div>
  );
}
