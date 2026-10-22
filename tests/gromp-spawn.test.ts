import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GROMP, GROMP_SPAWN_LEADUP_TICKS, GROMP_SPAWN_CLIP_TICKS } from '../src/content/gromp';
import { mobilePose } from '../src/render/mobile-pose';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';

function encounter(champion: 'ashe' | 'lux' = 'ashe') {
  const world = new World(false, PRACTICE_FIXTURE, champion);
  world.nextWaveTick = 1_000_000_000;
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const unit = world.spawnMonster(
    { x: 450, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  return { world, unit };
}

test('spawn alias, source event frame, graph blends and legacy duration retain independent provenance', () => {
  const raw = readFileSync(GROMP.spawn.sourcePin),
    pin = JSON.parse(raw.toString());
  expect(GROMP.spawn.sourcePinSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  expect(GROMP.clips.spawn).toEqual({ name: pin.convertedClip.name, durationSeconds: 4.5 });
  expect(GROMP_SPAWN_CLIP_TICKS).toBe(270);
  expect(GROMP_SPAWN_LEADUP_TICKS).toBe(192);
  expect(pin.legacySpawnDurationSeconds).toBe(3.2);
  expect(Object.values(pin.atomicClip.mEventDataMap).some((v: any) => v.mStartFrame === 90)).toBe(
    true
  );
  expect(pin.cascadeBlendSeconds).toBe(0);
  expect(Object.values(pin.spawnBlendEntries).every((v: any) => v.mTime === 0)).toBe(true);
  expect(pin.timerEvidence.instructions.find((i: any) => i.pc === 384)).toMatchObject({
    op: 'SUB',
    operands: [9, { register: 9 }, { register: 10 }],
  });
  for (const key of ['scriptSourcePin', 'characterSourcePin', 'modelManifest']) {
    expect(pin[key + 'Sha256']).toBe(
      createHash('sha256').update(readFileSync(pin[key])).digest('hex')
    );
  }
});

test('emergence blocks damage, retaliation and movement until the exact ready tick', () => {
  const { world, unit } = encounter();
  expect(unit.animationTimeline?.primary).toMatchObject({
    kind: 'spawn',
    clip: 'spawn',
    time: 0,
    cut: true,
    loop: false,
  });
  for (const kind of ['physical', 'magic', 'true'] as const)
    world.damage(world.hero, unit, 99999, kind);
  world.enqueue({ type: 'order', unit: unit.id, order: { type: 'move', point: { x: 800, y: 0 } } });
  world.step(GROMP_SPAWN_LEADUP_TICKS - 1);
  expect(unit).toMatchObject({
    hp: unit.maxHp,
    x: 450,
    y: 0,
    monster: { phase: 'spawning', targetId: null },
  });
  expect(world.vulnerable(unit)).toBe(false);
  expect(world.applyRoot(unit, 60)).toBe(false);
  expect(world.applySilence(unit, 60)).toBe(false);
  expect(unit.releaseTick).toBeNull();
  expect(unit.idleClock).toBeNull();
  world.step();
  expect(unit.monster.phase).toBe('idle');
  expect(world.vulnerable(unit)).toBe(true);
  expect(unit.animationTimeline?.primary).toMatchObject({ clip: 'spawn', time: 3.2 });
  world.damage(world.hero, unit, 10, 'true');
  expect(unit.hp).toBe(unit.maxHp - 10);
  expect(unit.monster).toMatchObject({ phase: 'engaged', spawn: null });
});

test('an attack commanded on the ready tick starts before the monster controller advances', () => {
  const { world, unit } = encounter();
  world.step(GROMP_SPAWN_LEADUP_TICKS - 1);
  world.enqueue({ type: 'order', unit: world.hero.id, order: { type: 'attack', target: unit.id } });
  world.step();
  expect(world.hero.attackTarget).toBe(unit.id);
  expect(world.hero.releaseTick).not.toBeNull();
  expect(world.hero.attackCycle?.startTick).toBe(GROMP_SPAWN_LEADUP_TICKS);
});

test('Lux Binding passes through the protected lead-up without damage or root', () => {
  const { world, unit } = encounter('lux');
  const behind = [750, 1000].map((x) => world.spawn('dummy', 'red', { x, y: 0 }));
  const mana = world.hero.mana;
  world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'q', point: unit });
  world.step(120);
  expect(world.hero.mana).toBeLessThan(mana);
  expect(unit.hp).toBe(unit.maxHp);
  expect(unit.rootUntil).toBe(0);
  expect(unit.monster.phase).toBe('spawning');
  expect(unit.illumination).toEqual([]);
  expect(behind.every((u) => u.hp < u.maxHp && u.rootUntil > world.tick)).toBe(true);
});

test('Volley passes protected geometry without applying legacy or owned slow state', () => {
  const { world, unit } = encounter();
  world.player.spellRanks.w = 1;
  const behind = world.spawn('dummy', 'red', { x: 900, y: 0 });
  world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'w', point: unit });
  world.step(120);
  expect(unit.hp).toBe(unit.maxHp);
  expect(unit.slowUntil).toBe(0);
  expect(unit.slows).toEqual([]);
  expect(behind.hp).toBeLessThan(behind.maxHp);
});

