import { RiftError, emptyWallet, type RiftRun } from './engine.js';
import type { RiftWallet } from './protocol.js';

export interface RiftArchive { eventId: string; score: number; rank: number | null; medals: number; unclaimedPaid: number }
export interface RiftPlayer {
  id: string; nickname: string; wallet: RiftWallet; run: RiftRun | null; history: RiftArchive[];
}
export interface RiftEntry {
  eventId: string; group: string; playerId: string; nickname: string; score: number; reachedAt: number;
}
export interface RiftTransaction {
  player: RiftPlayer;
  lockEvent(eventId: string, mode: 'shared' | 'exclusive'): Promise<void>;
  allocateGroup(eventId: string): Promise<string>;
  saveEntry(entry: RiftEntry): Promise<void>;
  board(eventId: string, group: string): Promise<RiftEntry[]>;
}
export interface RiftRepository {
  readonly mode: 'postgres' | 'memory';
  create(id: string, nickname: string, tokenHash: string): Promise<void>;
  authenticate(tokenHash: string): Promise<string | null>;
  withPlayer<T>(id: string, operation: (tx: RiftTransaction) => Promise<T>): Promise<T>;
}
export function newPlayer(id: string, nickname: string): RiftPlayer {
  return { id, nickname, wallet: emptyWallet(), run: null, history: [] };
}
export function compareEntries(a: RiftEntry, b: RiftEntry): number {
  return b.score - a.score || a.reachedAt - b.reachedAt || a.playerId.localeCompare(b.playerId, 'en');
}

// Только локальная разработка: последовательная очередь и copy-on-write обеспечивают rollback.
export class MemoryRiftRepository implements RiftRepository {
  readonly mode = 'memory' as const;
  private players = new Map<string, RiftPlayer>();
  private tokens = new Map<string, string>();
  private entries = new Map<string, RiftEntry>();
  private groups = new Map<string, number>();
  private pending: Promise<unknown> = Promise.resolve();

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => undefined);
    return result;
  }
  async create(id: string, nickname: string, tokenHash: string) {
    await this.serial(async () => {
      if (this.players.size >= 10000) throw new RiftError('MEMORY_CAPACITY', 503);
      if (this.players.has(id) || this.tokens.has(tokenHash)) throw new RiftError('ACCOUNT_EXISTS');
      this.players.set(id, newPlayer(id, nickname));
      this.tokens.set(tokenHash, id);
    });
  }
  async authenticate(tokenHash: string) { return this.tokens.get(tokenHash) ?? null; }
  withPlayer<T>(id: string, operation: (tx: RiftTransaction) => Promise<T>): Promise<T> {
    return this.serial(async () => {
      const saved = this.players.get(id);
      if (!saved) throw new RiftError('UNAUTHORIZED', 401);
      const player = structuredClone(saved);
      const entries = new Map(this.entries);
      const groups = new Map(this.groups);
      const result = await operation({
        player,
        lockEvent: async () => { /* В memory все транзакции уже выполняются последовательно. */ },
        allocateGroup: async (eventId) => {
          const position = groups.get(eventId) ?? 0;
          groups.set(eventId, position + 1);
          return `R-${String(Math.floor(position / 100) + 1).padStart(4, '0')}`;
        },
        saveEntry: async (entry) => { entries.set(`${entry.eventId}:${entry.playerId}`, structuredClone(entry)); },
        board: async (eventId, group) => [...entries.values()].filter((row) => row.eventId === eventId && row.group === group).sort(compareEntries),
      });
      this.players.set(id, structuredClone(player));
      this.entries = entries;
      this.groups = groups;
      return result;
    });
  }
}
