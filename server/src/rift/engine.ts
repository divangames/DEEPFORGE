import type { RiftAction, RiftEvent, RiftFacility, RiftMilestoneView, RiftResource, RiftStage, RiftTech, RiftTechView, RiftWallet } from './protocol.js';

import { RiftError } from './errors.js';
export { RiftError } from './errors.js';
import { createReactor, unlockReactor, operatorMultiplier, operatorBoundaries, pulseAt, pulseMilliseconds, reactorCoverage, upgradeReactor, assignOperator, activateOperator, type RiftReactorState } from './reactor.js';

export const RIFT_RULES_VERSION = 2;
export const WEEK_MS = 7 * 86400_000;
export const MAX_LEVEL = 50;
export const RIFT_FACILITIES: RiftFacility[] = ['extraction', 'lift', 'logistics'];
export const FACILITY_LABELS: Record<RiftFacility, string> = { extraction: 'Добыча', lift: 'Грузовой лифт', logistics: 'Логистика' };
export const RIFT_STAGES: RiftStage[] = [
  { id: 'gate', title: 'Врата разлома', target: 1200, minLevel: 5, yield: 1, costScale: 1 },
  { id: 'prism', title: 'Призматическая пещера', target: 5000, minLevel: 8, yield: 2.5, costScale: 2 },
  { id: 'foundry', title: 'Кузница разлома', target: 22000, minLevel: 12, yield: 6, costScale: 4 },
  { id: 'relay', title: 'Обсидиановый узел', target: 90000, minLevel: 16, yield: 14, costScale: 8 },
  { id: 'core', title: 'Хранилище ядра', target: 360000, minLevel: 20, yield: 32, costScale: 16 },
];
export const TECHS: { id: RiftTech; title: string; description: string; prerequisite: RiftTech | null }[] = [
  { id: 'drills', title: 'Резонансные буры', description: '+12% добычи за уровень', prerequisite: null },
  { id: 'refining', title: 'Чистое сырьё', description: '+8% цены сырья за уровень', prerequisite: 'drills' },
  { id: 'cables', title: 'Силовые тросы', description: '+15% пропускной способности лифта за уровень', prerequisite: null },
  { id: 'dispatch', title: 'Диспетчеризация', description: '+15% логистики за уровень', prerequisite: 'cables' },
  { id: 'efficiency', title: 'Бережливая сборка', description: '−5% стоимости улучшений за уровень', prerequisite: null },
  { id: 'storage', title: 'Резервные склады', description: '+1 час фонового дохода за уровень (4–7 ч)', prerequisite: 'efficiency' },
];