test('protected and ready animation checkpoints resume exactly and finish on source clip time', () => {
  const { world, unit } = encounter();
  world.step(90);
  let restored = World.fromSnapshot(world.snapshot(), PRACTICE_FIXTURE);
  expect(restored.snapshot()).toBe(world.snapshot());
  world.step(GROMP_SPAWN_LEADUP_TICKS - 90);
  restored.step(GROMP_SPAWN_LEADUP_TICKS - 90);
  expect(restored.snapshot()).toBe(world.snapshot());
  restored = World.fromSnapshot(world.snapshot(), PRACTICE_FIXTURE);
  world.step(GROMP_SPAWN_CLIP_TICKS - GROMP_SPAWN_LEADUP_TICKS - 1);
  restored.step(GROMP_SPAWN_CLIP_TICKS - GROMP_SPAWN_LEADUP_TICKS - 1);
  expect(unit.animationTimeline?.primary.clip).toBe('spawn');
  const interpolated = mobilePose(unit, undefined, world.tick, 0.5, mobileClipDurations(unit)!);
  expect(interpolated.time).toBeCloseTo((GROMP_SPAWN_CLIP_TICKS - 1.5) / 60);
  world.step();
  restored.step();
  expect(unit.monster.spawn).toBeNull();
  expect(unit.animationTimeline?.primary).toMatchObject({ clip: 'idle1', cut: true });
  expect(unit.animationTimeline?.transition).toBeNull();
  expect(restored.snapshot()).toBe(world.snapshot());
  world.step();
  restored.step();
  expect(unit.idleClock?.current).toBeCloseTo(2 / 60);
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('positive damage interrupts the ready tail with a direct graph cut and a clean reset path', () => {
  const { world, unit } = encounter();
  world.step(GROMP_SPAWN_LEADUP_TICKS);
  world.damage(world.hero, unit, 0, 'true');
  expect(unit.monster.spawn).not.toBeNull();
  world.damage(world.hero, unit, 1, 'true');
  world.step();
  expect(unit.monster.spawn).toBeNull();
  expect(unit.animationTimeline?.primary.clip).toBe('run');
  expect(unit.animationTimeline?.primary.cut).toBe(true);
  expect(unit.animationTimeline?.transition).toBeNull();
  Object.assign(world.hero, { x: -2000, y: 0 });
  world.step(180);
  expect(unit.monster).toMatchObject({ phase: 'idle', spawn: null });
  expect(World.fromSnapshot(world.snapshot(), PRACTICE_FIXTURE).snapshot()).toBe(world.snapshot());
});

test('a lethal ready-tail hit selects death without resuming the spawn clip', () => {
  const { world, unit } = encounter();
  world.step(GROMP_SPAWN_LEADUP_TICKS);
  world.damage(world.hero, unit, 99999, 'true');
  world.step();
  expect(unit.monster.spawn).toBeNull();
  expect(unit.animationTimeline?.primary).toMatchObject({ clip: 'death', cut: true });
  expect(unit.animationTimeline?.transition).toBeNull();
  expect(World.fromSnapshot(world.snapshot(), PRACTICE_FIXTURE).snapshot()).toBe(world.snapshot());
});

test('spawn checkpoints reject crossed phases, clocks, movement and protection lengths', () => {
  const { world, unit } = encounter();
  world.step(60);
  const saved = JSON.parse(world.snapshot());
  const mutations = [
    (u: any) => {
      u.monster.spawn = null;
    },
    (u: any) => {
      u.monster.phase = 'idle';
    },
    (u: any) => {
      u.monster.spawn.startTick = world.tick + 1;
    },
    (u: any) => {
      u.monster.spawn.readyTick++;
    },
    (u: any) => {
      u.hp--;
    },
    (u: any) => {
      u.x++;
    },
    (u: any) => {
      u.idleClock = { startTick: 0, previous: 0, current: 1 };
    },
    (u: any) => {
      u.order = { type: 'move', point: { x: 450, y: 0 } };
    },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(saved);
    mutate(value.units.find((u: any) => u.id === unit.id));
    expect(() => World.fromSnapshot(JSON.stringify(value), PRACTICE_FIXTURE)).toThrow();
  }
});
