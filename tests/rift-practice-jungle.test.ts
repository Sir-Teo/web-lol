import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createRift } from '../src/content/rift';
import { RIFT_CAMPS, campLeadupTicks } from '../src/content/rift-camps';
import { SCUTTLER_POLICY } from '../src/content/scuttler-policy';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
import { createLaneMatch } from '../src/simulation/lane-match';
import { equipSummoners } from '../src/simulation/smite';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function practice(populate = false) {
  const w = new World(populate, rift, 'lux');
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  return w;
}
function resume(w: World, ticks = 60) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, rift);
  expect(copy.snapshot()).toBe(saved);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
}

test('populated and bare Rift practice share lane camp clocks without sharing mutable ownership', () => {
  const lanes = createLaneMatch(rift),
    a = practice(),
    b = practice(true);
  for (const w of [a, b]) {
    expect(w.matchMode).toBe('practice');
    expect(w.jungleCamps).toEqual(lanes.jungleCamps);
    expect(w.scuttlers).toEqual(lanes.scuttlers);
    expect(w.units.some((u) => u.kind === 'monster')).toBe(false);
    resume(w);
  }
  a.jungleCamps[0].unitIds[0] = 123;
  a.scuttlers!.unitIds.dragon = 124;
  expect(b.jungleCamps[0].unitIds[0]).toBeNull();
  expect(lanes.jungleCamps[0].unitIds[0]).toBeNull();
  expect(b.scuttlers!.unitIds.dragon).toBeNull();
});

test('practice preserves the first source deadlines, protected emergence and all twelve packs plus both rivers', () => {
  const w = practice();
  const firstBirth = Math.min(...RIFT_CAMPS.map((c) => c.firstReadyTick - campLeadupTicks(c)));
  w.tick = firstBirth - 2;
  w.step();
  expect(w.units.filter((u) => u.kind === 'monster')).toHaveLength(0);
  resume(w, 1);
  const emerging = w.units.filter((u) => u.kind === 'monster');
  expect(emerging.length).toBeGreaterThan(0);
  for (const u of emerging) {
    expect(u.monster!.phase).toBe('spawning');
    expect(w.vulnerable(u)).toBe(false);
  }
  resume(w, 120);
  w.tick = SCUTTLER_POLICY.firstReadyTick - 1;
  w.step(20);
  expect(w.jungleCamps).toHaveLength(12);
  expect(w.jungleCamps.every((c) => c.nextSpawnTick === null)).toBe(true);
  expect(w.units.filter((u) => u.kind === 'monster')).toHaveLength(30);
  expect(Object.values(w.scuttlers!.unitIds).filter((id) => id !== null)).toHaveLength(2);
  for (const [i, c] of w.jungleCamps.entries()) {
    expect(c.unitIds.filter((id) => id !== null)).toHaveLength(RIFT_CAMPS[i].initialMemberCount);
    for (const id of c.unitIds.filter((id) => id !== null)) {
      expect(w.unit(id!)!.monster!.phase).toBe('idle');
      expect(w.vulnerable(w.unit(id!)!)).toBe(true);
    }
  }
  resume(w, 180);
});

