import { useEffect, useRef } from 'react';
import { handleTabKey } from '../platform/dialogController';

export function Tabs<T extends string>({ id, label, value, onChange, options, className = '' }: {
  id: string; label: string; value: T; onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const key = (event: KeyboardEvent) => handleTabKey(event, element);
    element.addEventListener('keydown', key);
    return () => element.removeEventListener('keydown', key);
  }, []);
  return <div className={`ui-tabs ${className}`} role="tablist" aria-label={label} ref={ref}>
    {options.map((option) => <button type="button" key={option.value} role="tab"
      id={`${id}-${option.value}`} aria-controls={`${id}-panel`} aria-selected={value === option.value}
      tabIndex={value === option.value ? 0 : -1} className={value === option.value ? 'active' : ''}
      onClick={(event) => { onChange(option.value); event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); }}>
      {option.label}
    </button>)}
  </div>;
}
