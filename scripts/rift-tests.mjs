import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { advanceRun, applyAction, canComplete, costOf, createRun, emptyWallet, eventAt, flowOf, milestoneView, RIFT_STAGES, settleMilestones, treeView, WEEK_MS } from '../.rift-tests/engine.js';
import { MemoryRiftRepository } from '../.rift-tests/repository.js';
import { RiftService } from '../.rift-tests/service.js';
import { parseAction, parseEvent, parseNickname } from '../.rift-tests/validation.js';
const START = Date.UTC(2026, 8, 28, 0, 0, 0);
const makeAction = (run, kind, target, count) => ({ requestId: randomUUID(), eventId: run.event.id, revision: run.revision, kind, ...(target === undefined ? {} : { target }), ...(count === undefined ? {} : { count }) });
const expectCode = (code) => (error) => error.code === code;
async function fixture() {
  let now = START;
  const repository = new MemoryRiftRepository();
  const service = new RiftService(repository, () => now);
  const guest = await service.register('Испытатель');
  const id = await service.authenticate(`Bearer ${guest.token}`);
  await service.start(id, eventAt(now).id);
  return { repository, service, guest, id, time: (next) => { now = next; } };
}

test('UTC weeks align to Monday; all 5 stage IDs are unique', () => {
  for (let day = 0; day < 7; day++) assert.equal(eventAt(START + day * 86400_000).startsAt, START);
  assert.equal(eventAt(START + WEEK_MS).id, 'rift-2026-10-05');
  assert.equal(new Set(RIFT_STAGES.map((s) => s.id)).size, 5);
});
test('60 seconds of server time yields exactly 180 credits, polling does not mint extra cash', () => {
  const one = createRun(START, 'R-1'); const many = createRun(START, 'R-1');
  advanceRun(one, START + 60000);
  for (let sec = 5; sec <= 60; sec += 5) advanceRun(many, START + sec * 1000);
  assert.equal(one.credits, 260); assert.equal(one.stageEarned, 180); assert.equal(many.credits, one.credits);
  advanceRun(one, START + 60000); assert.equal(one.credits, 260);
});
test('offline cap is 4 hours, storage increases it to 7; rollback never recredits', () => {
  const run = createRun(START, 'R-1'); advanceRun(run, START + 86400_000);
  assert.equal(run.stageEarned, 43200);
  advanceRun(run, START + 10000); assert.equal(run.stageEarned, 43200);
  advanceRun(run, START + 86400_000); assert.equal(run.stageEarned, 43200);
  const boosted = createRun(START, 'R-1'); boosted.tech.storage = 3; advanceRun(boosted, START + 86400_000);
  assert.equal(boosted.stageEarned, 75600);
});
test('event end clamps income even if the user returns next week', () => {
  const now = START + WEEK_MS - 10000; const run = createRun(now, 'R-1');
  advanceRun(run, START + WEEK_MS + 86400_000);
  assert.equal(run.stageEarned, 30); assert.equal(run.checkpoint, START + WEEK_MS);
});
test('client score/time/identity are forbidden by request validation', () => {
  const base = makeAction(createRun(START, 'R-1'), 'upgrade', 'lift', 1);
  for (const extra of [{ score: 9e9 }, { now: 1 }, { playerId: 'someone' }, { credits: 10000 }]) assert.throws(() => parseAction({ ...base, ...extra }), expectCode('INVALID_REQUEST'));
  for (const count of [0, -1, 5, 1.1, '1', Infinity]) assert.throws(() => parseAction({ ...base, count }), expectCode('INVALID_REQUEST'));
  assert.deepEqual(parseAction(base), base);
  assert.throws(() => parseAction({ ...base, kind: 'complete' }), expectCode('INVALID_REQUEST'));
  assert.throws(() => parseNickname({ nickname: 'bad\nname' }), expectCode('INVALID_REQUEST'));
  assert.throws(() => parseEvent({ eventId: 'rift-2026-09-28', score: 0 }), expectCode('INVALID_REQUEST'));
});
test('bulk upgrades spend quoted cost and score is server-derived', () => {
  const run = createRun(START, 'R-1'), wallet = emptyWallet(); run.credits = 10000;
  const cost = costOf(run, 'lift', 10);
  applyAction(run, wallet, makeAction(run, 'upgrade', 'lift', 10), START);
  assert.equal(run.credits, 10000 - cost); assert.equal(run.levels.lift, 11); assert.equal(run.score, 100);
});
test('upgrade, research prerequisites and level caps reject invalid purchases', () => {
  const run = createRun(START, 'R-1'); const wallet = emptyWallet();
  assert.equal(treeView(run).find((t) => t.id === 'refining').available, false);
  applyAction(run, wallet, makeAction(run, 'research', 'drills'), START);
  assert.equal(treeView(run).find((t) => t.id === 'refining').available, true);
  assert.equal(flowOf(run).rates.extraction, 4.48);
  run.levels.lift = 50;
  assert.throws(() => applyAction(run, wallet, makeAction(run, 'upgrade', 'lift', 1), START), expectCode('MAX_LEVEL'));
});
test('new stage resets local levels/credits but preserves tree, reward chips and score', () => {
  const run = createRun(START, 'R-1'), wallet = emptyWallet();
  run.stageEarned = 1200; run.levels = { extraction: 5, lift: 5, logistics: 5 }; run.tech.drills = 1;
  assert.equal(canComplete(run), true);
  applyAction(run, wallet, makeAction(run, 'complete'), START);
  assert.equal(run.stageIndex, 1); assert.equal(run.credits, 160); assert.equal(run.tech.drills, 1); assert.equal(run.levels.lift, 1); assert.equal(run.score, 1000);
  assert.equal(milestoneView(run).find((m) => m.id === 'gate-complete').reached, true);
});
test('same request ID returns once, different payload with same ID is rejected', () => {
  const run = createRun(START, 'R-1'), wallet = emptyWallet(); const action = makeAction(run, 'upgrade', 'lift', 1);
  applyAction(run, wallet, action, START); const after = JSON.stringify(run);
  applyAction(run, wallet, action, START + 1000); assert.equal(JSON.stringify(run), after);
  assert.throws(() => applyAction(run, wallet, { ...action, target: 'extraction' }, START + 1000), expectCode('REQUEST_ID_REUSED'));
});
test('milestone claim is once-only; earned unclaimed rewards settle once', () => {
  const run = createRun(START, 'R-1'), wallet = emptyWallet(); run.reached.push('gate-half', 'gate-complete');
  applyAction(run, wallet, makeAction(run, 'claim', 'gate-half'), START);
  assert.equal(wallet.alloy, 12); assert.equal(run.chips, 4);
  assert.throws(() => applyAction(run, wallet, makeAction(run, 'claim', 'gate-half'), START), expectCode('ALREADY_CLAIMED'));
  assert.equal(settleMilestones(run, wallet), 1); const balance = { ...wallet };
  assert.equal(settleMilestones(run, wallet), 0); assert.deepEqual(wallet, balance);
});
test('authentication requires a secret, not a public player ID', async () => {
  const { service, guest, id } = await fixture(); assert.equal(id, guest.playerId);
  await assert.rejects(() => service.authenticate(undefined), expectCode('UNAUTHORIZED'));
  await assert.rejects(() => service.authenticate(`Bearer ${id}`), expectCode('UNAUTHORIZED'));
  await assert.rejects(() => service.authenticate(`Bearer ${'0'.repeat(64)}`), expectCode('UNAUTHORIZED'));
});
test('concurrent start is idempotent and does not allocate several groups', async () => {
  const { service, id } = await fixture();
  const values = await Promise.all(Array.from({ length: 20 }, () => service.start(id, eventAt(START).id)));
  assert.equal(new Set(values.map((v) => v.board.group)).size, 1);
  assert.ok(values.every((v) => v.run.revision === 0 && v.board.participants === 1));
});
test('two concurrent actions at one revision: one success, one conflict', async () => {
  const { service, id } = await fixture();
  const run = createRun(START, 'R-1');
  const results = await Promise.allSettled([service.action(id, makeAction(run, 'upgrade', 'lift', 1)), service.action(id, makeAction(run, 'upgrade', 'logistics', 1))]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const view = await service.status(id); assert.equal(view.run.revision, 1); assert.equal(view.run.score, 10);
});
test('transaction rollback leaves wallet/score/revision untouched after failure', async () => {
  const { service, id } = await fixture(); const before = await service.status(id);
  await assert.rejects(() => service.action(id, makeAction(createRun(START, 'R-1'), 'upgrade', 'lift', 10)), expectCode('NOT_ENOUGH_CREDITS'));
  const after = await service.status(id); assert.deepEqual(after.run, before.run); assert.deepEqual(after.player.wallet, before.player.wallet);
});
test('concurrent retries cannot double a claim', async () => {
  const { service, repository, id } = await fixture();
  await repository.withPlayer(id, async (tx) => { tx.player.run.reached.push('gate-half'); });
  const request = makeAction(createRun(START, 'R-1'), 'claim', 'gate-half');
  const results = await Promise.all([service.action(id, request), service.action(id, request), service.action(id, request)]);
  assert.ok(results.every((r) => r.player.wallet.alloy === 12 && r.run.revision === 1));
});
test('end-of-week reward is atomic, auto-claims milestones and never repeats', async () => {
  const { service, repository, id, time } = await fixture();
  await service.action(id, makeAction(createRun(START, 'R-1'), 'upgrade', 'lift', 1));
  await repository.withPlayer(id, async (tx) => { tx.player.run.reached.push('gate-complete'); });
  time(START + WEEK_MS);
  const values = await Promise.all([service.status(id), service.status(id), service.status(id)]);
  assert.ok(values.every((v) => v.run === null && v.player.wallet.medals === 33 && v.player.wallet.cores === 1));
  assert.equal(values[0].previous.rank, 1);
  const next = await service.start(id, eventAt(START + WEEK_MS).id);
  assert.equal(next.run.score, 0); assert.equal(next.run.chips, 2); assert.equal(next.player.wallet.medals, 33);
});
test('closed event does not accept actions, even with a valid old guest token', async () => {
  const { service, id, time } = await fixture(); time(START + WEEK_MS);
  await assert.rejects(() => service.action(id, makeAction(createRun(START, 'R-1'), 'upgrade', 'lift', 1)), expectCode('EVENT_CLOSED'));
});
test('101 players get groups of 100 and 1; own row is shown outside top 10', async () => {
  const repo = new MemoryRiftRepository(), service = new RiftService(repo, () => START);
  let last, hundredth;
  for (let i = 1; i <= 101; i++) {
    const g = await service.register(`Operator ${i}`); await service.start(g.playerId, eventAt(START).id);
    if (i === 100) hundredth = g.playerId; if (i === 101) last = g.playerId;
  }
  const a = await service.status(hundredth), b = await service.status(last);
  assert.equal(a.board.participants, 100); assert.equal(b.board.participants, 1); assert.notEqual(a.board.group, b.board.group);
  assert.ok(a.board.entries.some((e) => e.self)); assert.ok(a.board.entries.length <= 15);
});
test('full five-stage expedition completes through legitimate economy actions', () => {
  const run = createRun(START, 'R-1'), wallet = emptyWallet(); let now = START;
  for (let iteration = 0; iteration < 10000 && run.completedAt === null; iteration++) {
    now += 30000; advanceRun(run, now);
    for (const milestone of milestoneView(run)) if (milestone.reached && !milestone.claimed) applyAction(run, wallet, makeAction(run, 'claim', milestone.id), now);
    const tech = treeView(run).find((t) => t.available && t.id !== 'storage');
    if (tech) applyAction(run, wallet, makeAction(run, 'research', tech.id), now);
    if (canComplete(run)) { applyAction(run, wallet, makeAction(run, 'complete'), now); continue; }
    const wanted = RIFT_STAGES[run.stageIndex].minLevel;
    const facility = Object.keys(run.levels).filter((id) => run.levels[id] < Math.min(wanted + 5, 50)).sort((a, b) => run.levels[a] - run.levels[b])[0];
    if (facility && run.credits >= costOf(run, facility, 1)) applyAction(run, wallet, makeAction(run, 'upgrade', facility, 1), now);
  }
  assert.notEqual(run.completedAt, null); assert.ok(now < START + WEEK_MS);
  settleMilestones(run, wallet);
  assert.equal(run.claimed.length, 10); assert.equal(wallet.supplyKeys, 5); assert.equal(wallet.cores, 15);
  const score = run.score; const credits = run.credits; advanceRun(run, now + 3600_000);
  assert.equal(run.score, score); assert.equal(run.credits, credits);
  console.log(`Full expedition: ${(now - START) / 60000} simulated minutes, score ${score}, rewards ${JSON.stringify(wallet)}`);
});
