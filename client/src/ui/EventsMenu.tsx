import { Dialog } from './components/Dialog';
import { Icon, type IconName } from './components/Icon';
export type EventScreen = 'weekly' | 'season' | 'blitz' | 'rift';
const events: Array<{ id: EventScreen; name: string; detail: string; mode: string; icon: IconName }> = [
  { id: 'weekly', name: 'Недельный контракт', detail: 'Отдельная шахта и награды за развитие производства.', mode: 'Weekly Contract', icon: 'mine' },
  { id: 'season', name: 'Сезонная кампания', detail: 'Опыт за контракты и 20 уровней сезонных наград.', mode: 'Seasonal Campaign', icon: 'diamond' },
  { id: 'blitz', name: 'Blitz Drill', detail: 'Развивайте цепочку за 10 минут и соревнуйтесь в своей лиге.', mode: 'Нужен сервер', icon: 'trophy' },
  { id: 'rift', name: 'Rift Expedition', detail: 'Пять объектов, технологии и отдельный рейтинг экспедиции.', mode: 'Нужен сервер', icon: 'bolt' },
];
export function EventsMenu({ onSelect, onClose }: { onSelect: (screen: EventScreen) => void; onClose: () => void }) {
  return <Dialog label="События" onClose={onClose} className="events-dialog">
    <section className="events-menu">
      <header className="panel-header"><div><span className="eyebrow">DEEPFORGE / АКТИВНОСТИ</span><h2>События</h2></div>
        <button type="button" className="icon-button" data-dialog-initial onClick={onClose} aria-label="Закрыть события"><Icon name="close" /></button></header>
      <div className="panel-scroll"><p className="panel-intro">Выберите режим. Прогресс основных шахт сохраняется при переходе.</p>
        <div className="events-options">{events.map((event) => <button key={event.id} type="button" onClick={() => onSelect(event.id)}>
          <span className="event-icon"><Icon name={event.icon} size={24} /></span>
          <span className="event-copy"><small>{event.mode}</small><strong>{event.name}</strong><span>{event.detail}</span></span>
          <Icon name="chevron" size={18} />
        </button>)}</div>
        <p className="panel-note">Blitz и Rift требуют подключения к backend. Без него можно прочитать описание режима, но онлайн-рейтинг недоступен.</p>
      </div>
    </section>
  </Dialog>;
}
