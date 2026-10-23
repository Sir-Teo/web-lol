import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NavGrid } from '../src/simulation/navgrid';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { Random } from '../src/simulation/math';
import { World } from '../src/simulation/world';
import { riverContains, riverHome, shrinePoint, selectedRiver } from '../src/simulation/scuttler';
import { SCUTTLER_POLICY as P, RIVER_SIDES } from '../src/content/scuttler-policy';
import { mobilePose } from '../src/render/mobile-pose';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function lane(ready = true) {
  const w = createLaneMatch(rift, 'lux');
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  if (ready) {
    w.tick = P.firstReadyTick - 1;
    w.step(10);
  }
  return w;
}
function crab(w: World, side: 'dragon' | 'baron' = 'dragon') {
  return w.unit(w.scuttlers!.unitIds[side]!)!;
}
function kill(w: World, side: 'dragon' | 'baron' = 'dragon') {
  w.damage(w.hero, crab(w, side), 99999, 'true');
}

test('paired river birth preserves hidden lead-in, emergence, protection and source tail through exact reload', () => {
  const w = lane(false);
  w.tick = P.firstReadyTick - P.leadupTicks - 1;
  w.step();
  expect(w.scuttlers!.pending).toBeNull();
  expect(Object.values(w.scuttlers!.unitIds).filter(Boolean)).toHaveLength(2);
  Object.assign(w.hero, { x: crab(w).x, y: crab(w).y });
  expect(w.visible(crab(w))).toBe(false);
  for (const side of RIVER_SIDES) {
    const u = crab(w, side);
    expect(u.monster!.home).toEqual(riverHome(side, rift));
    expect(mobilePose(u, undefined, w.tick, 1, mobileClipDurations(u)!).clip).toBe('hide');
    w.damage(w.hero, u, 99999, 'true');
    expect(u.hp).toBe(u.maxHp);
  }
  w.step(P.hiddenTicks);
  expect(w.visible(crab(w))).toBe(true);
  for (const side of RIVER_SIDES)
    expect(
      mobilePose(crab(w, side), undefined, w.tick, 1, mobileClipDurations(crab(w, side))!).clip
    ).toBe('spawn');
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(P.untargetableEmergenceTicks);
  copy.step(P.untargetableEmergenceTicks);
  expect(copy.snapshot()).toBe(w.snapshot());
  for (const side of RIVER_SIDES) {
    expect(w.vulnerable(crab(w, side))).toBe(true);
    expect(crab(w, side).monster!.spawn).not.toBeNull();
  }
  w.step(10);
  for (const side of RIVER_SIDES) expect(crab(w, side).monster!.spawn).toBeNull();
});

test('peaceful patrol bounces through source waypoints, stays in its river and restores a moving checkpoint exactly', () => {
  const w = lane(),
    seen = { dragon: new Set<number>(), baron: new Set<number>() };
  for (let i = 0; i < 2400; i++) {
    w.step();
    for (const side of RIVER_SIDES) {
      const u = crab(w, side);
      expect(riverContains(side, u)).toBe(true);
      seen[side].add(u.monster!.scuttle!.destination);
    }
  }
  for (const side of RIVER_SIDES) expect(seen[side].size).toBe(5);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.events.filter((e) => e.type === 'damage' && e.team === 'neutral')).toEqual([]);
});

test('damage causes fleeing without attack windups, controls stop movement and the saved flee clock resumes', () => {
  const w = lane(),
    u = crab(w);
  Object.assign(w.hero, rift.reachable({ x: u.x - 150, y: u.y + 100 }, w.hero.radius));
  const hp = w.hero.hp;
  w.damage(w.hero, u, 10, 'true');
  w.step();
  expect(u.monster!.phase).toBe('engaged');
  expect(u.monster!.scuttle!.fleeUntil).toBe(w.tick - 1 + P.fleeTicks);
  expect(u.releaseTick).toBeNull();
  expect(u.attackCycle).toBeNull();
  w.applyRoot(u, 60);
  const point = { x: u.x, y: u.y };
  w.step(30);
  expect({ x: u.x, y: u.y }).toEqual(point);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(100);
  copy.step(100);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.hero.hp).toBeGreaterThanOrEqual(hp);
  expect(u.releaseTick).toBeNull();
  expect(u.attackCycle).toBeNull();
});

