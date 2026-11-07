import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { SpiritRush } from '../src/simulation/ahri-spirit-rush';
import type { Team } from '../src/simulation/types';
import {
  type AhriRVisualHistory,
  beginRVisualHistory,
  observeRVisualReset,
  sampleRVisualDash,
  endRVisualDash,
  sampleRVisualBolt,
  endRVisualBolt,
  endRVisualWindow,
  advanceRVisualHistory,
  refreshRVisualAudience,
  pruneRVisualHistory,
  endRVisualTarget,
  finishAllRVisualHistory,
} from '../src/simulation/ahri-r-visual-history';

/** Unconnected observer harness. Cast notifications occur before dash motion;
 * damage is intercepted before the genuine callback. Gameplay code is unchanged. */
function fixture(options: { team?: Team; hidden?: boolean; lethal?: boolean } = {}) {
  let revealed = !options.hidden;
  const field = {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => revealed,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p: { x: number; y: number }) => ({ ...p }),
    findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
  };
  const w = new World(false, field);
  const visual = Object.assign(Object.create(w) as typeof w, {
    ahriRVisuals: [] as AhriRVisualHistory[],
  });
  w.nextWaveTick = 1e9;
  w.random.state = 927;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const team = options.team ?? 'blue';
  const source = w.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  w.gainExperience(1e6, source.id);
  w.learnSpell('r', source.id);
  const target = options.lethal
    ? w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 20, y: 0 }, 'lux')
    : w.spawn('dummy', team === 'blue' ? 'red' : 'blue', { x: 600, y: 0 });
  Object.assign(target, {
    ai: false,
    hp: options.lethal ? 1 : 10000,
    maxHp: 10000,
    magicResist: 0,
  });
  const contexts = new Map<number, SpiritRush>();
  const emit = w.emit.bind(w);
  w.emit = (type, p, data = {}) => {
    emit(type, p, data);
    if (type === 'cast' && data.champion === 'ahri' && data.text === 'r') {
      const rush = w.ahriRushes.find((r) => r.sourceId === data.unit)!;
      contexts.set(rush.id, rush);
      const stable = w.snapshot();
      beginRVisualHistory(visual, rush, rush.bursts.at(-1)!, w.unit(rush.sourceId)!);
      expect(w.snapshot()).toBe(stable);
    }
  };
  const damage = w.damage.bind(w);
  w.damage = (actor, victim, raw, kind, category) => {
    for (const rush of contexts.values())
      for (const burst of rush.bursts)
        for (const bolt of burst.bolts)
          if (bolt.targetId === victim.id && bolt.stopTick === w.tick && bolt.stopReason === 'hit')
            endRVisualBolt(visual, rush, burst, bolt, victim);
    damage(actor, victim, raw, kind, category);
    if (victim.hp <= 0) endRVisualTarget(visual, victim, 'death');
    if (w.winner) finishAllRVisualHistory(visual);
  };
  function observe(checkPure = true) {
    const stable = checkPure ? w.snapshot() : null;
    const identity = w.nextId,
      random = w.random.state;
    for (const rush of contexts.values()) {
      const actor = w.unit(rush.sourceId)!;
      if (rush.stopTick !== null) endRVisualWindow(visual, rush);
      for (const reset of rush.resets)
        if (
          reset.consumeTick === w.tick &&
          !visual.ahriRVisuals
            .find((r) => r.id === rush.id)
            ?.changes.some((c) => c.reset?.essenceId === reset.essenceId)
        )
          observeRVisualReset(visual, rush, reset);
      for (const burst of rush.bursts) {
        if (burst.stopTick === null) sampleRVisualDash(visual, rush, burst, actor);
        else if (burst.stopTick === w.tick)
          endRVisualDash(visual, rush, burst, {
            ...actor,
            x: burst.stopPoint!.x,
            y: burst.stopPoint!.y,
          });
        for (const bolt of burst.bolts) {
          if (bolt.stopTick === null) sampleRVisualBolt(visual, rush, burst, bolt);
          else if (bolt.stopTick === w.tick && bolt.stopReason !== 'hit')
            endRVisualBolt(visual, rush, burst, bolt);
        }
      }
    }
    advanceRVisualHistory(visual);
    refreshRVisualAudience(visual);
    pruneRVisualHistory(visual);
    if (stable !== null) expect(w.snapshot()).toBe(stable);
    expect(w.nextId).toBe(identity);
    expect(w.random.state).toBe(random);
  }
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      w.step();
      observe(w.tick <= 32 || w.tick % 120 === 0);
    }
  };
  const cast = () =>
    w.enqueue({ type: 'cast', unit: source.id, ability: 'r', point: { x: 900, y: 0 } });
  return {
    w,
    visual,
    source,
    target,
    contexts,
    step,
    observe,
    cast,
    reveal: () => {
      revealed = true;
    },
  };
}

