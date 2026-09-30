import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLITZ_FACILITY_LABELS, type BlitzActionId, type BlitzStatusView } from '../game/core/blitz';
import { formatCompact } from '../game/core/format';
import { Dialog } from './components/Dialog';
import { Icon } from './components/Icon';
import { finishBlitzSession, getBlitzStatus, sendBlitzAction, startBlitzSession } from '../services/blitzApi';

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}ч ${minutes % 60}м`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function movementLabel(movement: BlitzStatusView['profile']['previousMovement']) {
  if (movement === 'promoted') return 'Повышение';
  if (movement === 'demoted') return 'Понижение';
  if (movement === 'stable') return 'Лига сохранена';
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
  const alive = useRef(true);
  const inFlight = useRef(false);
  const statusRequest = useRef<Promise<BlitzStatusView> | null>(null);
  const actionLock = useRef(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const identity = useMemo(() => ({ playerId, nickname }), [playerId, nickname]);
  const [status, setStatus] = useState<BlitzStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Один запрос за раз: скрытая вкладка не опрашивает сервер и не тратит батарею.
  const refresh = useCallback(async (silent = false) => {
    if (!apiOnline || inFlight.current || actionLock.current || document.hidden) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const request = getBlitzStatus(identity);
      statusRequest.current = request;
      const next = await request;
      if (alive.current) { setStatus(next); setError(null); }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'BLITZ_UNAVAILABLE');
    } finally {
      inFlight.current = false; statusRequest.current = null;
      if (alive.current && !silent) setLoading(false);
    }
  }, [apiOnline, identity]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const activeSession = Boolean(status?.activeSession);
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      await refresh(Boolean(status));
      if (!stopped) timer = window.setTimeout(tick, activeSession ? 2000 : 7000);
    };
    const visible = () => { if (!document.hidden) void refresh(true); };
    if (apiOnline) void tick();
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
    // Содержимое статуса не перезапускает опрос после каждого ответа.
  }, [apiOnline, refresh, activeSession]);

  async function runAction(key: string, operation: () => Promise<BlitzStatusView>) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(key); setError(null);
    try {
      // Принятое нажатие не теряется из-за фонового опроса. Сначала завершаем чтение.
      if (statusRequest.current) await statusRequest.current.catch(() => undefined);
      if (!alive.current) return;
      const next = await operation(); if (alive.current) setStatus(next);
    }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'ACTION_FAILED'); }
    finally { actionLock.current = false; if (alive.current) setBusy(null); }
  }
  const start = () => runAction('start', () => startBlitzSession(identity));
  async function upgrade(action: BlitzActionId) {
    const session = status?.activeSession;
    if (!session) return;
    await runAction(action, async () => { await sendBlitzAction(identity, session.id, action); return getBlitzStatus(identity); });
  }
  async function finish() {
    const session = status?.activeSession;
    if (!session) return;
    setConfirmFinish(false);
    await runAction('finish', () => finishBlitzSession(identity, session.id));
  }

  const movement = status ? movementLabel(status.profile.previousMovement) : null;

  return (
    <Dialog label="Blitz Drill" onClose={onClose} className="blitz-dialog">
      <section className="blitz-panel">
        <header className="blitz-header">
          <div>
            <span>СОРЕВНОВАНИЕ · 10 МИНУТ</span>
            <strong>Blitz Drill</strong>
            <small>{status?.event.title ?? 'Velocity Run'} · 10 минут</small>
          </div>
          <button type="button" className="icon-button" data-dialog-initial aria-label="Закрыть Blitz" onClick={onClose}><Icon name="close" /></button>
        </header>

        <div className="panel-scroll">
        {!apiOnline ? (
          <div className="blitz-server-offline">
            <b>НУЖЕН СЕРВЕР</b>
            <strong>Рейтинговый режим недоступен без backend</strong>
            <span>GitHub Pages остаётся игровой демо-версией. После подключения VPS этот экран автоматически станет сетевым.</span>
          </div>
        ) : loading && !status ? (
          <div className="blitz-loading">Синхронизация рейтинга…</div>
        ) : status ? (
          <div className="blitz-content">
            <section className="blitz-profile-grid">
              <div><span>ДИВИЗИОН</span><strong>{status.profile.division}</strong><small>{status.profile.groupId}</small></div>
              <div><span>БИЛЕТЫ</span><strong>{status.profile.ticketsLeft}/{status.profile.ticketsMax}</strong><small>на цикл</small></div>
              <div><span>МЕДАЛИ</span><strong>{status.profile.medals}</strong><small>награды рейтинга</small></div>
              <div><span>ДО КОНЦА</span><strong>{formatTime(status.event.remainingSeconds)}</strong><small>время сервера</small></div>
            </section>

            {movement && status.profile.previousRank && (
              <div className={`blitz-movement ${status.profile.previousMovement}`}>
                <b>{movement}</b>
                <span>Прошлый цикл: #{status.profile.previousRank} / {status.profile.previousParticipants}</span>
              </div>
            )}

            {error && <div className="blitz-error" role="alert">{error === 'NOT_ENOUGH_CREDITS' ? 'Недостаточно Drill Credits.' : error}</div>}

            {status.activeSession ? (
              <section className="blitz-session-card">
                <div className="blitz-session-head">
                  <div><span>ДО КОНЦА ЗАБЕГА</span><strong>{formatTime(status.activeSession.remainingSeconds)}</strong></div>
                  <div><span>ОЧКИ</span><strong>{formatCompact(status.activeSession.score)}</strong></div>
                  <div><span>КРЕДИТЫ</span><strong>{formatCompact(status.activeSession.credits)}</strong></div>
                  <div><span>ПОТОК</span><strong>{status.activeSession.throughput.toFixed(1)}/s</strong></div>
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
                  {!confirmFinish ? <button type="button" disabled={Boolean(busy)} onClick={() => setConfirmFinish(true)}>Завершить забег</button> : <div className="confirmation-box" role="alert"><strong>Завершить сейчас?</strong><p>Сервер зафиксирует результат. Билет не возвращается.</p><div><button type="button" onClick={() => setConfirmFinish(false)}>Продолжить забег</button><button type="button" disabled={Boolean(busy)} onClick={() => void finish()}>{busy === 'finish' ? 'Завершение…' : 'Зафиксировать'}</button></div></div>}
                </div>
              </section>
            ) : (
              <section className="blitz-start-card">
                <div>
                  <span>BLITZ DRILL</span>
                  <strong>Постройте максимально эффективную цепочку за 10 минут</strong>
                  <small>Добыча → Лифт → Логистика. Улучшайте самое медленное звено.</small>
                </div>
                <button type="button" disabled={Boolean(busy) || status.profile.ticketsLeft <= 0} onClick={() => void start()}>
                  {status.profile.ticketsLeft <= 0 ? 'БИЛЕТЫ ЗАКОНЧИЛИСЬ' : busy === 'start' ? 'СТАРТ…' : 'Начать забег'}
                </button>
              </section>
            )}

            <section className="blitz-board">
              <header>
                <div><span>РЕЙТИНГ ГРУППЫ</span><strong>{status.profile.division} · {status.profile.groupId}</strong></div>
                <div><b>{status.participants}</b><small>игроков</small></div>
              </header>
              {status.participants < 5 && <div className="blitz-waiting">Для движения между дивизионами нужно минимум 5 завершивших игроков в группе.</div>}
              <div className="blitz-zone-legend"><span className="promotion">↑ Лучшие 15%</span><span>Без изменения</span><span className="demotion">↓ Нижние 15%</span></div>
              <div className="blitz-board-list">
                {status.leaderboard.length === 0 ? (
                  <div className="blitz-empty">Пока никто не завершил Run. Станьте первым.</div>
                ) : status.leaderboard.map((entry) => (
                  <div key={entry.playerId} className={`blitz-board-row ${entry.self ? 'self' : ''} ${entry.zone}`}>
                    <b>#{entry.rank}</b>
                    <div><strong>{entry.nickname}</strong><span>{entry.self ? 'Вы · ' : ''}{entry.playerId}</span></div>
                    <em>{formatCompact(entry.score)}</em>
                  </div>
                ))}
              </div>
            </section>

            <p className="blitz-security-note">Защита Stage 15: время сервера, server credits, server upgrade cost, server score, session ownership и rate limit. Клиент не имеет API для отправки произвольного score.</p>
          </div>
        ) : (
          <div className="blitz-loading" role="alert"><p>{error ?? 'Не удалось загрузить рейтинг.'}</p><button type="button" onClick={() => void refresh()}>Повторить подключение</button></div>
        )}
        </div>
      </section>
    </Dialog>
  );
}
