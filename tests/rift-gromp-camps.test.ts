import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  RIFT_GROMP_CAMPS,
  GROMP_FIRST_SPAWN_TICK,
  GROMP_RESPAWN_TICKS,
} from '../src/content/rift-gromp-camps';
import { GROMP_POLICY, GROMP_SPAWN_LEADUP_TICKS } from '../src/content/gromp';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);

function match() {
  const world = createLaneMatch(rift);
  world.nextWaveTick = 1_000_000_000;
  for (const u of world.units) u.ai = false;
  return world;
}
function spawned() {
  const world = match();
  world.tick = GROMP_FIRST_SPAWN_TICK - 1;
  world.step();
  return world;
}

test('both Gromps emerge before their ready deadline at distinct source locators', () => {
  const world = match();
  world.tick = GROMP_FIRST_SPAWN_TICK - GROMP_SPAWN_LEADUP_TICKS - 2;
  world.step();
  expect(world.units.some((u) => u.kind === 'monster')).toBe(false);
  world.step();
  expect(world.units.filter((u) => u.kind === 'monster')).toHaveLength(2);
  expect(world.jungleCamps.every((c) => world.unit(c.unitId!)?.monster?.phase === 'spawning')).toBe(
    true
  );
  world.step(GROMP_SPAWN_LEADUP_TICKS);
  for (const [i, camp] of world.jungleCamps.entries()) {
    const unit = world.unit(camp.unitId!)!;
    const definition = RIFT_GROMP_CAMPS[i];
    expect(unit).toMatchObject({
      kind: 'monster',
      team: 'neutral',
      ...definition.point,
      monster: { home: definition.point, phase: 'idle', targetId: null },
    });
    expect(camp.nextSpawnTick).toBeNull();
    expect(unit.facing).toBe(
      Math.atan2(definition.facingPoint.x - unit.x, definition.facingPoint.y - unit.y)
    );
    expect(rift.reachable(unit, 40)).toEqual(definition.point);
    expect(world.visible(unit, 'blue')).toBe(false);
    expect(world.visible(unit, 'red')).toBe(false);
  }
  world.step(10);
  expect(world.units.filter((u) => u.kind === 'monster')).toHaveLength(2);
});

test('a clear schedules only its own camp from the death tick, surviving corpse removal', () => {
  const world = spawned(),
    camp = world.jungleCamps[0],
    other = world.jungleCamps[1];
  const corpse = world.unit(camp.unitId!)!,
    untouched = other.unitId;
  world.damage(world.hero, corpse, 99999, 'true');
  const deadline = world.tick + GROMP_RESPAWN_TICKS;
  expect(camp).toMatchObject({ unitId: null, nextSpawnTick: deadline });
  expect(other).toMatchObject({ unitId: untouched, nextSpawnTick: null });
  const gold = world.player.gold;
  world.damage(world.hero, corpse, 99999, 'true');
  expect(world.player.gold).toBe(gold);
  expect(camp.nextSpawnTick).toBe(deadline);
  world.step(GROMP_POLICY.corpseLifetimeTicks + 1);
  expect(world.unit(corpse.id)).toBeUndefined();
  const restored = World.fromSnapshot(world.snapshot(), rift);
  world.tick = restored.tick = deadline - 2;
  world.step();
  restored.step();
  expect(world.unit(camp.unitId!)?.monster?.phase).toBe('spawning');
  expect(world.vulnerable(world.unit(camp.unitId!)!)).toBe(false);
  world.step();
  restored.step();
  const fresh = world.unit(camp.unitId!)!;
  expect(fresh.id).not.toBe(corpse.id);
  expect(fresh).toMatchObject({
    hp: fresh.maxHp,
    monster: { home: RIFT_GROMP_CAMPS[0].point, phase: 'idle' },
  });
  expect(other.unitId).toBe(untouched);
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('retaliation and a leash reset never restart the camp calendar', () => {
  const world = spawned(),
    camp = world.jungleCamps[0],
    target = world.unit(camp.unitId!)!;
  Object.assign(world.hero, { x: target.x + 250, y: target.y });
  world.damage(world.hero, target, 10, 'true');
  world.step();
  expect(target.monster?.phase).toBe('engaged');
  Object.assign(world.hero, { x: target.x + 1300, y: target.y });
  world.step();
  expect(target.monster?.phase).toBe('returning');
  const restored = World.fromSnapshot(world.snapshot(), rift);
  world.step(120);
  restored.step(120);
  expect(target.monster?.phase).toBe('idle');
  expect(camp).toMatchObject({ unitId: target.id, nextSpawnTick: null });
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('a pre-spawn checkpoint resumes both camps once and game end freezes their calendar', () => {
  const world = match();
  world.tick = GROMP_FIRST_SPAWN_TICK - GROMP_SPAWN_LEADUP_TICKS - 1;
  const saved = world.snapshot(),
    restored = World.fromSnapshot(saved, rift);
  expect(restored.snapshot()).toBe(saved);
  world.step();
  restored.step();
  expect(restored.snapshot()).toBe(world.snapshot());
  world.step(GROMP_SPAWN_LEADUP_TICKS);
  const target = world.unit(world.jungleCamps[0].unitId!)!;
  world.damage(world.hero, target, 99999, 'true');
  world.winner = 'blue';
  const ended = world.snapshot();
  world.step(GROMP_RESPAWN_TICKS + 1);
  expect(world.snapshot()).toBe(ended);
});

test('practice and controlled fixtures do not silently acquire a live camp calendar', () => {
  for (const battlefield of [rift, PRACTICE_FIXTURE]) {
    const world = new World(false, battlefield);
    world.tick = GROMP_FIRST_SPAWN_TICK - 1;
    world.step();
    expect(world.jungleCamps).toEqual([]);
    expect(world.units.some((u) => u.kind === 'monster')).toBe(false);
  }
});

test('checkpoint validation rejects missing, duplicate, premature and inconsistent camp ownership', () => {
  const world = spawned(),
    active = JSON.parse(world.snapshot());
  const invalid = (mutate: (s: any) => void, source = active) => {
    const state = structuredClone(source);
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), rift)).toThrow();
  };
  invalid((s) => {
    s.jungleCamps = [];
  });
  invalid((s) => {
    s.jungleCamps[1].id = s.jungleCamps[0].id;
  });
  invalid((s) => {
    s.jungleCamps[1].unitId = s.jungleCamps[0].unitId;
  });
  invalid((s) => {
    s.jungleCamps[0].unitId = s.player.id;
  });
  invalid((s) => {
    s.jungleCamps[0].nextSpawnTick = s.tick + 1;
  });
  invalid((s) => {
    s.tick = GROMP_FIRST_SPAWN_TICK - GROMP_SPAWN_LEADUP_TICKS - 1;
  });
  invalid((s) => {
    s.units.find((u: any) => u.id === s.jungleCamps[0].unitId).monster.home.x++;
  });
  invalid((s) => {
    s.matchMode = 'practice';
  });
  invalid((s) => {
    s.version = 87;
  });
  const before = JSON.parse(match().snapshot());
  invalid((s) => {
    s.jungleCamps[0].nextSpawnTick--;
  }, before);
  invalid((s) => {
    s.jungleCamps[0].nextSpawnTick = null;
  }, before);
  world.damage(world.hero, world.unit(world.jungleCamps[0].unitId!)!, 99999, 'true');
  const waiting = JSON.parse(world.snapshot());
  invalid((s) => {
    s.jungleCamps[0].nextSpawnTick = s.tick;
  }, waiting);
  invalid((s) => {
    s.jungleCamps[0].nextSpawnTick++;
  }, waiting);
});
