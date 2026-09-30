let navigationTrigger: HTMLElement | null = null;

/** Нативный modal: браузер обеспечивает inert и удерживает Tab внутри окна. */
export function mountDialog(element: HTMLDialogElement): () => void {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (active && active !== document.body && !active.closest('dialog')) navigationTrigger = active;
  const previousFocus = active && active !== document.body ? active : navigationTrigger;
  const trapTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(element.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
      .filter((node) => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[hidden], [inert]') && node.getClientRects().length > 0);
    if (focusable.length === 0) { event.preventDefault(); element.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
      event.preventDefault(); last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus({ preventScroll: true });
    }
  };
  element.addEventListener('keydown', trapTab);
  if (!element.open) element.showModal();
  // Начальный фокус не попадает в поле ввода и не открывает клавиатуру iOS.
  element.querySelector<HTMLElement>('[data-dialog-initial]')?.focus({ preventScroll: true });
  return () => {
    element.removeEventListener('keydown', trapTab);
    if (element.open) element.close();
    queueMicrotask(() => {
      // События → Rift: не вырываем фокус из следующего окна и не теряем кнопку навигации.
      if (document.querySelector('dialog[open]')) return;
      const target = previousFocus?.isConnected && !previousFocus.closest('dialog') ? previousFocus : navigationTrigger;
      if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
    });
  };
}

/** Стандартное управление вкладками, без анимации клавиатурных действий. */
export function handleTabKey(event: KeyboardEvent, tabs: HTMLElement): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
  const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  if (!buttons.length || current < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
    (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus({ preventScroll: true });
  buttons[next].click();
  buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
}
