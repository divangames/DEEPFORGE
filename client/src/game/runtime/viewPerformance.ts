// Остановка только визуальных обновлений под непрозрачным окном. Экономика продолжает tick.
let overlays = 0;
export function coverGameScene(): () => void {
  overlays += 1;
  let released = false;
  return () => { if (!released) { released = true; overlays = Math.max(0, overlays - 1); } };
}
export function isGameSceneCovered(): boolean { return overlays > 0; }
