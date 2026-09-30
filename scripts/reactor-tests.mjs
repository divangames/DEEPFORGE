// Тесты реального скомпилированного серверного ядра; часы управляются только тестом.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRun, eventAt, applyAction, emptyWallet, advanceRun, flowOf, RIFT_STAGES } from '../.rift-tests/engine.js';
import { pulseMilliseconds, pulseAt, reactorView, unlockReactor, RIFT_OPERATORS, REACTOR_COSTS } from '../.rift-tests/reactor.js';
import { parseAction } from '../.rift-tests/validation.js';
import { MemoryRiftRepository } from '../.rift-tests/repository.js';
import { RiftService } from '../.rift-tests/service.js';
const NOW = Date.UTC(2026, 8, 30, 12);
const command = (run, kind, target, extra = {}) => ({ requestId: randomUUID(), eventId: run.event.id, revision: run.revision, kind, ...(target ? { target } : {}), ...extra });
function unlocked(now = NOW) { const r = createRun(now, 'R2-0001'); r.stageIndex = 1; unlockReactor(r, now); return r; }
function act(run, kind, target, now = NOW, extra = {}) { applyAction(run, emptyWallet(), command(run, kind, target, extra), now); }
function almost(a, b) { assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, a, b), `${a} != ${b}`); }

