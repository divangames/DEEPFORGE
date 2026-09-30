// Публичный контракт Rift API. Клиентскую копию обновляет scripts/sync-rift-contract.mjs.
export const RIFT_API_VERSION = 17;
export type RiftSlot = 0 | 1 | 2;
export type RiftOperatorId = 'rook' | 'ion' | 'talia' | 'mara' | 'kael' | 'sera';
export type RiftReactorUpgrade = 'slots' | 'range' | 'power';
export type RiftFacility = 'extraction' | 'lift' | 'logistics';
export type RiftTech = 'drills' | 'refining' | 'cables' | 'dispatch' | 'efficiency' | 'storage';
export type RiftResource = 'cores' | 'recruitData' | 'trainingModules' | 'promotionBadges' | 'supplyKeys' | 'alloy' | 'circuits' | 'fiber' | 'medals';
export type RiftWallet = Record<RiftResource, number>;
export interface RiftEvent { id: string; title: string; startsAt: number; endsAt: number }
export interface RiftAction {
  requestId: string;
  eventId: string;
  revision: number;
  kind: 'upgrade' | 'research' | 'complete' | 'claim' | 'reactor-upgrade' | 'operator-assign' | 'operator-activate';
  slot?: RiftSlot;
  target?: RiftFacility | RiftTech | string;
  count?: 1 | 10;
}
export interface RiftStage { id: string; title: string; target: number; minLevel: number; yield: number; costScale: number }
export interface RiftRank { rank: number; playerId: string; nickname: string; score: number; self: boolean }
export interface RiftTechView {
  id: RiftTech; title: string; description: string; level: number; maxLevel: number;
  cost: number; prerequisite: string | null; available: boolean;
}
export interface RiftMilestoneView {
  id: string; title: string; reached: boolean; claimed: boolean; chips: number;
  reward: Partial<RiftWallet>;
}
export interface RiftReactorView {
  unlocked: boolean; unlockStage: number; cores: number; earnedCores: number;
  slots: (RiftOperatorId | null)[]; capacity: number;
  coverage: RiftFacility[]; multiplier: number;
  pulse: { active: boolean; firstAt: number | null; nextAt: number | null; endsAt: number | null; durationMs: number; periodMs: number };
  upgrades: { id: RiftReactorUpgrade; level: number; maxLevel: number; cost: number | null; available: boolean }[];
  operators: { id: RiftOperatorId; name: string; role: RiftFacility | 'all'; unlockStage: number;
    multiplier: number; durationMs: number; cooldownMs: number; cores: number;
    available: boolean; assignedSlot: number | null; activeUntil: number; readyAt: number; uses: number }[];
}
export interface RiftStatus {
  ok: true;
  apiVersion: number;
  serverNow: number;
  persistence: 'postgres' | 'memory';
  event: RiftEvent;
  player: { id: string; nickname: string; wallet: RiftWallet };
  stages: RiftStage[];
  reactor: RiftReactorView | null;
  run: null | {
    rulesVersion: number; revision: number; stageIndex: number; completed: boolean; credits: number; chips: number;
    stageEarned: number; target: number; minLevel: number; canComplete: boolean;
    score: number; incomePerSecond: number; bottleneck: RiftFacility; offlineCapHours: number;
    facilities: { id: RiftFacility; title: string; level: number; maxLevel: number; rate: number; cost1: number; cost10: number | null }[];
    startedAt: number; completedAt: number | null;
  };
  tree: RiftTechView[];
  milestones: RiftMilestoneView[];
  board: { group: string | null; participants: number; selfRank: number | null; entries: RiftRank[] };
  previous: null | { eventId: string; score: number; rank: number | null; medals: number; unclaimedPaid: number };
}
export interface RiftGuest { ok: true; playerId: string; token: string }
