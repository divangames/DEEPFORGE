import { memo } from 'react';
import type { RiftAction, RiftFacility, RiftReactorView, RiftSlot } from '../game/core/rift';
import { Icon } from './components/Icon';
import { reactorPhase, secondsRemaining } from './platform/reactorDisplay';

const ROLES: Record<RiftFacility | 'all', string> = { extraction: 'Добыча', lift: 'Лифт', logistics: 'Логистика', all: 'Все звенья' };
const UPGRADE_TEXT = {
  slots: { title: 'Команда реактора', text: 'До трёх специалистов одновременно. Один специалист и одна специализация не могут занимать два слота.' },
  range: { title: 'Охват импульса', text: 'Добыча → добыча и лифт → вся цепочка. Усиливайте охват, когда импульс упирается в следующее звено.' },
  power: { title: 'Мощность', text: 'Множитель импульса: ×2 → ×3 → ×4 → ×5. Действует только на звенья в зоне охвата.' },
} as const;

export const RiftReactor = memo(function RiftReactor({ reactor, legacy, outdated, completed, disabled, now, onAction }: {
  reactor: RiftReactorView | null; legacy: boolean; outdated: boolean; completed: boolean; disabled: boolean; now: number;
  onAction: (kind: RiftAction['kind'], target?: string, count?: 1 | 10, slot?: RiftSlot) => void;
}) {
  if (outdated) return <section className="rift-notice"><h3>Нужно обновить сервер</h3><p>Reactor Grid требует backend Stage 17. Сейчас отвечает более ранняя версия. Публикация только GitHub Pages не обновляет backend.</p></section>;
  if (legacy) return <section className="rift-card"><h3>Эта экспедиция начата по старым правилам</h3><p>Её прогресс, технологии, награды и рейтинг сохранены. Реактор появится в следующем недельном цикле. Текущую попытку сбрасывать не нужно.</p><p className="rift-muted">Новые экспедиции Stage 17 соревнуются отдельно, в группах R2. Участники старой группы не получают преимущество от обновления посреди цикла.</p></section>;
  if (!reactor || !reactor.unlocked) return <section className="rift-card reactor-locked"><Icon name="lock" size={28} /><h3>Реактор откроется на объекте 2</h3><p>Завершите «Врата разлома». Назначайте специалистов, активируйте их навыки и получайте ядра для улучшений реактора.</p><p className="rift-muted">Импульс длится 12 секунд каждые 60 секунд. Его охват и мощность можно улучшать. Это часть Rift, не отдельная валюта обычных шахт.</p></section>;
  const phase = reactorPhase(reactor.pulse, now, completed);
  return <div className="reactor-grid">
    <section className={`rift-card reactor-hero ${phase.active ? 'is-pulsing' : ''}`} aria-labelledby="reactor-heading">
      <div className="reactor-topline"><div className="reactor-mark" aria-hidden="true"><Icon name="bolt" size={30} /></div>
        <div><span className="reactor-eyebrow">REACTOR GRID</span><h3 id="reactor-heading">{completed ? 'Экспедиция завершена' : phase.active ? 'Импульс работает' : 'Реактор заряжается'}</h3></div>
        <div className="reactor-core-balance"><small>Ядра реактора</small><strong>{reactor.cores}</strong></div></div>
      <div className="reactor-readout"><span>{completed ? 'Новые активации закрыты' : phase.active ? `Импульс: ещё ${phase.seconds} с` : `До импульса: ${phase.seconds} с`}</span><strong>×{reactor.multiplier} · 12 с</strong></div>
      <progress aria-label={phase.active ? 'Оставшаяся длительность импульса' : 'Заряд до следующего импульса'} max={1} value={phase.progress} />
      <div className="reactor-coverage" aria-label="Охват реактора">{(['extraction', 'lift', 'logistics'] as const).map((id, i) => <div key={id} className={reactor.coverage.includes(id) ? 'covered' : ''}><b>{i + 1}</b><span>{ROLES[id]}</span><small>{reactor.coverage.includes(id) ? `×${reactor.multiplier}` : 'Вне охвата'}</small></div>)}</div>
      <p className="rift-muted">Импульс: каждые 60 с, в том числе офлайн. Навыки специалистов запускаются вручную.</p>
    </section>

    <section aria-labelledby="reactor-team-heading"><div className="reactor-section-heading"><h3 id="reactor-team-heading">Команда реактора</h3><small>{reactor.capacity} из 3 слотов</small></div>
      <p className="rift-muted">Активация навыка усиливает производство и даёт ядра. Для рейтинга у всех одинаковый отряд: уровни и экипировка из локальных шахт здесь не используются.</p>
      <div className="reactor-slots">{reactor.slots.slice(0, reactor.capacity).map((id, index) => {
        const slot = index as RiftSlot, current = reactor.operators.find(o => o.id === id);
        const activeSeconds = current ? secondsRemaining(current.activeUntil, now) : 0;
        const cooldownSeconds = current ? secondsRemaining(current.readyAt, now) : 0;
        return <article key={index} className="rift-card reactor-slot"><div className="rift-row"><h4>Слот {index + 1}</h4><span>{current ? ROLES[current.role] : 'Свободен'}</span></div>
          <label htmlFor={`reactor-slot-${index}`} className="reactor-select-label">Специалист</label>
          <select id={`reactor-slot-${index}`} value={id ?? 'none'} disabled={disabled || completed || activeSeconds > 0}
            onChange={event => onAction('operator-assign', event.currentTarget.value, undefined, slot)}>
            <option value="none">Не назначен</option>
            {reactor.operators.map(o => {
              const occupied = o.assignedSlot !== null && o.assignedSlot !== index;
              const sameRole = reactor.operators.some(other => other.role === o.role && other.assignedSlot !== null && other.assignedSlot !== index);
              return <option key={o.id} value={o.id} disabled={!o.available || occupied || sameRole}>{o.name} · {ROLES[o.role]}{!o.available ? ` · с объекта ${o.unlockStage}` : occupied ? ' · занят' : sameRole ? ' · роль занята' : ''}</option>;
            })}
          </select>
          {current ? <><p className="reactor-skill-copy">×{current.multiplier} на {current.durationMs / 1000} с · +{current.cores} {current.cores === 1 ? 'ядро' : 'ядра'} за активацию</p>
            <button type="button" className="rift-primary" disabled={disabled || completed || cooldownSeconds > 0} onClick={() => onAction('operator-activate', current.id)}>
              {completed ? 'Завершено' : activeSeconds > 0 ? `Навык активен · ${activeSeconds} с` : cooldownSeconds > 0 ? `Перезарядка · ${cooldownSeconds} с` : 'Активировать навык'}</button>
            <small className="reactor-slot-note">{activeSeconds > 0 ? 'Сменить специалиста можно после окончания навыка.' : `Перезарядка ${current.cooldownMs / 1000} с. Замена не сбрасывает таймер.`}</small></> : <p className="reactor-slot-note">Выберите специалиста, чтобы получить первое ядро.</p>}
        </article>;
      })}</div>
    </section>

    <section aria-labelledby="reactor-upgrades-heading"><div className="reactor-section-heading"><h3 id="reactor-upgrades-heading">Улучшения</h3><small>Получено ядер: {reactor.earnedCores}</small></div>
      <div className="reactor-upgrades">{reactor.upgrades.map(upgrade => <article className="rift-card" key={upgrade.id}>
        <div className="rift-row"><h4>{UPGRADE_TEXT[upgrade.id].title}</h4><b>{upgrade.level}/{upgrade.maxLevel}</b></div><p>{UPGRADE_TEXT[upgrade.id].text}</p>
        <button type="button" disabled={disabled || completed || !upgrade.available} onClick={() => onAction('reactor-upgrade', upgrade.id)}>{upgrade.cost === null ? 'Максимум' : `Улучшить · ${upgrade.cost} ${upgrade.cost === 1 ? 'ядро' : upgrade.cost < 5 ? 'ядра' : 'ядер'}`}</button>
      </article>)}</div>
    </section>
    <details className="rift-card reactor-rules"><summary>Что сохраняется и как считается доход</summary><p>Ядра, улучшения реактора, назначения и личные таймеры сохраняются между объектами одной экспедиции. В новом недельном цикле Reactor Grid начинается заново.</p><p>Охват относится к трём звеньям текущего объекта. Усиление одного звена не обходит узкое место. Импульс и активный навык перемножаются только на своих звеньях. Очки не выдаются за нажатие навыка или импульс — только по правилам Rift.</p></details>
  </div>;
});
