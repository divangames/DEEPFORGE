import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { advanceRun, applyAction, canComplete, costOf, createRun, eventAt, FACILITY_LABELS, flowOf, MAX_LEVEL, milestoneView, RIFT_FACILITIES, RIFT_STAGES, RiftError, settleMilestones, stageOf, treeView } from './engine.js';
import type { RiftAction, RiftGuest, RiftStatus } from './protocol.js';
import type { RiftRepository, RiftTransaction } from './repository.js';

export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export class RiftService {
  constructor(readonly repository: RiftRepository, private readonly clock: () => number = Date.now) {}

  async register(nickname: string): Promise<RiftGuest> {
    const id = `RF-${randomUUID()}`;
    const token = randomBytes(32).toString('hex');
    await this.repository.create(id, nickname, tokenHash(token));
    return { ok: true, playerId: id, token };
  }
  async authenticate(authorization: string | undefined): Promise<string> {
    const token = /^Bearer ([0-9a-f]{64})$/.exec(authorization ?? '')?.[1];
    const id = token ? await this.repository.authenticate(tokenHash(token)) : null;
    if (!id) throw new RiftError('UNAUTHORIZED', 401);
    return id;
  }
  private async rollover(tx: RiftTransaction, now: number) {
    const run = tx.player.run;
    if (!run || run.event.id === eventAt(now).id) return;
    if (now < run.event.startsAt) throw new RiftError('CLOCK_ROLLBACK', 503);
    await tx.lockEvent(run.event.id, 'exclusive');
    advanceRun(run, now);
    const unclaimedPaid = settleMilestones(run, tx.player.wallet);
    const entries = await tx.board(run.event.id, run.group);
    const rankIndex = entries.findIndex((row) => row.playerId === tx.player.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const medals = run.score <= 0 || rank === null ? 0 : rank === 1 ? 30 : rank <= 3 ? 20 : rank <= 10 ? 10 : 5;
    tx.player.wallet.medals += medals;
    tx.player.history.unshift({ eventId: run.event.id, score: run.score, rank, medals, unclaimedPaid });
    tx.player.history = tx.player.history.slice(0, 8);
    tx.player.run = null;
  }
  private async view(tx: RiftTransaction, now: number): Promise<RiftStatus> {
    const player = tx.player;
    const run = player.run;
    if (run) advanceRun(run, now);
    const flow = run ? flowOf(run) : null;
    const board = run ? await tx.board(run.event.id, run.group) : [];
    const selfIndex = board.findIndex((r) => r.playerId === player.id);
    const entries = board.map((row, i) => ({ rank: i + 1, playerId: row.playerId, nickname: row.nickname, score: row.score, self: row.playerId === player.id }))
      .filter((_, i) => i < 10 || (selfIndex >= 0 && Math.abs(i - selfIndex) <= 2));
    return {
      ok: true, serverNow: now, persistence: this.repository.mode, event: eventAt(now),
      player: { id: player.id, nickname: player.nickname, wallet: structuredClone(player.wallet) },
      stages: RIFT_STAGES.map((s) => ({ ...s })),
      run: run && flow ? {
        revision: run.revision, stageIndex: run.stageIndex, completed: run.completedAt !== null,
        credits: Math.floor(run.credits * 100) / 100, chips: run.chips, stageEarned: Math.floor(run.stageEarned * 100) / 100,
        target: stageOf(run).target, minLevel: stageOf(run).minLevel, canComplete: canComplete(run),
        score: run.score, incomePerSecond: flow.income, bottleneck: flow.bottleneck, offlineCapHours: 4 + run.tech.storage,
        facilities: RIFT_FACILITIES.map((id) => ({ id, title: FACILITY_LABELS[id], level: run.levels[id], maxLevel: MAX_LEVEL, rate: flow.rates[id],
          cost1: Number.isFinite(costOf(run, id, 1)) ? costOf(run, id, 1) : 0,
          cost10: Number.isFinite(costOf(run, id, 10)) ? costOf(run, id, 10) : null })),
        startedAt: run.startedAt, completedAt: run.completedAt,
      } : null,
      tree: treeView(run), milestones: milestoneView(run),
      board: { group: run?.group ?? null, participants: board.length, selfRank: selfIndex >= 0 ? selfIndex + 1 : null, entries },
      previous: player.history[0] ? { ...player.history[0] } : null,
    };
  }
  status(id: string): Promise<RiftStatus> {
    return this.repository.withPlayer(id, async (tx) => {
      const now = this.clock();
      await this.rollover(tx, now);
      return this.view(tx, now);
    });
  }
  start(id: string, requestedEvent: string): Promise<RiftStatus> {
    return this.repository.withPlayer(id, async (tx) => {
      await tx.lockEvent(requestedEvent, 'shared');
      const now = this.clock();
      if (requestedEvent !== eventAt(now).id) throw new RiftError('EVENT_CHANGED');
      await this.rollover(tx, now);
      // Повтор start не сбрасывает прогресс и не занимает второе место в группе.
      if (!tx.player.run) tx.player.run = createRun(now, await tx.allocateGroup(requestedEvent));
      await this.saveScore(tx);
      return this.view(tx, now);
    });
  }
  action(id: string, action: RiftAction): Promise<RiftStatus> {
    return this.repository.withPlayer(id, async (tx) => {
      await tx.lockEvent(action.eventId, 'shared');
      const now = this.clock();
      if (action.eventId !== eventAt(now).id) throw new RiftError('EVENT_CLOSED');
      const run = tx.player.run;
      if (!run) throw new RiftError('RUN_NOT_STARTED');
      applyAction(run, tx.player.wallet, action, now);
      await this.saveScore(tx);
      return this.view(tx, now);
    });
  }
  private async saveScore(tx: RiftTransaction) {
    const run = tx.player.run;
    if (!run) return;
    await tx.saveEntry({ eventId: run.event.id, group: run.group, playerId: tx.player.id, nickname: tx.player.nickname, score: run.score, reachedAt: run.scoreReachedAt });
  }
}