test('one initial death creates an owned shrine and waits for the other river before scheduling one later spawn', () => {
  const w = lane(),
    other = crab(w, 'baron').id,
    before = { gold: w.player.gold, xp: w.player.xp };
  kill(w);
  expect(w.player.gold - before.gold).toBeCloseTo(55);
  expect(w.player.xp - before.xp).toBe(100);
  expect(w.player.cs).toBe(4);
  expect(w.scuttlers!.pending).toBeNull();
  expect(w.scuttlers!.initialDeaths).toBe(1);
  expect(crab(w, 'baron').id).toBe(other);
  expect(w.scuttlers!.shrines).toMatchObject([
    { river: 'dragon', team: 'blue', startTick: w.tick, endTick: w.tick + P.shrineTicks },
  ]);
  w.step(100);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  kill(w, 'baron');
  kill(copy, 'baron');
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.scuttlers!.initialDeaths).toBe(2);
  expect(w.scuttlers!.pending!.side).not.toBe('both');
  expect(w.scuttlers!.pending!.readyTick).toBe(w.tick + P.respawnTicks);
  const forged = JSON.parse(w.snapshot());
  forged.scuttlers.pending.readyTick--;
  expect(() => World.fromSnapshot(JSON.stringify(forged), rift)).toThrow();
  const ready = w.scuttlers!.pending!.readyTick;
  for (const world of [w, copy]) {
    world.tick = ready - P.leadupTicks - 1;
    world.step(P.leadupTicks + 10);
    expect(Object.values(world.scuttlers!.unitIds).filter((id) => id !== null)).toHaveLength(1);
    expect(world.scuttlers!.shrines).toEqual([]);
  }
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('selected later river uses saved RNG and a streak-biased one-location schedule across repeated clears', () => {
  const w = lane();
  kill(w);
  kill(w, 'baron');
  for (let i = 0; i < 7; i++) {
    const state = w.scuttlers!,
      side = state.pending!.side;
    expect(side).not.toBe('both');
    const ready = state.pending!.readyTick;
    w.tick = ready - P.leadupTicks - 1;
    w.step(P.leadupTicks + 10);
    const current = state.streakSide!;
    expect(state.unitIds[current]).not.toBeNull();
    const copy = World.fromSnapshot(w.snapshot(), rift);
    kill(w, current);
    kill(copy, current);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(state.pending!.side).not.toBe('both');
  }
});

test('shrines grant team vision and a saved 30 percent movement bonus with exact two-second exit linger', () => {
  const w = lane();
  kill(w);
  const point = shrinePoint('dragon', rift);
  for (const u of w.units.filter((u) => u.kind === 'champion'))
    Object.assign(u, u.team === 'blue' ? rift.spawns.blue : rift.spawns.red);
  expect(w.pointVisible(point, 'blue')).toBe(true);
  expect(w.pointVisible(point, 'red')).toBe(false);
  Object.assign(w.hero, point);
  const speed = w.hero.speed;
  w.step();
  expect(w.movementSpeed(w.hero)).toBeCloseTo(speed * 1.3);
  Object.assign(w.hero, rift.spawns.blue);
  const until = w.scuttlers!.speedBuffs.find((s) => s.unitId === w.hero.id)!.endTick;
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(until - w.tick - 1);
  copy.step(until - copy.tick - 1);
  expect(w.movementSpeed(w.hero)).toBeCloseTo(speed * 1.3);
  w.step();
  copy.step();
  expect(w.movementSpeed(w.hero)).toBe(speed);
  expect(copy.snapshot()).toBe(w.snapshot());
  const expiry = w.scuttlers!.shrines[0].endTick;
  w.tick = expiry - 1;
  w.step();
  expect(w.scuttlers!.shrines).toEqual([]);
  expect(w.pointVisible(point, 'blue')).toBe(false);
});

test('snapshot rejects crossed rivers, invented attacks, invalid clocks, duplicate shrines and premature single spawn', () => {
  const w = lane(),
    u = crab(w),
    data = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => {
      s.scuttlers.unitIds.baron = s.scuttlers.unitIds.dragon;
    },
    (s: any) => {
      s.scuttlers.initialDeaths = 2;
    },
    (s: any) => {
      s.scuttlers.pending = { side: 'dragon', readyTick: s.tick + 9000 };
    },
    (s: any) => {
      s.units.find((v: any) => v.id === u.id).monster.scuttle.destination = 5;
    },
    (s: any) => {
      s.units.find((v: any) => v.id === u.id).order = { type: 'attack', target: s.player.id };
    },
  ]) {
    const s = structuredClone(data);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
  }
  kill(w);
  const s = JSON.parse(w.snapshot());
  s.scuttlers.shrines.push(structuredClone(s.scuttlers.shrines[0]));
  expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
});

