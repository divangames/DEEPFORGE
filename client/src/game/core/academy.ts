import { SPECIALISTS, type PersistentSpecialistSystem, type SpecialistId } from './specialists';

export interface AcademyResources {
  recruitData: number;
  trainingModules: number;
  promotionBadges: number;
}

export interface AcademyOperationRewards extends AcademyResources {
  fragmentSpecialistId: SpecialistId;
  fragments: number;
}

export interface AcademyOperationDefinition {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  durationSeconds: number;
  requiredRebuilds: number;
  rewards: AcademyOperationRewards;
}

export interface PersistentAcademyState {
  resources: AcademyResources;
  completedOperations: number;
  activeOperationId: string | null;
  activeStartedAt: number;
  activeEndsAt: number;
  recruitCount: number;
  lastRecruit: { specialistId: SpecialistId; fragments: number; at: number } | null;
}

export interface AcademyOperationView extends AcademyOperationDefinition {
  completed: boolean;
  current: boolean;
  available: boolean;
  locked: boolean;
}

export interface AcademyView {
  resources: AcademyResources;
  completedOperations: number;
  totalOperations: number;
  activeOperation: AcademyOperationDefinition | null;
  activeRemaining: number;
  activeReady: boolean;
  nextOperation: AcademyOperationDefinition | null;
  canStartNext: boolean;
  scanCost: number;
  canScan: boolean;
  lastRecruit: { specialistId: SpecialistId; specialistName: string; fragments: number; at: number } | null;
  operations: AcademyOperationView[];
}

export const ACADEMY_SCAN_COST = 100;

const rebuildGateByOperation = (index: number) => {
  if (index <= 5) return 0;
  if (index <= 10) return 1;
  if (index <= 15) return 2;
  if (index <= 20) return 4;
  if (index <= 25) return 7;
  return 10;
};

export const ACADEMY_OPERATIONS: readonly AcademyOperationDefinition[] = Array.from({ length: 30 }, (_, raw) => {
  const index = raw + 1;
  const specialist = SPECIALISTS[raw % SPECIALISTS.length];
  const block = Math.floor(raw / 5);
  const recruitData = 45 + index * 7;
  const trainingModules = 20 + index * 5;
  const promotionBadges = index % 5 === 0 ? 2 + block : 0;
  const fragments = 3 + block;
  return {
    id: `academy-${String(index).padStart(2, '0')}`,
    index,
    title: `Academy Drill ${String(index).padStart(2, '0')}`,
    subtitle: index % 5 === 0 ? 'Контрольная операция · усиленная награда' : 'Тренировочная операция Specialists',
    durationSeconds: Math.min(150, 22 + index * 4),
    requiredRebuilds: rebuildGateByOperation(index),
    rewards: {
      recruitData,
      trainingModules,
      promotionBadges,
      fragmentSpecialistId: specialist.id,
      fragments,
    },
  };
});

const ACADEMY_MAP = new Map(ACADEMY_OPERATIONS.map((item) => [item.id, item]));

export const DEFAULT_ACADEMY_STATE: PersistentAcademyState = {
  resources: {
    recruitData: 80,
    trainingModules: 60,
    promotionBadges: 0,
  },
  completedOperations: 0,
  activeOperationId: null,
  activeStartedAt: 0,
  activeEndsAt: 0,
  recruitCount: 0,
  lastRecruit: null,
};