test('Reactor is unavailable on first site; actual completion unlocks it exactly once', () => {
 const r = createRun(NOW, 'R2-0001');
 assert.equal(reactorView(r, NOW).unlocked, false);
 assert.throws(() => act(r, 'operator-assign', 'rook', NOW, {slot: 0}), /REACTOR_LOCKED/);
 r.stageEarned = RIFT_STAGES[0].target; r.levels = {extraction:5,lift:5,logistics:5};
 act(r, 'complete');
 assert.equal(r.stageIndex, 1); assert.equal(r.reactor.unlockedAt, NOW);
 unlockReactor(r, NOW + 1000); assert.equal(r.reactor.unlockedAt, NOW);
});
test('legacy v1 JSON keeps progress, no reactor or new grouping inserted mid-run', () => {
 const r = createRun(NOW, 'R-0001', 1); r.stageIndex = 2; r.credits = 400;
 const before = JSON.stringify(r);
 unlockReactor(r, NOW);
 assert.equal(JSON.stringify(r), before); assert.equal(reactorView(r, NOW), null);
 assert.throws(() => act(r, 'reactor-upgrade', 'slots'), /LEGACY_REACTOR/);
});
test('six operators have unique IDs, finite buffs and positive durations/cooldowns', () => {
 assert.equal(RIFT_OPERATORS.length, 6); assert.equal(new Set(RIFT_OPERATORS.map(o => o.id)).size, 6);
 for(const o of RIFT_OPERATORS) { assert.ok(o.cooldownMs >= o.durationMs); assert.ok(o.cores > 0); assert.ok(o.multiplier > 1); }
});
test('strict request validation accepts reactor commands and rejects all client rewards/times', () => {
 const r = unlocked();
 for(const cmd of [command(r,'operator-assign','rook',{slot:0}),command(r,'operator-activate','rook'),command(r,'reactor-upgrade','range')]) assert.deepEqual(parseAction(cmd),cmd);
 for(const extra of [{score:10},{cores:99},{multiplier:20},{now:NOW},{readyAt:0},{reactor:{cores:100}}]) assert.throws(()=>parseAction({...command(r,'operator-activate','rook'), ...extra}),/INVALID_REQUEST/);
 for(const slot of [-1,3,0.5,'0',null]) assert.throws(()=>parseAction(command(r,'operator-assign','rook',{slot})),/INVALID_REQUEST/);
 assert.throws(()=>parseAction(command(r,'operator-activate','rook',{slot:0})),/INVALID_REQUEST/);
 assert.throws(()=>parseAction(command(r,'operator-assign','rook',{slot:0,count:10})),/INVALID_REQUEST/);
});
test('locked slot, locked operator, duplicate operator and occupied role cannot be assigned', () => {
 const r = unlocked();
 assert.throws(()=>act(r,'operator-assign','rook',NOW,{slot:1}),/SLOT_LOCKED/);
 assert.throws(()=>act(r,'operator-assign','mara',NOW,{slot:0}),/OPERATOR_LOCKED/);
 act(r,'operator-assign','rook',NOW,{slot:0});
 r.reactor.upgrades.slots=2; r.stageIndex=2;
 assert.throws(()=>act(r,'operator-assign','rook',NOW,{slot:1}),/OPERATOR_ASSIGNED/);
 assert.throws(()=>act(r,'operator-assign','mara',NOW,{slot:1}),/ROLE_OCCUPIED/);
});
test('a valid use grants one core, no direct score, and a finite personal cooldown', () => {
 const r = unlocked(); act(r,'operator-assign','ion',NOW,{slot:0}); const score=r.score;
 act(r,'operator-activate','ion'); assert.equal(r.reactor.cores,1); assert.equal(r.score,score);
 assert.equal(r.reactor.operators.ion.readyAt,NOW+75000); assert.equal(r.reactor.operators.ion.activeUntil,NOW+20000);
 assert.throws(()=>act(r,'operator-activate','ion',NOW+1),/OPERATOR_COOLDOWN/);
});
test('cooldown is not bypassed by unassign/reassign; active operators cannot be removed', () => {
 const r=unlocked();act(r,'operator-assign','rook',NOW,{slot:0});act(r,'operator-activate','rook');
 assert.throws(()=>act(r,'operator-assign','none',NOW+1000,{slot:0}),/OPERATOR_BUSY/);
 act(r,'operator-assign','none',NOW+20000,{slot:0});act(r,'operator-assign','rook',NOW+21000,{slot:0});
 assert.throws(()=>act(r,'operator-activate','rook',NOW+22000),/OPERATOR_COOLDOWN/);
 act(r,'operator-activate','rook',NOW+60000);assert.equal(r.reactor.cores,2);
});
test('same request replay gives no second core; edited payload is rejected', () => {
 const r=unlocked();act(r,'operator-assign','rook',NOW,{slot:0});const c=command(r,'operator-activate','rook');
 applyAction(r,emptyWallet(),c,NOW);applyAction(r,emptyWallet(),c,NOW+1000);
 assert.equal(r.reactor.cores,1);assert.equal(r.reactor.operators.rook.uses,1);
 assert.throws(()=>applyAction(r,emptyWallet(),{...c,target:'ion'},NOW),/REQUEST_ID_REUSED/);
});
test('v1 receipt encoding still accepts a retry after deployment', () => {
 const r=createRun(NOW,'R-0001',1),c=command(r,'upgrade','lift',{count:1});
 applyAction(r,emptyWallet(),c,NOW);assert.equal(r.receipts[0].payload,JSON.stringify([c.eventId,0,'upgrade','lift',1]));
 applyAction(r,emptyWallet(),c,NOW);assert.equal(r.revision,1);
});
test('upgrade costs debit once, max levels and insufficient cores are enforced', () => {
 const r=unlocked();assert.throws(()=>act(r,'reactor-upgrade','slots'),/NOT_ENOUGH_REACTOR_CORES/);
 r.reactor.cores=100;
 for(const [id,costs] of Object.entries(REACTOR_COSTS)) {
  for(const cost of costs) { const before=r.reactor.cores;act(r,'reactor-upgrade',id);assert.equal(r.reactor.cores,before-cost); }
  assert.throws(()=>act(r,'reactor-upgrade',id),/MAX_LEVEL/);
 }
 assert.equal(reactorView(r,NOW).capacity,3);assert.equal(reactorView(r,NOW).multiplier,5);
 assert.deepEqual(reactorView(r,NOW).coverage,['extraction','lift','logistics']);
});
test('pulse starts after 60 seconds, lasts exactly 12 seconds and repeats without polling', () => {
 const r=unlocked();
 assert.equal(pulseAt(r,NOW+59999),false);assert.equal(pulseAt(r,NOW+60000),true);
 assert.equal(pulseAt(r,NOW+71999),true);assert.equal(pulseAt(r,NOW+72000),false);
 assert.equal(pulseMilliseconds(r,NOW,NOW+180000),24000);
 assert.equal(pulseMilliseconds(r,NOW+65000,NOW+125000),12000);
});
test('partial coverage respects bottlenecks; full coverage boosts the actual chain', () => {
 const r=unlocked();const base=flowOf(r,NOW).income;
 almost(flowOf(r,NOW+61000).income,base);
 r.reactor.upgrades.range=2;almost(flowOf(r,NOW+61000).income,base*2);
});
test('offline pulse integration gives the same money as frequent status calls', () => {
 const a=unlocked();a.reactor.upgrades.range=2;a.reactor.upgrades.power=2;
 const b=structuredClone(a);
 advanceRun(a,NOW+2*3600000+7311);
 for(let now=NOW+1379;now<NOW+2*3600000+7311;now+=1379) advanceRun(b,now);
 advanceRun(b,NOW+2*3600000+7311);almost(a.credits,b.credits);almost(a.stageEarned,b.stageEarned);
});
test('operator endings split offline integration, no permanent buff or extra cores while offline', () => {
 const a=unlocked();a.reactor.upgrades.range=2;a.reactor.upgrades.slots=2;
 act(a,'operator-assign','ion',NOW,{slot:0});act(a,'operator-assign','talia',NOW,{slot:1});
 act(a,'operator-activate','ion',NOW+50000);act(a,'operator-activate','talia',NOW+56000);
 const b=structuredClone(a);
 advanceRun(a,NOW+240000);for(let t=NOW+56001;t<=NOW+240000;t+=1)advanceRun(b,t);
 almost(a.credits,b.credits);assert.equal(a.reactor.cores,2);assert.equal(a.reactor.operators.ion.uses,1);
 almost(flowOf(a,NOW+240001,false).income,flowOf(unlocked(),NOW,false).income);
});
test('mid-pulse upgrade cannot retroactively reprice the interval already elapsed', () => {
 const r=unlocked();r.reactor.upgrades.range=2;r.reactor.cores=10;
 const baseline=structuredClone(r);advanceRun(baseline,NOW+66000);
 act(r,'reactor-upgrade','power',NOW+66000);almost(r.credits,baseline.credits);
 const prior=r.credits, base=flowOf(r,NOW+66000,false).income;
 advanceRun(r,NOW+67000);almost(r.credits-prior,base*3);
});
test('pulse and operator stack only on targets and respect the same minimum throughput', () => {
 const r=unlocked();r.reactor.upgrades.range=2;
 act(r,'operator-assign','ion',NOW,{slot:0});act(r,'operator-activate','ion',NOW+59000);
 const f=flowOf(r,NOW+61000);assert.equal(f.bottleneck,'logistics');
 almost(f.income,3.5*2.5*2);
});
test('offline cap clips automatic pulses and expiry clips income at the weekly end', () => {
 const r=unlocked();r.reactor.upgrades.range=2;
 const capped=structuredClone(r);advanceRun(r,NOW+86400000);advanceRun(capped,NOW+4*3600000);almost(r.credits,capped.credits);
 const end=unlocked(eventAt(NOW).endsAt-65000);end.reactor.upgrades.range=2;
 const inTime=structuredClone(end);advanceRun(end,eventAt(NOW).endsAt+86400000);advanceRun(inTime,eventAt(NOW).endsAt);almost(end.credits,inTime.credits);
 assert.throws(()=>act(end,'operator-assign','rook',eventAt(NOW).endsAt,{slot:0}),/EVENT_CLOSED/);
});
test('completion preserves reactor upgrades, assignments and cooldown across sites', () => {
 const r=unlocked();r.reactor.cores=10;act(r,'reactor-upgrade','range');act(r,'operator-assign','rook',NOW,{slot:0});act(r,'operator-activate','rook');
 const state=JSON.stringify(r.reactor);r.stageEarned=5000;r.levels={extraction:8,lift:8,logistics:8};act(r,'complete',undefined,NOW+1000);
 assert.equal(r.stageIndex,2);assert.equal(JSON.stringify(r.reactor),state);
});
test('finished run produces no reactor income and rejects new activations/upgrades', () => {
 const r=unlocked();r.reactor.upgrades.range=2;r.completedAt=NOW;
 const credits=r.credits;advanceRun(r,NOW+3600000);assert.equal(r.credits,credits);
 assert.throws(()=>act(r,'reactor-upgrade','power',NOW+3600000),/RUN_COMPLETE/);
 assert.equal(reactorView(r,NOW+3600000).pulse.active,false);
});
test('simultaneous retries serialize to one activation and persist across service instances', async () => {
 const repo=new MemoryRiftRepository(),svc=new RiftService(repo,()=>NOW),g=await svc.register('Miner');await svc.start(g.playerId,eventAt(NOW).id);
 await repo.withPlayer(g.playerId,async tx=>{tx.player.run.stageIndex=1;unlockReactor(tx.player.run,NOW);});
 let s=await svc.status(g.playerId);s=await svc.action(g.playerId,{requestId:randomUUID(),eventId:s.event.id,revision:s.run.revision,kind:'operator-assign',target:'rook',slot:0});
 const c={requestId:randomUUID(),eventId:s.event.id,revision:s.run.revision,kind:'operator-activate',target:'rook'};
 await Promise.all([svc.action(g.playerId,c),svc.action(g.playerId,c)]);
 const reopened=new RiftService(repo,()=>NOW);s=await reopened.status(g.playerId);
 assert.equal(s.reactor.cores,1);assert.equal(s.reactor.operators.find(o=>o.id==='rook').uses,1);assert.equal(s.apiVersion,17);
});
test('failed reactor command rolls back credits, cores, revision and slot together', async () => {
 const repo=new MemoryRiftRepository(),svc=new RiftService(repo,()=>NOW),g=await svc.register('Miner');await svc.start(g.playerId,eventAt(NOW).id);
 await repo.withPlayer(g.playerId,async tx=>{tx.player.run.stageIndex=1;unlockReactor(tx.player.run,NOW);});
 const before=await svc.status(g.playerId);
 await assert.rejects(()=>svc.action(g.playerId,{requestId:randomUUID(),eventId:before.event.id,revision:before.run.revision,kind:'reactor-upgrade',target:'slots'}),/NOT_ENOUGH_REACTOR_CORES/);
 assert.deepEqual(await svc.status(g.playerId),before);
});
test('legacy and Reactor runs are allocated distinct rating cohorts, next week migrates naturally', async () => {
 let now=NOW;const repo=new MemoryRiftRepository(),svc=new RiftService(repo,()=>now);
 const old=await svc.register('Legacy'),fresh=await svc.register('Reactor');
 await repo.withPlayer(old.playerId,async tx=>{tx.player.run=createRun(now,await tx.allocateGroup(eventAt(now).id),1);});
 let v2=await svc.start(fresh.playerId,eventAt(now).id),v1=await svc.status(old.playerId);
 assert.equal(v1.run.rulesVersion,1);assert.equal(v2.run.rulesVersion,2);assert.notEqual(v1.board.group,v2.board.group);assert.equal(v2.board.participants,1);
 now=eventAt(NOW).endsAt+1000;v1=await svc.start(old.playerId,eventAt(now).id);
 assert.equal(v1.run.rulesVersion,2);assert.equal(v1.reactor.cores,0);assert.equal(v1.reactor.unlocked,false);assert.equal(v1.previous.eventId,eventAt(NOW).id);
});
test('all six operators can be earned/used and a fully upgraded reactor survives serialization', () => {
 const r=unlocked();r.stageIndex=4;r.reactor.upgrades.slots=2;
 let t=NOW;
 for(const o of RIFT_OPERATORS) { act(r,'operator-assign',o.id,t,{slot:0});act(r,'operator-activate',o.id,t);t+=130000;act(r,'operator-assign','none',t,{slot:0}); }
 assert.equal(r.reactor.earnedCores,9);
 const parsed=JSON.parse(JSON.stringify(r));assert.deepEqual(parsed.reactor,r.reactor);almost(flowOf(parsed,t).income,flowOf(r,t).income);
});
test('full new expedition uses reactor commands and completes all five sites legitimately', () => {
 const r=createRun(NOW,'R2-0001'),w=emptyWallet();let now=NOW;
 const use=(kind,target,extra={})=>applyAction(r,w,command(r,kind,target,extra),now);
 for(let step=0;step<5000&&r.completedAt===null;step++) {
  now+=5000;advanceRun(r,now);
  if(r.reactor.unlockedAt!==null) {
    if(!r.reactor.slots[0])use('operator-assign','rook',{slot:0});
    if(r.reactor.upgrades.slots>0&&!r.reactor.slots[1])use('operator-assign','ion',{slot:1});
    if(r.reactor.upgrades.slots>1&&!r.reactor.slots[2])use('operator-assign','talia',{slot:2});
    for(const id of r.reactor.slots)if(id&&r.reactor.operators[id].readyAt<=now)use('operator-activate',id);
    for(const id of ['range','slots','power']) {
      const cost=REACTOR_COSTS[id][r.reactor.upgrades[id]];
      if(cost!==undefined&&r.reactor.cores>=cost)use('reactor-upgrade',id);
    }
  }
  // Всё покупается за реально начисленные кредиты, никакой тестовой выдачи денег.
  const stage=RIFT_STAGES[r.stageIndex];
  for(const facility of ['extraction','lift','logistics']) {
    for(let j=r.levels[facility];j<stage.minLevel;j++) {
      try{use('upgrade',facility,{count:1});}catch(error){if(error.code==='NOT_ENOUGH_CREDITS')break;throw error;}
    }
  }
  if(r.stageEarned>=stage.target&&Object.values(r.levels).every(v=>v>=stage.minLevel))use('complete');
 }
 assert.ok(r.completedAt!==null);assert.ok(r.reactor.earnedCores>0);assert.ok(r.reactor.upgrades.range>0);
 console.log(`Reactor expedition: ${((r.completedAt-NOW)/60000).toFixed(1)} simulated minutes; ${r.reactor.earnedCores} cores earned; ${r.score} score.`);
});
