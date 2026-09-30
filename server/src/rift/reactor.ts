import type { RiftRun } from './engine.js';
import { RiftError } from './errors.js';
import type { RiftFacility, RiftOperatorId, RiftReactorUpgrade, RiftReactorView, RiftSlot } from './protocol.js';

export const REACTOR_PERIOD_MS = 60_000;
export const REACTOR_PULSE_MS = 12_000;
export const REACTOR_TARGETS: readonly RiftFacility[] = ['extraction', 'lift', 'logistics'];
export const REACTOR_UPGRADES: readonly RiftReactorUpgrade[] = ['slots', 'range', 'power'];
export const REACTOR_COSTS: Record<RiftReactorUpgrade, readonly number[]> = {
  slots: [3, 7], range: [2, 5], power: [2, 4, 7],
};
export const RIFT_OPERATORS: readonly {
  id: RiftOperatorId; name: string; role: RiftFacility | 'all'; stage: number;
  multiplier: number; durationMs: number; cooldownMs: number; cores: number;
}[] = [
  { id: 'rook', name: 'Rook Hale', role: 'extraction', stage: 1, multiplier: 2, durationMs: 20_000, cooldownMs: 60_000, cores: 1 },
  { id: 'ion', name: 'Ion Reyes', role: 'lift', stage: 1, multiplier: 2.5, durationMs: 20_000, cooldownMs: 75_000, cores: 1 },
  { id: 'talia', name: 'Talia Cruz', role: 'logistics', stage: 1, multiplier: 2.5, durationMs: 20_000, cooldownMs: 75_000, cores: 1 },
  { id: 'mara', name: 'Mara Vex', role: 'extraction', stage: 2, multiplier: 3, durationMs: 15_000, cooldownMs: 90_000, cores: 2 },
  { id: 'kael', name: 'Kael Soren', role: 'logistics', stage: 3, multiplier: 4, durationMs: 12_000, cooldownMs: 100_000, cores: 2 },
  { id: 'sera', name: 'Sera Knox', role: 'all', stage: 4, multiplier: 1.75, durationMs: 15_000, cooldownMs: 120_000, cores: 2 },
];
export interface RiftReactorState {
  unlockedAt: number | null;
  cores: number;
  earnedCores: number;
  upgrades: Record<RiftReactorUpgrade, number>;
  slots: (RiftOperatorId | null)[];
  operators: Record<RiftOperatorId, { activeUntil: number; readyAt: number; uses: number }>;
}
export function createReactor(): RiftReactorState {
  return { unlockedAt: null, cores: 0, earnedCores: 0,
    upgrades: { slots: 0, range: 0, power: 0 }, slots: [null, null, null],
    operators: Object.fromEntries(RIFT_OPERATORS.map(o => [o.id, { activeUntil: 0, readyAt: 0, uses: 0 }])) as RiftReactorState['operators'] };
}
// Старые попытки не мигрируют в новые правила посреди соревнования.
export function unlockReactor(run: RiftRun, now: number): void {
  if (run.rulesVersion < 2) return;
  run.reactor ??= createReactor();
  if (run.stageIndex >= 1 && run.reactor.unlockedAt === null) run.reactor.unlockedAt = now;
}
export function hasReactor(run: RiftRun): boolean { return run.rulesVersion >= 2 && run.reactor?.unlockedAt != null; }
export function reactorCoverage(run: RiftRun): readonly RiftFacility[] {
  return hasReactor(run) ? REACTOR_TARGETS.slice(0, 1 + run.reactor!.upgrades.range) : [];
}
export function pulseAt(run: RiftRun, now: number): boolean {
  if (!hasReactor(run) || run.completedAt !== null || now >= run.event.endsAt) return false;
  const first = run.reactor!.unlockedAt! + REACTOR_PERIOD_MS;
  return now >= first && (now - first) % REACTOR_PERIOD_MS < REACTOR_PULSE_MS;
}
// Интеграл периодических окон. O(1) даже после нескольких часов вне игры.
export function pulseMilliseconds(run: RiftRun, from: number, to: number): number {
  if (!hasReactor(run) || to <= from) return 0;
  const first = run.reactor!.unlockedAt! + REACTOR_PERIOD_MS;
  const integral = (at: number) => {
    const elapsed = Math.max(0, at - first);
    return Math.floor(elapsed / REACTOR_PERIOD_MS) * REACTOR_PULSE_MS + Math.min(elapsed % REACTOR_PERIOD_MS, REACTOR_PULSE_MS);
  };
  return Math.max(0, integral(Math.min(to, run.event.endsAt)) - integral(Math.min(from, run.event.endsAt)));
}
export function operatorMultiplier(run: RiftRun, facility: RiftFacility, now: number): number {
  if (!hasReactor(run)) return 1;
  let multiplier = 1;
  const state = run.reactor!;
  for (const id of state.slots.slice(0, state.upgrades.slots + 1)) {
    if (!id || state.operators[id].activeUntil <= now) continue;
    const operator = RIFT_OPERATORS.find(o => o.id === id)!;
    if (operator.role === 'all' || operator.role === facility) multiplier *= operator.multiplier;
  }
  return multiplier;
}
export function operatorBoundaries(run: RiftRun, from: number, to: number): number[] {
  if (!hasReactor(run)) return [from, to];
  return [...new Set([from, to, ...run.reactor!.slots.flatMap(id => {
    const end = id ? run.reactor!.operators[id].activeUntil : 0;
    return end > from && end < to ? [end] : [];
  })])].sort((a, b) => a - b);
}
function editable(run: RiftRun) {
  if (run.rulesVersion < 2) throw new RiftError('LEGACY_REACTOR');
  if (run.completedAt !== null) throw new RiftError('RUN_COMPLETE');
  if (!hasReactor(run)) throw new RiftError('REACTOR_LOCKED');
  return run.reactor!;
}
export function upgradeReactor(run: RiftRun, target: string | undefined): void {
  const state = editable(run);
  if (!REACTOR_UPGRADES.some(id => id === target)) throw new RiftError('INVALID_ACTION', 400);
  const id = target as RiftReactorUpgrade, costs = REACTOR_COSTS[id], level = state.upgrades[id];
  if (level >= costs.length) throw new RiftError('MAX_LEVEL');
  if (state.cores < costs[level]) throw new RiftError('NOT_ENOUGH_REACTOR_CORES');
  state.cores -= costs[level]; state.upgrades[id] += 1;
}
export function assignOperator(run: RiftRun, target: string | undefined, slot: RiftSlot | undefined, now: number): void {
  const state = editable(run);
  if (!Number.isInteger(slot) || slot! < 0 || slot! > 2) throw new RiftError('INVALID_ACTION', 400);
  if (slot! >= 1 + state.upgrades.slots) throw new RiftError('SLOT_LOCKED');
  const id = target === 'none' ? null : RIFT_OPERATORS.find(o => o.id === target)?.id;
  if (id === undefined) throw new RiftError('INVALID_ACTION', 400);
  const current = state.slots[slot!];
  if (current === id) throw new RiftError('ASSIGNMENT_UNCHANGED');
  if (current && state.operators[current].activeUntil > now) throw new RiftError('OPERATOR_BUSY');
  if (id) {
    const operator = RIFT_OPERATORS.find(o => o.id === id)!;
    if (run.stageIndex < operator.stage) throw new RiftError('OPERATOR_LOCKED');
    if (state.slots.includes(id)) throw new RiftError('OPERATOR_ASSIGNED');
    const others = state.slots.filter((_, index) => index !== slot);
    if (others.some(other => other && RIFT_OPERATORS.find(o => o.id === other)!.role === operator.role)) throw new RiftError('ROLE_OCCUPIED');
  }
  state.slots[slot!] = id;
  // Личный cooldown остаётся в operators даже после снятия/переназначения.
}
export function activateOperator(run: RiftRun, target: string | undefined, now: number): void {
  const state = editable(run), operator = RIFT_OPERATORS.find(o => o.id === target);
  if (!operator) throw new RiftError('INVALID_ACTION', 400);
  if (run.stageIndex < operator.stage) throw new RiftError('OPERATOR_LOCKED');
  if (!state.slots.slice(0, state.upgrades.slots + 1).includes(operator.id)) throw new RiftError('OPERATOR_NOT_ASSIGNED');
  const personal = state.operators[operator.id];
  if (now < personal.readyAt) throw new RiftError('OPERATOR_COOLDOWN');
  personal.activeUntil = now + operator.durationMs;
  personal.readyAt = now + operator.cooldownMs;
  personal.uses += 1;
  state.cores += operator.cores; state.earnedCores += operator.cores;
}
export function reactorView(run: RiftRun | null, now: number): RiftReactorView | null {
  if (!run || run.rulesVersion < 2) return null;
  const state = run.reactor ?? createReactor(), unlocked = state.unlockedAt !== null;
  const active = pulseAt(run, now);
  const first = (state.unlockedAt ?? now) + REACTOR_PERIOD_MS;
  const next = !unlocked ? null : now < first ? first : first + (Math.floor((now - first) / REACTOR_PERIOD_MS) + 1) * REACTOR_PERIOD_MS;
  return {
    unlocked, unlockStage: 2, cores: state.cores, earnedCores: state.earnedCores, slots: state.slots.slice(), capacity: 1 + state.upgrades.slots,
    coverage: [...reactorCoverage(run)], multiplier: 2 + state.upgrades.power,
    pulse: { active, firstAt: unlocked ? first : null, durationMs: REACTOR_PULSE_MS, periodMs: REACTOR_PERIOD_MS,
      nextAt: next, endsAt: active ? first + Math.floor((now - first) / REACTOR_PERIOD_MS) * REACTOR_PERIOD_MS + REACTOR_PULSE_MS : null },
    upgrades: REACTOR_UPGRADES.map(id => ({ id, level: state.upgrades[id], maxLevel: REACTOR_COSTS[id].length,
      cost: REACTOR_COSTS[id][state.upgrades[id]] ?? null,
      available: unlocked && run.completedAt === null && now < run.event.endsAt && state.upgrades[id] < REACTOR_COSTS[id].length && state.cores >= REACTOR_COSTS[id][state.upgrades[id]] })),
    operators: RIFT_OPERATORS.map(o => ({ ...o, unlockStage: o.stage + 1, available: unlocked && run.stageIndex >= o.stage,
      assignedSlot: state.slots.includes(o.id) ? state.slots.indexOf(o.id) : null,
      ...state.operators[o.id] })),
  };
}