function safeResource(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

export function sanitizeAcademyState(value?: Partial<PersistentAcademyState> | null): PersistentAcademyState {
  const completedOperations = Math.max(0, Math.min(ACADEMY_OPERATIONS.length, Math.floor(Number(value?.completedOperations) || 0)));
  const activeOperationId = value?.activeOperationId && ACADEMY_MAP.has(value.activeOperationId)
    ? value.activeOperationId
    : null;
  const source = value?.resources;
  const lastRecruit = value?.lastRecruit && SPECIALISTS.some((item) => item.id === value.lastRecruit!.specialistId)
    ? {
      specialistId: value.lastRecruit.specialistId,
      fragments: Math.max(0, Math.floor(Number(value.lastRecruit.fragments) || 0)),
      at: Math.max(0, Number(value.lastRecruit.at) || 0),
    }
    : null;
  return {
    resources: {
      recruitData: safeResource(source?.recruitData, DEFAULT_ACADEMY_STATE.resources.recruitData),
      trainingModules: safeResource(source?.trainingModules, DEFAULT_ACADEMY_STATE.resources.trainingModules),
      promotionBadges: safeResource(source?.promotionBadges, DEFAULT_ACADEMY_STATE.resources.promotionBadges),
    },
    completedOperations,
    activeOperationId,
    activeStartedAt: activeOperationId ? Math.max(0, Number(value?.activeStartedAt) || 0) : 0,
    activeEndsAt: activeOperationId ? Math.max(0, Number(value?.activeEndsAt) || 0) : 0,
    recruitCount: Math.max(0, Math.floor(Number(value?.recruitCount) || 0)),
    lastRecruit,
  };
}

export function getAcademyOperation(id: string | null | undefined) {
  return id ? ACADEMY_MAP.get(id) ?? null : null;
}

export function startAcademyOperation(
  state: PersistentAcademyState,
  now: number,
  totalRebuilds: number,
): PersistentAcademyState | null {
  const next = sanitizeAcademyState(state);
  if (next.activeOperationId) return null;
  const operation = ACADEMY_OPERATIONS[next.completedOperations];
  if (!operation || totalRebuilds < operation.requiredRebuilds) return null;
  next.activeOperationId = operation.id;
  next.activeStartedAt = now;
  next.activeEndsAt = now + operation.durationSeconds * 1000;
  return next;
}

export function claimAcademyOperation(
  state: PersistentAcademyState,
  now: number,
): { state: PersistentAcademyState; fragments: { specialistId: SpecialistId; amount: number } } | null {
  const next = sanitizeAcademyState(state);
  const operation = getAcademyOperation(next.activeOperationId);
  if (!operation || now + 10 < next.activeEndsAt) return null;

  next.resources.recruitData += operation.rewards.recruitData;
  next.resources.trainingModules += operation.rewards.trainingModules;
  next.resources.promotionBadges += operation.rewards.promotionBadges;
  next.completedOperations = Math.max(next.completedOperations, operation.index);
  next.activeOperationId = null;
  next.activeStartedAt = 0;
  next.activeEndsAt = 0;

  return {
    state: next,
    fragments: { specialistId: operation.rewards.fragmentSpecialistId, amount: operation.rewards.fragments },
  };
}

export function runAcademyRecruitScan(
  state: PersistentAcademyState,
  now: number,
): { state: PersistentAcademyState; fragments: { specialistId: SpecialistId; amount: number } } | null {
  const next = sanitizeAcademyState(state);
  if (next.resources.recruitData < ACADEMY_SCAN_COST) return null;

  const rarityPattern = [0, 2, 3, 1, 0, 4, 2, 0, 3, 5, 1, 2];
  const index = rarityPattern[next.recruitCount % rarityPattern.length] % SPECIALISTS.length;
  const specialist = SPECIALISTS[index];
  const cycle = Math.floor(next.recruitCount / rarityPattern.length);
  const base = specialist.rarity === 'LEGENDARY' ? 4 : specialist.rarity === 'EPIC' ? 6 : specialist.rarity === 'RARE' ? 8 : 10;
  const amount = Math.min(16, base + (cycle % 3));

  next.resources.recruitData -= ACADEMY_SCAN_COST;
  next.recruitCount += 1;
  next.lastRecruit = { specialistId: specialist.id, fragments: amount, at: now };

  return { state: next, fragments: { specialistId: specialist.id, amount } };
}

export function spendTrainingModules(state: PersistentAcademyState, amount: number): PersistentAcademyState | null {
  const next = sanitizeAcademyState(state);
  const safe = Math.max(0, Math.floor(amount));
  if (safe <= 0 || next.resources.trainingModules < safe) return null;
  next.resources.trainingModules -= safe;
  return next;
}

export function spendPromotionBadges(state: PersistentAcademyState, amount: number): PersistentAcademyState | null {
  const next = sanitizeAcademyState(state);
  const safe = Math.max(0, Math.floor(amount));
  if (safe <= 0 || next.resources.promotionBadges < safe) return null;
  next.resources.promotionBadges -= safe;
  return next;
}

export function buildAcademyView(state: PersistentAcademyState, now: number, totalRebuilds: number): AcademyView {
  const clean = sanitizeAcademyState(state);
  const activeOperation = getAcademyOperation(clean.activeOperationId);
  const nextOperation = ACADEMY_OPERATIONS[clean.completedOperations] ?? null;
  const activeRemaining = activeOperation ? Math.max(0, (clean.activeEndsAt - now) / 1000) : 0;
  const operations = ACADEMY_OPERATIONS.map((operation) => {
    const completed = operation.index <= clean.completedOperations;
    const current = operation.id === clean.activeOperationId;
    const available = !completed && !current && operation.index === clean.completedOperations + 1 && !activeOperation && totalRebuilds >= operation.requiredRebuilds;
    return {
      ...operation,
      completed,
      current,
      available,
      locked: !completed && !current && !available,
    };
  });

  const last = clean.lastRecruit;
  return {
    resources: { ...clean.resources },
    completedOperations: clean.completedOperations,
    totalOperations: ACADEMY_OPERATIONS.length,
    activeOperation,
    activeRemaining,
    activeReady: Boolean(activeOperation && activeRemaining <= 0.01),
    nextOperation,
    canStartNext: Boolean(nextOperation && !activeOperation && totalRebuilds >= nextOperation.requiredRebuilds),
    scanCost: ACADEMY_SCAN_COST,
    canScan: clean.resources.recruitData >= ACADEMY_SCAN_COST,
    lastRecruit: last
      ? {
        specialistId: last.specialistId,
        specialistName: SPECIALISTS.find((item) => item.id === last.specialistId)?.name ?? last.specialistId,
        fragments: last.fragments,
        at: last.at,
      }
      : null,
    operations,
  };
}

export function grantAcademyMigrationResources(state: PersistentAcademyState, specialistSystem: PersistentSpecialistSystem): PersistentAcademyState {
  const next = sanitizeAcademyState(state);
  const legacyLevels = Object.values(specialistSystem.profiles).reduce((sum, profile) => sum + Math.max(0, (profile?.level ?? 1) - 1), 0);
  next.resources.trainingModules += legacyLevels * 12;
  return next;
}
