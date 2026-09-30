import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { RiftAction, RiftResource, RiftStatus, RiftWallet } from '../game/core/rift';
import { forgetRiftIdentity, hasRiftBackend, loadRiftIdentity, registerRiftGuest, riftAction, riftStart, riftStatus } from '../services/riftApi';
import './rift.css';
import { Dialog } from './components/Dialog';
import { Icon } from './components/Icon';
import { Tabs } from './components/Tabs';

const ERROR_LABELS: Record<string, string> = {
  SERVER_REQUIRED: 'Для Rift нужен подключённый сервер. Укажите VITE_API_URL и опубликуйте backend.',
  SERVER_OUTDATED: 'Backend ещё не обновлён до Stage 16. Обновите сервер, а не только GitHub Pages.',
  NETWORK_ERROR: 'Нет соединения с сервером. Прогресс не сброшен. Повторите подключение.',
  TIMEOUT: 'Сервер не успел ответить. Результат последнего действия уточняется повторным запросом.',
  UNAUTHORIZED: 'Гостевой ключ не распознан. Для MEMORY-режима это возможно после перезапуска сервера.',
  LOGIN_REQUIRED: 'Сначала подключите гостевой профиль.',
  DATABASE_REQUIRED: 'Серверу нужна PostgreSQL. Production-режим не использует временное хранилище.',
  RIFT_UNAVAILABLE: 'Серверное хранилище временно недоступно. Повторите позже.',
  STORAGE_UNAVAILABLE: 'Браузер не разрешает сохранить гостевой ключ. Проверьте настройки хранения данных.',
  STALE_REVISION: 'Состояние изменилось в другой вкладке. Данные обновлены; выберите действие снова.',
  NOT_ENOUGH_CREDITS: 'Недостаточно Rift Credits.',
  RATE_LIMITED: 'Слишком много запросов. Подождите немного.',
  EVENT_CHANGED: 'Начался новый цикл события. Обновите данные.',
  EVENT_CLOSED: 'Этот цикл завершён. Обновите данные, чтобы открыть следующий.',
  RUN_COMPLETE: 'Экспедиция завершена. Можно забрать оставшиеся награды.',
  STAGE_NOT_READY: 'Сначала выполните цель добычи и улучшите все три звена.',
  ALREADY_CLAIMED: 'Награда уже получена.',
};
const LABELS: Record<RiftResource, string> = {
  cores: 'Research Cores', recruitData: 'Recruit Data', trainingModules: 'Training Modules', promotionBadges: 'Promotion Badges',
  supplyKeys: 'Supply Keys', alloy: 'Alloy', circuits: 'Circuits', fiber: 'Fiber', medals: 'Rift Medals',
};
const smallNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const largeNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, notation: 'compact' });
const n = (value: number) => (value >= 100000 ? largeNumber : smallNumber).format(value);
function timeLeft(endsAt: number, now: number) {
  const minutes = Math.max(0, Math.ceil((endsAt - now) / 60000));
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} д ${Math.floor(minutes % 1440 / 60)} ч`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}
function RewardText({ reward }: { reward: Partial<RiftWallet> }) {
  return <span>{(Object.entries(reward) as [RiftResource, number][]).map(([key, value]) => `${LABELS[key]} +${value}`).join(' · ')}</span>;
}

export const RiftPanel = memo(function RiftPanel({ nickname, onClose }: { nickname: string; onClose: () => void }) {
  const mounted = useRef(false);
  const locked = useRef(false);
  const pending = useRef<RiftAction | null>(null);
  const [status, setStatus] = useState<RiftStatus | null>(null);
  const [tab, setTab] = useState<'run' | 'tree' | 'rewards' | 'board'>('run');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState(false);
  const [confirmation, setConfirmation] = useState<'complete' | 'identity' | null>(null);
  const [hasIdentity, setHasIdentity] = useState(() => Boolean(loadRiftIdentity()));
  const [receivedAt, setReceivedAt] = useState(0);
  const [displayNow, setDisplayNow] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);

  const accept = useCallback((value: RiftStatus) => {
    if (!mounted.current) return;
    setStatus(value); setReceivedAt(performance.now()); setDisplayNow(value.serverNow);
  }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (locked.current || !loadRiftIdentity() || document.hidden) return;
    locked.current = true;
    try { accept(await riftStatus(signal)); if (mounted.current && !pending.current) setError(null); }
    catch (err) { if (!signal?.aborted && mounted.current) setError(err instanceof Error ? err.message : 'NETWORK_ERROR'); }
    finally { locked.current = false; }
  }, [accept]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let timer: number | undefined;
    let stopped = false;
    const tick = async () => {
      await refresh(controller.signal);
      if (!stopped) timer = window.setTimeout(tick, 5000);
    };
    void tick();
    const visible = () => { if (!document.hidden) void refresh(controller.signal); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    return () => {
      mounted.current = false; stopped = true; controller.abort(); window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!status) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setDisplayNow(status.serverNow + Math.max(0, performance.now() - receivedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, receivedAt]);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); setConfirmation(null); }, [tab]);

  async function operation(job: () => Promise<RiftStatus>, action?: RiftAction) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    if (action) pending.current = action;
    try {
      accept(await job()); pending.current = null;
      if (mounted.current) { setRetryAction(false); setHasIdentity(Boolean(loadRiftIdentity())); }
    } catch (err) {
      const code = err instanceof Error ? err.message : 'NETWORK_ERROR';
      const uncertain = ['TIMEOUT', 'NETWORK_ERROR', 'RIFT_UNAVAILABLE'].includes(code);
      if (!uncertain) pending.current = null;
      if (mounted.current) { setError(code); setRetryAction(Boolean(pending.current)); }
      // Даже при потерянном ответе серверное состояние перечитывается; покупка не повторяется автоматически.
      if (loadRiftIdentity()) try { accept(await riftStatus()); } catch { /* Отображаем исходную ошибку. */ }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  function send(kind: RiftAction['kind'], target?: string, count?: 1 | 10) {
    if (!status?.run || pending.current) return;
    const action: RiftAction = { requestId: crypto.randomUUID(), eventId: status.event.id, revision: status.run.revision, kind,
      ...(target === undefined ? {} : { target }), ...(count === undefined ? {} : { count }) };
    void operation(() => riftAction(action), action);
  }
  const run = status?.run;
  const closed = status ? displayNow >= status.event.endsAt : true;
  const disabled = busy || closed || retryAction || ['UNAUTHORIZED', 'NETWORK_ERROR', 'TIMEOUT', 'RIFT_UNAVAILABLE'].includes(error ?? '');
  const connect = () => void operation(async () => {
    if (!loadRiftIdentity()) await registerRiftGuest(nickname);
    return riftStatus();
  });

  return <Dialog label="Rift Expedition" className="rift-dialog" onClose={onClose}>
    <section className="rift-panel">
      <header className="rift-header"><div><span>СОБЫТИЕ · 5 ОБЪЕКТОВ</span><h2 id="rift-title">Rift Expedition</h2></div>
        <button type="button" className="icon-button" data-dialog-initial aria-label="Закрыть Rift Expedition" onClick={onClose}><Icon name="close" /></button></header>
      {status && <div className="rift-summary">
        <div><small>До конца цикла</small><strong>{timeLeft(status.event.endsAt, displayNow)}</strong></div>
        <div><small>Rift Credits</small><strong>{n(run?.credits ?? 0)} RC</strong></div>
        <div><small>Очки</small><strong>{n(run?.score ?? 0)}</strong></div>
        <div><small>Чипы улучшений</small><strong>{run?.chips ?? 0} RP</strong></div>
      </div>}
      {status && <Tabs id="rift" label="Разделы Rift" value={tab} onChange={setTab} options={[
        { value: 'run', label: 'Объекты' }, { value: 'tree', label: 'Технологии' },
        { value: 'rewards', label: 'Награды' }, { value: 'board', label: 'Рейтинг' },
      ]} />}
      <div className="rift-scroll panel-scroll" ref={scroll} id="rift-panel" role={status ? 'tabpanel' : undefined} aria-labelledby={status ? `rift-${tab}` : undefined}>
        {error && <div className="rift-notice error" role="alert"><p>{ERROR_LABELS[error] ?? `Сервер: ${error}`}</p>
          {retryAction && <button type="button" disabled={busy} onClick={() => { const action = pending.current; if (action) void operation(() => riftAction(action), action); }}>Уточнить последнее действие</button>}
          {!retryAction && <button type="button" disabled={busy || !hasRiftBackend()} onClick={connect}>Повторить подключение</button>}
          {error === 'UNAUTHORIZED' && <button type="button" disabled={busy} onClick={() => setConfirmation('identity')}>Создать другой профиль</button>}
          {confirmation === 'identity' && <div className="confirmation-box" role="alert">
            <strong>Создать новый профиль Rift?</strong><p>Старый гостевой ключ будет удалён из этого браузера. Это действие не восстанавливает старый профиль. Обычные шахты и их сохранения останутся.</p>
            <div><button type="button" onClick={() => setConfirmation(null)}>Отмена</button><button type="button" className="danger-button" disabled={busy} onClick={() => {
              forgetRiftIdentity(); setHasIdentity(false); setStatus(null); setError(null); setConfirmation(null);
            }}>Создать новый</button></div>
          </div>}
        </div>}
        {!status ? <section className="rift-welcome">
          <div className="rift-emblem" aria-hidden="true">R / 16</div>
          <h3>Пройдите разлом до ядра</h3><p>Пять последовательных объектов, собственные кредиты, три производственных звена и технологии на весь цикл.</p>
          <p>Обычные деньги, менеджеры и глобальные бонусы сюда не переносятся. Результаты и награды считает сервер.</p>
          <div className="rift-notice">{hasRiftBackend() ? 'Для участия создаётся отдельный гостевой серверный профиль. Ключ сохраняется в этом браузере; публичный Player ID не используется как пароль.' : 'SERVER REQUIRED · На GitHub Pages без VPS доступен этот обзор. Для локальной проверки без базы запустите dev_rift_memory.bat; для онлайн-игры подключите backend через VITE_API_URL.'}</div>
          <button type="button" className="rift-primary" disabled={busy || !hasRiftBackend()} onClick={connect}>{busy ? 'Подключение…' : hasIdentity ? 'Продолжить экспедицию' : 'Подключить гостевой профиль'}</button>
        </section> : <>
          {status.persistence === 'memory' && <div className="rift-notice">DEV MEMORY · Тестовый сервер: профиль, рейтинг и награды исчезнут после его перезапуска. Для публикации нужна PostgreSQL.</div>}
          {closed && <div className="rift-notice">Цикл завершён. Новые действия заблокированы до синхронизации.</div>}
          {tab === 'run' && <>
            <div className="rift-route" aria-label="Прогресс пяти объектов">{status.stages.map((stage, i) => <div key={stage.id} className={run && (run.completed || i < run.stageIndex) ? 'done' : run?.stageIndex === i ? 'current' : ''}>
              <b>{run && (run.completed || i < run.stageIndex) ? '✓' : i + 1}</b><small>{i === run?.stageIndex ? 'СЕЙЧАС' : `ОБЪЕКТ ${i + 1}`}</small></div>)}</div>
            {!run ? <section className="rift-card"><h3>Новая экспедиция</h3><p>Начните с 80 RC и 2 RP. Три звена автоматизированы с самого начала. Улучшайте узкое место, чтобы получать больше.</p>
              <button type="button" className="rift-primary" disabled={busy} onClick={() => void operation(() => riftStart(status.event.id))}>Начать экспедицию</button>
            </section> : <>
              <section className="rift-card"><div className="rift-row"><span>ОБЪЕКТ {run.stageIndex + 1} / 5</span><span>{n(run.incomePerSecond)} RC/с</span></div>
                <h3>{status.stages[run.stageIndex].title}</h3>
                <progress aria-label="Цель объекта" value={Math.min(run.target, run.stageEarned)} max={run.target} />
                <p>{n(run.stageEarned)} / {n(run.target)} RC заработано на объекте. Все три звена: минимум LV {run.minLevel}.</p>
                <strong>{run.completed ? 'Экспедиция завершена!' : `Узкое место: ${run.facilities.find((f) => f.id === run.bottleneck)?.title}`}</strong>
              </section>
              <div className="rift-facilities">{run.facilities.map((facility) => <article key={facility.id} className={`rift-card ${run.bottleneck === facility.id ? 'rift-bottleneck' : ''}`}>
                <div className="rift-row"><h4>{facility.title}</h4><b>LV {facility.level}</b></div><p>{n(facility.rate)} ед/с</p>
                <div className="rift-upgrades"><button type="button" disabled={disabled || run.completed || facility.level >= facility.maxLevel || run.credits < facility.cost1} onClick={() => send('upgrade', facility.id, 1)}>+1 · {n(facility.cost1)} RC</button>
                  <button type="button" disabled={disabled || run.completed || facility.cost10 === null || run.credits < facility.cost10} onClick={() => send('upgrade', facility.id, 10)}>+10 · {facility.cost10 === null ? 'MAX' : `${n(facility.cost10)} RC`}</button></div>
              </article>)}</div>
              {!run.completed && <section className="rift-card"><p>Переход сбрасывает кредиты и уровни этого объекта. Технологии, RP, очки и полученные награды сохраняются.</p>
                {confirmation !== 'complete' ? <button type="button" className="rift-primary" disabled={disabled || !run.canComplete} onClick={() => setConfirmation('complete')}>
                  {run.stageIndex < 4 ? 'Завершить объект' : 'Завершить экспедицию'}</button> : <div className="confirmation-box" role="alert">
                  <strong>{run.stageIndex < 4 ? 'Перейти к следующему объекту?' : 'Зафиксировать результат экспедиции?'}</strong>
                  <p>{run.stageIndex < 4 ? 'Местные кредиты и уровни сбросятся. Технологии и награды останутся.' : 'Сервер начислит итоговый бонус скорости. Вернуться в эту попытку после завершения нельзя.'}</p>
                  <div><button type="button" onClick={() => setConfirmation(null)}>Отмена</button><button type="button" className="rift-primary" disabled={disabled || !run.canComplete} onClick={() => { setConfirmation(null); send('complete'); }}>Подтвердить</button></div>
                </div>}
              </section>}
              <p className="rift-muted">До {run.offlineCapHours} ч дохода между серверными синхронизациями. Начисление ограничено концом события. Время телефона не передаётся в экономику.</p>
            </>}
          </>}
          {tab === 'tree' && <><p className="rift-muted">Технологии действуют на все пять объектов только этой экспедиции. RP выдаются за этапы наград. С началом нового недельного цикла дерево сбрасывается.</p>
            <div className="rift-techs">{status.tree.map((node) => <article className="rift-card" key={node.id}><div className="rift-row"><h3>{node.title}</h3><b>{node.level}/3</b></div><p>{node.description}</p>
              {node.prerequisite && <p className="rift-muted">Требуется: {node.prerequisite}, LV 1.</p>}
              <button type="button" disabled={disabled || !node.available} onClick={() => send('research', node.id)}>{node.level >= 3 ? 'Максимальный уровень' : `Исследовать · ${node.cost} RP`}</button>
            </article>)}</div></>}
          {tab === 'rewards' && <>
            <section className="rift-card"><h3>Серверный запас экспедиции</h3><p>Эти награды хранятся отдельно от локальной игры. Они пока не расходуются в обычных шахтах — перенос будет подключён вместе с общим серверным инвентарём.</p>
              <div className="rift-wallet">{(Object.entries(status.player.wallet) as [RiftResource, number][]).map(([key, value]) => <div key={key}><small>{LABELS[key]}</small><b>{n(value)}</b></div>)}</div>
            </section>
            {status.milestones.map((milestone) => <article className="rift-card" key={milestone.id}><h3>{milestone.title}</h3><p><RewardText reward={milestone.reward} /></p><p>Технологии экспедиции: +{milestone.chips} RP</p>
              <button type="button" disabled={disabled || !milestone.reached || milestone.claimed} onClick={() => send('claim', milestone.id)}>{milestone.claimed ? 'Получено ✓' : milestone.reached ? 'Забрать награду' : 'Не выполнено'}</button>
            </article>)}
            <p className="rift-muted">Достигнутые, но не забранные награды прошлого цикла начисляются автоматически при следующем подключении. RP прошлого цикла не переносятся.</p>
          </>}
          {tab === 'board' && <>
            <section className="rift-card"><div className="rift-row"><h3>{status.board.group ?? 'Группа ещё не назначена'}</h3><b>{status.board.selfRank ? `#${status.board.selfRank}` : '—'}</b></div>
              <p>{status.board.participants}/100 участников. Показаны TOP 10 и игроки рядом с вами.</p><p className="rift-muted">Очки: улучшения и завершение объектов. За прохождение всей экспедиции — ограниченный бонус скорости. Равные очки: раньше достигнутый результат, затем ID.</p>
            </section>
            {status.board.entries.length === 0 && <div className="rift-notice">Начните экспедицию, чтобы попасть в группу. Здесь нет выдуманных соперников.</div>}
            <div className="rift-board">{status.board.entries.map((entry) => <div key={entry.playerId} className={entry.self ? 'self' : ''}>
              <b>#{entry.rank}</b><span><strong>{entry.nickname}{entry.self ? ' · Вы' : ''}</strong><small>{entry.playerId}</small></span><b>{n(entry.score)}</b>
            </div>)}</div>
            <section className="rift-card"><h3>Итоговые медали</h3><p>1-е место: 30. 2–3-е: 20. 4–10-е: 10. Остальные с ненулевым результатом: 5. Начисление — один раз после завершения цикла при подключении.</p></section>
            {status.previous && <section className="rift-card"><h3>Предыдущая экспедиция</h3><p>{status.previous.eventId} · #{status.previous.rank ?? '—'} · {n(status.previous.score)} очков</p><p>Медали рейтинга: +{status.previous.medals}. Доначислено наград: {status.previous.unclaimedPaid}.</p></section>}
          </>}
        </>}
      </div>
      <footer className="rift-footer"><span>{busy ? 'Сервер проверяет действие…' : status ? `${status.persistence === 'postgres' ? 'POSTGRESQL' : 'DEV MEMORY'} · SERVER TIME` : 'Rift: отдельная серверная экономика'}</span></footer>
    </section>
  </Dialog>;
});
