import { useEffect, useRef } from 'react';
import './rift.css';
export type EventScreen = 'weekly' | 'season' | 'blitz' | 'rift';
export function EventsMenu({ onSelect, onClose }: { onSelect: (screen: EventScreen) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => { dialog.current?.close(); };
  }, []);
  return <dialog ref={dialog} className="rift-dialog events-dialog" aria-labelledby="events-title" onCancel={(e) => { e.preventDefault(); onClose(); }}>
    <section className="events-menu"><header className="rift-header"><h2 id="events-title">События</h2><button type="button" className="rift-close" onClick={onClose} aria-label="Закрыть события">✕</button></header>
      <div className="events-options">
        <button type="button" onClick={() => onSelect('weekly')}><strong>Weekly Contract</strong><span>Недельный контракт · своя валюта · milestones</span></button>
        <button type="button" onClick={() => onSelect('season')}><strong>Seasonal Campaign</strong><span>Сезонный опыт и дорожка наград</span></button>
        <button type="button" onClick={() => onSelect('blitz')}><strong>Blitz Drill</strong><span>10-минутные забеги · нужен сервер</span></button>
        <button type="button" onClick={() => onSelect('rift')}><strong>Rift Expedition · новое</strong><span>5 объектов · технологии · серверный рейтинг</span></button>
      </div>
    </section>
  </dialog>;
}
