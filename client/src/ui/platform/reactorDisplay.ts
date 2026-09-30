import type { RiftReactorView } from '../../game/core/rift.js';

export function secondsRemaining(end: number, now: number): number {
  return Math.max(0, Math.ceil((end - now) / 1000));
}
// Только показ часов по серверному якорю; клиент не начисляет деньги и ядра.
export function reactorPhase(pulse: RiftReactorView['pulse'], now: number, completed = false) {
  if (completed || pulse.firstAt === null) return { active: false, seconds: 0, progress: 0 };
  if (now < pulse.firstAt) return { active: false, seconds: secondsRemaining(pulse.firstAt, now), progress: Math.max(0, 1 - (pulse.firstAt - now) / pulse.periodMs) };
  const phase = (now - pulse.firstAt) % pulse.periodMs;
  const active = phase < pulse.durationMs;
  return { active, seconds: Math.ceil((active ? pulse.durationMs - phase : pulse.periodMs - phase) / 1000),
    progress: active ? 1 - phase / pulse.durationMs : (phase - pulse.durationMs) / (pulse.periodMs - pulse.durationMs) };
}
