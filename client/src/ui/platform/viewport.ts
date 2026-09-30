/** Дополнение dvh для экранной клавиатуры: только при масштабе 1, zoom не ломаем. */
export function installViewportSync(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  let frame = 0;
  let last = '';
  const sync = () => {
    frame = 0;
    if (Math.abs(viewport.scale - 1) > 0.02) return;
    const height = `${Math.round(viewport.height)}px`;
    if (height === last) return;
    last = height;
    document.documentElement.style.setProperty('--visible-height', height);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
  sync();
  viewport.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  return () => {
    cancelAnimationFrame(frame);
    viewport.removeEventListener('resize', schedule);
    window.removeEventListener('pageshow', schedule);
    document.documentElement.style.removeProperty('--visible-height');
  };
}
