import { useEffect, useRef, type ReactNode } from 'react';
import { coverGameScene } from '../../game/runtime/viewPerformance';
import { mountDialog } from '../platform/dialogController';

export function Dialog({ label, onClose, className = '', children }: {
  label: string; onClose: () => void; className?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const unmount = mountDialog(ref.current);
    const uncover = coverGameScene();
    return () => { unmount(); uncover(); };
  }, []);
  return <dialog ref={ref} className={`ui-dialog ${className}`} aria-label={label}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { downOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => { if (downOnBackdrop.current && event.target === event.currentTarget) onClose(); downOnBackdrop.current = false; }}>
    {children}
  </dialog>;
}