test('R observer is optional and cannot consume gameplay identities or random draws', () => {
  const f = fixture();
  f.cast();
  f.step();
  const rush = f.w.ahriRushes[0],
    burst = rush.bursts[0];
  const empty = { tick: f.w.tick };
  expect(() => beginRVisualHistory(empty, rush, burst, f.source)).not.toThrow();
  expect(() => sampleRVisualBolt(empty, rush, burst, burst.bolts[0])).not.toThrow();
  expect(() => finishAllRVisualHistory(empty)).not.toThrow();
  const stable = f.w.snapshot(),
    next = f.w.nextId,
    random = f.w.random.state;
  f.observe();
  expect(f.w.snapshot()).toBe(stable);
  expect(f.w.nextId).toBe(next);
  expect(f.w.random.state).toBe(random);
});
test('accepted births retain the pre-move root and own every nested pose independently', () => {
  const f = fixture();
  f.step();
  f.cast();
  f.step();
  const r = f.visual.ahriRVisuals[0],
    b = r.bursts[0];
  expect(r.birthPose.point).toEqual({ x: 0, y: 0 });
  expect(r.sourceFrames.at(-1)!.point.x).toBeGreaterThan(0);
  expect(b.bolts[0].birth.point).toEqual({ x: 0, y: 0 });
  expect(b.bolts[0].frames[0].previous).toEqual({ x: 0, y: 0 });
  r.birthPose.point.x = 999;
  expect(b.sourcePose.point.x).toBe(0);
  expect(r.changes[0].pose.point.x).toBe(0);
  const current = f.source.animationTimeline!;
  // Exercise nested outgoing-layer ownership explicitly; the R body itself cuts.
  current.transition = { startTick: f.w.tick, outgoing: [{ ...current.primary, weight: 1 }] };
  advanceRVisualHistory(f.visual);
  const last = r.sourceFrames.at(-1)!;
  const saved = JSON.stringify(last.animationTimeline);
  const time = current.primary.time;
  current.primary.time += 10;
  expect(JSON.stringify(last.animationTimeline)).toBe(saved);
  current.primary.time = time;
  const outgoing = current.transition!.outgoing[0];
  const weight = outgoing.weight;
  outgoing.weight = 0;
  expect(JSON.stringify(last.animationTimeline)).toBe(saved);
  outgoing.weight = weight;
  f.step(6);
  expect(JSON.stringify(last.animationTimeline)).toBe(saved);
  expect(last.animationTimeline).not.toBe(f.source.animationTimeline);
});
test('source death freezes its old body while already committed bolts finish', () => {
  const f = fixture();
  f.cast();
  f.step(5);
  const r = f.visual.ahriRVisuals[0];
  f.w.damage(f.target, f.source, 1e6, 'true');
  f.observe();
  expect(r.end!.reason).toBe('death');
  expect(r.sourceEnd!.reason).toBe('death');
  const ended = JSON.stringify(r.sourceEnd);
  f.step(50);
  expect(r.bursts[0].bolts[0].end!.reason).toBe('hit');
  f.source.hp = f.source.maxHp;
  f.source.deadAt = null;
  f.source.x = 900;
  f.observe();
  expect(JSON.stringify(r.sourceEnd)).toBe(ended);
  expect(r.sourceFrames.at(-1)!.point.x).not.toBe(900);
});
test('real contact is captured before lethal damage and its old body never follows a respawn', () => {
  const f = fixture({ lethal: true });
  f.cast();
  f.step();
  const r = f.visual.ahriRVisuals[0],
    b = r.bursts[0].bolts[0];
  expect(f.target.hp).toBe(0);
  expect(b.end!.reason).toBe('hit');
  expect(b.hit!.pose.point).toEqual({ x: 20, y: 0 });
  expect(b.targetEnd!.reason).toBe('death');
  expect(b.hit!.pose).not.toBe(b.targetEnd!.pose);
  const frozen = JSON.stringify(b.targetEnd);
  f.target.x = 9000;
  f.target.hp = 10000;
  f.target.deadAt = null;
  f.step();
  expect(JSON.stringify(b.targetEnd)).toBe(frozen);
  expect(b.targetFrames.at(-1)!.point.x).toBe(20);
});
test('actual Flash ends the dash before teleport while its committed bolt continues', () => {
  const f = fixture();
  f.cast();
  f.step(5);
  const r = f.visual.ahriRVisuals[0],
    b = r.bursts[0];
  const before = f.source.x;
  f.w.enqueue({
    type: 'cast',
    unit: f.source.id,
    ability: f.w.summonerSlot('flash', f.source.id)!,
    point: { x: -100, y: 0 },
  });
  f.step();
  expect(b.dashEnd!.reason).toBe('flash');
  expect(b.dashEnd!.point.x).toBe(before);
  expect(b.dashFrames.at(-1)!.point.x).toBe(before);
  expect(f.source.x).toBe(-100);
  expect(r.sourceFrames.at(-1)!.point.x).toBe(-100);
  expect(b.bolts[0].end).toBe(null);
  f.step(40);
  expect(b.bolts[0].end!.reason).toBe('hit');
});
test('hidden birth ownership stays immutable when the source becomes visible later', () => {
  const f = fixture({ team: 'red', hidden: true });
  f.cast();
  f.step();
  const r = f.visual.ahriRVisuals[0];
  expect(r.birthPose.audience).toEqual(['red']);
  f.reveal();
  f.step();
  expect(r.birthPose.audience).toEqual(['red']);
  expect(r.sourceFrames.at(-1)!.audience).toContain('blue');
});
test('repeated real Essence extensions keep only bounded poses and recent burst tails', () => {
  const f = fixture();
  f.cast();
  f.step();
  const r = f.visual.ahriRVisuals[0],
    birth = JSON.stringify(r.birthPose);
  for (let tick = 2; tick <= 2400; tick++) {
    if (tick % 500 === 0) {
      const victim = f.w.spawn('champion', 'red', { x: f.source.x, y: f.source.y }, 'lux');
      victim.ai = false;
      f.w.damage(f.source, victim, 1e6, 'true');
    }
    f.step();
  }
  expect(f.w.ahriRushes[0].endTick).toBeGreaterThan(f.w.tick);
  expect(r.windowEndTick).toBe(f.w.ahriRushes[0].endTick);
  expect(r.remainingCasts).toBe(f.w.ahriRushes[0].remainingCasts);
  expect(r.changes.at(-1)!.kind).toBe('essence');
  expect(r.sourceFrames.length).toBe(721);
  expect(r.sourceFrames[0].tick).toBe(f.w.tick - 720);
  expect(r.bursts).toEqual([]);
  expect(r.changes.length).toBeLessThanOrEqual(3);
  expect(JSON.stringify(r.birthPose)).toBe(birth);
  expect(r.end).toBe(null);
});
test('terminal settlement freezes actual endpoints without an extra movement frame', () => {
  const f = fixture();
  f.cast();
  f.step(2);
  const r = f.visual.ahriRVisuals[0],
    bolt = r.bursts[0].bolts[0];
  const count = bolt.frames.length,
    last = { ...bolt.frames.at(-1)!.point };
  const nexus = f.w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  f.w.damage(f.w.hero, nexus, 1e6, 'true');
  expect(f.w.winner).toBe('blue');
  expect(r.end!.reason).toBe('match-end');
  expect(bolt.end!.reason).toBe('match-end');
  expect(bolt.end!.point).toEqual(last);
  expect(bolt.frames.length).toBe(count);
  const frozen = JSON.stringify(r);
  finishAllRVisualHistory(f.visual);
  expect(JSON.stringify(r)).toBe(frozen);
});