export interface RiftRun {
  rulesVersion: number;
  reactor?: RiftReactorState;
  event: RiftEvent;
  group: string;
  revision: number;
  stageIndex: number;
  credits: number;
  stageEarned: number;
  levels: Record<RiftFacility, number>;
  tech: Record<RiftTech, number>;
  chips: number;
  score: number;
  scoreReachedAt: number;
  startedAt: number;
  checkpoint: number;
  completedAt: number | null;
  reached: string[];
  claimed: string[];
  receipts: { id: string; payload: string }[];
}
export function eventAt(now: number): RiftEvent {
  const anchor = Date.UTC(1970, 0, 5);
  const startsAt = anchor + Math.floor((now - anchor) / WEEK_MS) * WEEK_MS;
  return { id: `rift-${new Date(startsAt).toISOString().slice(0, 10)}`, title: 'Rift Expedition', startsAt, endsAt: startsAt + WEEK_MS };
}
export function emptyWallet(): RiftWallet {
  return { cores: 0, recruitData: 0, trainingModules: 0, promotionBadges: 0, supplyKeys: 0, alloy: 0, circuits: 0, fiber: 0, medals: 0 };
}
export function createRun(now: number, group: string, rulesVersion = RIFT_RULES_VERSION): RiftRun {
  return {
    rulesVersion, ...(rulesVersion >= 2 ? { reactor: createReactor() } : {}), event: eventAt(now), group, revision: 0,
    stageIndex: 0, credits: 80, stageEarned: 0,
    levels: { extraction: 1, lift: 1, logistics: 1 },
    tech: { drills: 0, refining: 0, cables: 0, dispatch: 0, efficiency: 0, storage: 0 },
    chips: 2, score: 0, scoreReachedAt: now, startedAt: now, checkpoint: now,
    completedAt: null, reached: [], claimed: [], receipts: [],
  };
}
export function stageOf(run: RiftRun): RiftStage { return RIFT_STAGES[run.stageIndex]; }
export function ratesOf(run: RiftRun, at = run.checkpoint, withPulse = pulseAt(run, at)): Record<RiftFacility, number> {
  const base = { extraction: 4, lift: 3, logistics: 3.5 };
  const bonuses = { extraction: 1 + run.tech.drills * .12, lift: 1 + run.tech.cables * .15, logistics: 1 + run.tech.dispatch * .15 };
  return Object.fromEntries(RIFT_FACILITIES.map((id) => [id, base[id] * stageOf(run).yield * Math.pow(1.16, run.levels[id] - 1) * bonuses[id] * operatorMultiplier(run, id, at) * (withPulse && reactorCoverage(run).includes(id) ? 2 + (run.reactor?.upgrades.power ?? 0) : 1)])) as Record<RiftFacility, number>;
}
export function flowOf(run: RiftRun, at = run.checkpoint, withPulse = pulseAt(run, at)) {
  const rates = ratesOf(run, at, withPulse);
  const bottleneck = RIFT_FACILITIES.reduce((a, b) => rates[a] <= rates[b] ? a : b);
  return { rates, bottleneck, income: run.completedAt !== null ? 0 : rates[bottleneck] * (1 + run.tech.refining * .08) };
}
// Буферный предел относится к периоду без серверного checkpoint, а не к каждому кадру.
export function advanceRun(run: RiftRun, now: number): void {
  if (!Number.isFinite(now)) throw new RiftError('INVALID_TIME', 400);
  const until = Math.min(now, run.event.endsAt);
  if (until <= run.checkpoint) return;
  const elapsed = Math.min(until - run.checkpoint, (4 + run.tech.storage) * 3600_000);
  let earned = 0;
  // Способностей максимум три. Разбиваем только на их окончания, не на каждый тик.
  const boundaries = operatorBoundaries(run, run.checkpoint, run.checkpoint + elapsed);
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i], to = boundaries[i + 1];
    const baseIncome = flowOf(run, from, false).income;
    const pulseIncome = flowOf(run, from, true).income;
    const activeMs = pulseMilliseconds(run, from, to);
    earned += (baseIncome * (to - from) + (pulseIncome - baseIncome) * activeMs) / 1000;
  }
  run.credits += earned;
  run.stageEarned += earned;
  run.checkpoint = until;
  markHalf(run);
}
function markHalf(run: RiftRun) {
  const id = `${stageOf(run).id}-half`;
  if (run.stageEarned >= stageOf(run).target / 2 && !run.reached.includes(id)) run.reached.push(id);
}
export function costOf(run: RiftRun, facility: RiftFacility, count: 1 | 10): number {
  if (run.levels[facility] + count > MAX_LEVEL) return Infinity;
  const base = facility === 'extraction' ? 22 : facility === 'lift' ? 18 : 20;
  // Геометрическая сумма; без цикла по сотням покупок, округление только итоговой цены.
  return Math.ceil(base * stageOf(run).costScale * Math.pow(1.15, run.levels[facility] - 1) * ((Math.pow(1.15, count) - 1) / .15) * (1 - run.tech.efficiency * .05));
}
export function canComplete(run: RiftRun): boolean {
  return run.completedAt === null && run.stageEarned >= stageOf(run).target && RIFT_FACILITIES.every((f) => run.levels[f] >= stageOf(run).minLevel);
}
export function treeView(run: RiftRun | null): RiftTechView[] {
  return TECHS.map((t) => {
    const level = run?.tech[t.id] ?? 0;
    const prerequisite = t.prerequisite ? TECHS.find((entry) => entry.id === t.prerequisite)!.title : null;
    return { ...t, prerequisite, level, maxLevel: 3, cost: level + 1,
      available: Boolean(run && run.completedAt === null && level < 3 && (!t.prerequisite || run.tech[t.prerequisite] >= 1) && run.chips >= level + 1) };
  });
}
export function milestoneView(run: RiftRun | null): RiftMilestoneView[] {
  return RIFT_STAGES.flatMap((stage, i) => [
    { id: `${stage.id}-half`, title: `${i + 1}. ${stage.title}: 50%`, chips: 2,
      reward: { alloy: 12 * (i + 1), trainingModules: 10 * (i + 1), recruitData: 15 * (i + 1) } },
    { id: `${stage.id}-complete`, title: `${i + 1}. ${stage.title}: завершение`, chips: 4,
      reward: { cores: i + 1, supplyKeys: 1, circuits: 6 * (i + 1), fiber: 8 * (i + 1), promotionBadges: i + 1, medals: 3 * (i + 1) } },
  ]).map((m) => ({ ...m, reached: run?.reached.includes(m.id) ?? false, claimed: run?.claimed.includes(m.id) ?? false }));
}
export function creditWallet(wallet: RiftWallet, reward: Partial<RiftWallet>): void {
  for (const key of Object.keys(reward) as RiftResource[]) wallet[key] += reward[key] ?? 0;
}
function claim(run: RiftRun, wallet: RiftWallet, id: string) {
  const reward = milestoneView(run).find((m) => m.id === id);
  if (!reward || !reward.reached) throw new RiftError('MILESTONE_LOCKED');
  if (reward.claimed) throw new RiftError('ALREADY_CLAIMED');
  run.claimed.push(id);
  run.chips += reward.chips;
  creditWallet(wallet, reward.reward);
}
// Применяется к копии внутри транзакции. Ошибка не должна частично сохранять состояние.
export function applyAction(run: RiftRun, wallet: RiftWallet, action: RiftAction, now: number): void {
  // Старые receipts сохраняют формат: добавляем slot только у новых assign-действий.
  const payload = JSON.stringify([action.eventId, action.revision, action.kind, action.target ?? null, action.count ?? null,
    ...(action.slot === undefined ? [] : [action.slot])]);
  const receipt = run.receipts.find((r) => r.id === action.requestId);
  if (receipt) {
    if (receipt.payload !== payload) throw new RiftError('REQUEST_ID_REUSED');
    return;
  }
  if (action.eventId !== run.event.id || now >= run.event.endsAt) throw new RiftError('EVENT_CLOSED');
  if (now < run.checkpoint) throw new RiftError('CLOCK_ROLLBACK');
  if (action.revision !== run.revision) throw new RiftError('STALE_REVISION');
  advanceRun(run, now);
  if (action.kind === 'claim') {
    claim(run, wallet, action.target ?? '');
  } else {
    if (run.completedAt !== null) throw new RiftError('RUN_COMPLETE');
    if (action.kind === 'upgrade') {
      const target = action.target as RiftFacility;
      if (!RIFT_FACILITIES.includes(target) || (action.count !== 1 && action.count !== 10)) throw new RiftError('INVALID_ACTION', 400);
      const cost = costOf(run, target, action.count);
      if (!Number.isFinite(cost)) throw new RiftError('MAX_LEVEL');
      if (run.credits < cost) throw new RiftError('NOT_ENOUGH_CREDITS');
      run.credits -= cost;
      run.levels[target] += action.count;
      run.score += 10 * action.count * (run.stageIndex + 1);
      run.scoreReachedAt = now;
    } else if (action.kind === 'research') {
      const entry = treeView(run).find((t) => t.id === action.target);
      if (!entry?.available) throw new RiftError('RESEARCH_LOCKED');
      run.chips -= entry.cost;
      run.tech[entry.id] += 1;
    } else if (action.kind === 'reactor-upgrade') {
      upgradeReactor(run, action.target);
    } else if (action.kind === 'operator-assign') {
      assignOperator(run, action.target, action.slot, now);
    } else if (action.kind === 'operator-activate') {
      activateOperator(run, action.target, now);
    } else if (action.kind === 'complete') {
      if (!canComplete(run)) throw new RiftError('STAGE_NOT_READY');
      run.reached.push(`${stageOf(run).id}-complete`);
      run.score += 1000 * (run.stageIndex + 1);
      run.scoreReachedAt = now;
      if (run.stageIndex === RIFT_STAGES.length - 1) {
        run.completedAt = now;
        // Ограниченный бонус скорости выдаётся только один раз за всю экспедицию.
        run.score += Math.floor(3000 / (1 + Math.max(0, now - run.startedAt) / 3600_000));
      } else {
        run.stageIndex += 1;
        run.credits = 80 * stageOf(run).costScale;
        run.stageEarned = 0;
        run.levels = { extraction: 1, lift: 1, logistics: 1 };
        unlockReactor(run, now);
      }
    } else throw new RiftError('INVALID_ACTION', 400);
  }
  run.revision += 1;
  run.receipts.push({ id: action.requestId, payload });
  if (run.receipts.length > 128) run.receipts.shift();
}
export function settleMilestones(run: RiftRun, wallet: RiftWallet): number {
  let count = 0;
  for (const milestone of milestoneView(run)) {
    if (milestone.reached && !milestone.claimed) { claim(run, wallet, milestone.id); count += 1; }
  }
  return count;
}