test('legacy probability thresholds are exact and the first death also advances saved selection RNG', () => {
  expect(selectedRiver(null, 0, 50)).toBe('dragon');
  expect(selectedRiver(null, 0, 51)).toBe('baron');
  expect(selectedRiver('dragon', 4, 25)).toBe('dragon');
  expect(selectedRiver('dragon', 4, 26)).toBe('baron');
  expect(selectedRiver('baron', 4, 75)).toBe('dragon');
  expect(selectedRiver('baron', 4, 76)).toBe('baron');
  const w = lane(),
    rng = new Random(w.random.state),
    side = selectedRiver(null, 0, Math.floor(rng.next() * 100) + 1);
  kill(w);
  expect(w.random.state).toBe(rng.state);
  expect(w.scuttlers!.streakSide).toBe(side);
  expect(w.scuttlers!.pending).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
});

test('enemy-owned shrine grants enemy vision/speed only, combines additive bonuses and clears speed on death', () => {
  const w = lane(),
    red = w.units.find((u) => u.kind === 'champion' && u.team === 'red')!,
    point = shrinePoint('dragon', rift);
  w.damage(red, crab(w), 99999, 'true');
  expect(w.scuttlers!.shrines[0].team).toBe('red');
  expect(w.pointVisible(point, 'red')).toBe(true);
  expect(w.pointVisible(point, 'blue')).toBe(false);
  Object.assign(red, point);
  Object.assign(w.hero, point);
  w.step();
  expect(w.movementSpeed(red)).toBeCloseTo(red.speed * 1.3);
  expect(w.movementSpeed(w.hero)).toBe(w.hero.speed);
  red.summonerHealSpeedUntil = w.tick + 30;
  expect(w.movementSpeed(red)).toBeCloseTo(red.speed * 1.6);
  w.damage(w.hero, red, 99999, 'true');
  expect(w.scuttlers!.speedBuffs.some((b) => b.unitId === red.id)).toBe(false);
  expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
});

test('out-of-combat recovery starts on its deadline and resumes with the saved movement phase', () => {
  const w = lane(),
    u = crab(w);
  w.damage(w.hero, u, 100, 'true');
  const hp = u.hp;
  w.step(P.regenDelayTicks - 1);
  expect(u.hp).toBe(hp);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step();
  copy.step();
  expect(u.hp).toBeCloseTo(hp + (u.maxHp * P.regenFractionPerSecond) / 60);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('posthumous damage preserves peaceful Scuttler patrol and restarts its recovery clock', () => {
  const w = lane(),
    u = crab(w);
  const enemy = w.units.find((unit) => unit.kind === 'champion' && unit.team === 'red')!;
  w.damage(enemy, w.hero, 99999, 'true');
  const hp = u.hp;
  w.damage(w.hero, u, 100, 'true', 'proc');
  expect(u.hp).toBe(hp - 100);
  expect(u.monster!.phase).toBe('idle');
  expect(u.monster!.targetId).toBeNull();
  expect(u.monster!.scuttle!.lastDamageTick).toBe(w.tick);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(P.regenDelayTicks);
  copy.step(P.regenDelayTicks);
  expect(u.hp).toBeCloseTo(hp - 100 + (u.maxHp * P.regenFractionPerSecond) / 60);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('grazing expires during crowd control without leaving an unrestorable checkpoint', () => {
  const w = lane(),
    u = crab(w);
  for (let i = 0; i < 2400 && u.monster!.scuttle!.grazeUntil === null; i++) w.step();
  const until = u.monster!.scuttle!.grazeUntil;
  expect(until).not.toBeNull();
  w.applyRoot(u, P.grazeTicks + 30);
  const point = { x: u.x, y: u.y };
  w.step(until! - w.tick);
  expect({ x: u.x, y: u.y }).toEqual(point);
  expect(u.monster!.scuttle!.grazeUntil).toBeNull();
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(120);
  copy.step(120);
  expect(copy.snapshot()).toBe(w.snapshot());
});