for (const kind of ['gustwalker', 'scorchclaw', 'mosstomper'] as const)
  test(`ordinary practice ${kind} purchase earns food from a scheduled Smite clear and restores its respawn`, () => {
    const w = practice(true);
    equipSummoners(w.player, { d: 'flash', f: 'smite' });
    expect(w.buy(kind)).toBeNull();
    resume(w);
    w.tick = Math.max(5399, w.companions[0].nextTreatTick! - 1);
    w.step(12);
    const camp = w.jungleCamps.find((c) => c.id === 'order-gromp')!;
    const u = w.unit(camp.unitIds[0]!)!;
    const point = rift.reachable({ x: u.x + 220, y: u.y }, w.hero.radius, 'blue');
    Object.assign(w.hero, point, { previous: { ...point } });
    u.hp = 600;
    expect(w.visible(u)).toBe(true);
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'f',
      point: { x: u.x, y: u.y },
      targetId: u.id,
    });
    w.step();
    expect(u.hp).toBe(0);
    expect(w.companions[0].fed).toBe(2);
    expect(w.player.cs).toBe(4);
    expect(camp.unitIds).toEqual([null]);
    expect(camp.nextSpawnTick).toBe(w.tick + RIFT_CAMPS[0].respawnTicks);
    const deathTick = w.tick;
    resume(w, 400);
    expect(w.unit(u.id)).toBeUndefined();
    expect(w.companions[0].fed).toBe(2);
    const deadline = camp.nextSpawnTick!;
    w.step(deadline - 2 - w.tick);
    resume(w, 1);
    expect(w.unit(camp.unitIds[0]!)!.monster!.phase).toBe('spawning');
    resume(w, 1);
    expect(w.unit(camp.unitIds[0]!)!).toMatchObject({ hp: u.maxHp, monster: { phase: 'idle' } });
    expect(camp.unitIds[0]).not.toBe(u.id);
    expect(w.tick - deathTick).toBe(RIFT_CAMPS[0].respawnTicks);
    expect(w.companions[0].fed).toBe(2);
  });

test('practice retains an engaged purchased companion and camp leash recovery through exact checkpoints', () => {
  const w = practice();
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  expect(w.buy('mosstomper')).toBeNull();
  w.tick = RIFT_CAMPS[0].firstReadyTick - 1;
  w.step();
  const camp = w.jungleCamps[0],
    u = w.unit(camp.unitIds[0]!)!;
  const point = rift.reachable({ x: u.x + 250, y: u.y }, w.hero.radius, 'blue');
  Object.assign(w.hero, point, { previous: { ...point } });
  w.damage(w.hero, u, 10, 'true');
  w.step(10);
  expect(u.monster!.phase).toBe('engaged');
  expect(w.companions[0].targetId).toBe(u.id);
  resume(w, 30);
  Object.assign(w.hero, { x: u.monster!.home.x + 1500, y: u.monster!.home.y });
  w.step();
  expect(u.monster!.phase).toBe('returning');
  resume(w, 120);
  expect(u.monster!.phase).toBe('idle');
  expect(camp).toMatchObject({ unitIds: [u.id], nextSpawnTick: null });
});

test('practice river deaths retain shrines and the shared later birth through a saved reload', () => {
  const w = practice();
  w.tick = SCUTTLER_POLICY.firstReadyTick - 1;
  w.step(20);
  for (const side of ['dragon', 'baron'] as const) {
    const u = w.unit(w.scuttlers!.unitIds[side]!)!;
    w.damage(w.hero, u, 99999, 'true');
  }
  expect(w.scuttlers!.shrines).toHaveLength(2);
  expect(w.scuttlers!.initialDeaths).toBe(2);
  expect(w.scuttlers!.pending?.side).not.toBe('both');
  resume(w, 400);
  w.step(w.scuttlers!.pending!.readyTick - SCUTTLER_POLICY.leadupTicks - 1 - w.tick);
  resume(w, 1);
  expect(Object.values(w.scuttlers!.unitIds).filter((id) => id !== null)).toHaveLength(1);
  resume(w, SCUTTLER_POLICY.leadupTicks + 20);
});

test('Rift practice snapshots require their full map calendars and reject pre-calendar versions', () => {
  const w = practice();
  const state = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => {
      s.jungleCamps = [];
    },
    (s: any) => {
      s.jungleCamps[1].id = s.jungleCamps[0].id;
    },
    (s: any) => {
      s.scuttlers = null;
    },
    (s: any) => {
      s.version = 101;
    },
  ]) {
    const invalid = structuredClone(state);
    mutate(invalid);
    expect(() => World.fromSnapshot(JSON.stringify(invalid), rift)).toThrow();
  }
});
