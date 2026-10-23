import { expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  LUX_ATTACK_PATH_FRAMES,
  LUX_ATTACK_VISUAL_TAIL_TICKS,
} from '../src/content/lux-attack-presentation';
import { luxAttackFrame } from '../src/render/lux-attack-frame';

function launch() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 500, y: 500 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 1000, y: 500 });
  target.hp = target.maxHp = 10000;
  w.setOrder(lux, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  w.setOrder(lux, { type: 'idle' });
  expect(w.luxAttackVisuals).toHaveLength(1);
  return { w, lux, target };
}
it('stops an unrelated in-flight attack history when a melee hit ends the match before projectile advancement', () => {
  const { w, target } = launch();
  w.step(3);
  const visual = w.luxAttackVisuals[0];
  const previous = structuredClone(visual.frames.at(-1)!);
  const finisher = w.spawn('melee', 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = w.tick + 1;
  finisher.attackTarget = nexus.id;
  const hp = target.hp;
  w.step();
  expect(w.winner).toBe('blue');
  expect(w.projectiles).toEqual([]);
  expect(visual.stopTick).toBe(w.tick);
  expect(visual.frames.at(-1)).toEqual({ ...previous, tick: w.tick });
  expect(target.hp).toBe(hp);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  w.step(60);
  expect(w.snapshot()).toBe(saved);
});
it('captures homing positions and preserves the exact active and post-impact history through saves', () => {
  const { w, target } = launch();
  const first = structuredClone(w.luxAttackVisuals[0]);
  expect(first.origin).toEqual({ x: 500, y: 500 });
  expect(first.frames[0].tick).toBe(first.launchTick);
  target.y += 100;
  w.step(3);
  expect(w.luxAttackVisuals[0].frames.at(-1)!.facing).not.toBe(first.frames[0].facing);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 80 && w.projectiles.length; i++) {
    w.step();
    restored.step();
    expect(restored.snapshot()).toBe(w.snapshot());
  }
  const visual = w.luxAttackVisuals[0];
  expect(visual.stopTick).toBe(w.tick);
  expect(visual.frames.at(-1)!.tick).toBe(w.tick);
  const terminal = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(terminal.snapshot()).toBe(w.snapshot());
  w.step(LUX_ATTACK_VISUAL_TAIL_TICKS - 1);
  expect(w.luxAttackVisuals).toHaveLength(1);
  w.step();
  expect(w.luxAttackVisuals).toEqual([]);
});

it('records the swept collision endpoint rather than a full-step overshoot', () => {
  const { w, target } = launch();
  const p = w.projectiles[0];
  target.x = p.x + 50;
  target.y = p.y;
  p.speed = 60000;
  w.step();
  const frame = w.luxAttackVisuals[0].frames.at(-1)!;
  expect(w.projectiles).toEqual([]);
  expect(frame.x).toBeCloseTo(target.x - target.radius - p.radius, 10);
});

it('bounds a long homing path and freezes the final frame when its target disappears', () => {
  const { w, target } = launch();
  w.projectiles[0].speed = 1;
  w.step(70);
  const effect = w.luxAttackVisuals[0];
  expect(effect.frames).toHaveLength(LUX_ATTACK_PATH_FRAMES);
  expect(effect.frames[0].tick).toBe(w.tick - LUX_ATTACK_PATH_FRAMES + 1);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  const previous = effect.frames.at(-1)!;
  target.hp = 0;
  w.step();
  expect(effect.stopTick).toBe(w.tick);
  expect(effect.frames.at(-1)).toEqual({ ...previous, tick: w.tick });
});

it('rejects missing, gapped, duplicate, conflicting or out-of-date visual histories', () => {
  const { w } = launch();
  w.step(3);
  const original = JSON.parse(w.snapshot());
  const edits = [
    (s: any) => {
      s.luxAttackVisuals = [];
    },
    (s: any) => {
      s.luxAttackVisuals.push(s.luxAttackVisuals[0]);
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[1].tick++;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames.at(-1).x++;
    },
    (s: any) => {
      s.luxAttackVisuals[0].origin.x++;
    },
    (s: any) => {
      s.luxAttackVisuals[0].stopTick = s.tick;
    },
    (s: any) => {
      s.luxAttackVisuals[0].sourceId = 999999;
    },
  ];
  for (const edit of edits) {
    const s = structuredClone(original);
    edit(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});

it('interpolates saved positions and the shortest facing turn, without fabricating a missing prefix', () => {
  const { w } = launch();
  const effect = w.luxAttackVisuals[0];
  effect.frames = [
    { tick: 10, x: 0, y: 0, facing: 3.1, trailDistance: 0 },
    { tick: 11, x: 10, y: 20, facing: -3.1, trailDistance: Math.hypot(10, 20) },
  ];
  expect(luxAttackFrame(effect, 9.9)).toBeNull();
  const middle = luxAttackFrame(effect, 10.5)!;
  expect(middle.x).toBe(5);
  expect(middle.y).toBe(10);
  expect(middle.facing).toBeCloseTo(Math.PI, 12);
  expect(luxAttackFrame(effect, 50)).toEqual({
    x: 10,
    y: 20,
    facing: -3.1,
    trailDistance: Math.hypot(10, 20),
  });
});

it('accumulates distance only between actual emission batches and preserves it after prefix retirement', () => {
  const { w, target } = launch();
  const effect = w.luxAttackVisuals[0];
  const batches = new Set([
    1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 32,
    33, 34, 35, 36, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54, 56, 57, 58, 59, 60,
    62,
  ]);
  let previousBirth: { x: number; y: number } | undefined;
  let distance = 0;
  expect(effect.frames[0].trailDistance).toBe(0);
  w.projectiles[0].speed = 20;
  for (let tick = 1; tick <= 70; tick++) {
    target.y += tick % 2 ? 80 : -40;
    w.step();
    const f = effect.frames.at(-1)!;
    if (batches.has(tick)) {
      if (previousBirth) distance += Math.hypot(f.x - previousBirth.x, f.y - previousBirth.y);
      previousBirth = f;
    }
    expect(f.trailDistance).toBe(distance);
  }
  expect(effect.frames[0].tick).toBeGreaterThan(effect.launchTick);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  const final = effect.frames.at(-1)!;
  target.x = final.x + 50;
  target.y = final.y;
  w.projectiles[0].speed = 60000;
  w.step();
  expect(effect.frames.at(-1)!.trailDistance).toBe(distance);
  expect(effect.stopTick).toBe(w.tick);
});
it('does not count an impact-step movement as a new emission batch', () => {
  const { w, target } = launch();
  w.step(2);
  const p = w.projectiles[0];
  target.x = p.x + 50;
  target.y = p.y;
  p.speed = 60000;
  w.step();
  const effect = w.luxAttackVisuals[0];
  expect(effect.stopTick! - effect.launchTick).toBe(3);
  expect(effect.frames.map((f) => f.trailDistance)).toEqual([0, 0, 0, 0]);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
it('rejects absent, decreasing and spatially inconsistent odometers', () => {
  const { w } = launch();
  w.step(3);
  for (const edit of [
    (s: any) => {
      delete s.luxAttackVisuals[0].frames[0].trailDistance;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[0].trailDistance = -1;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[1].trailDistance += 10;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[3].trailDistance = 0;
    },
  ]) {
    const saved = JSON.parse(w.snapshot());
    edit(saved);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});

it('retains the actual birth pose when a later melee hit wins on the Lux release tick', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 500, y: 0 });
  target.hp = target.maxHp = 5000;
  w.setOrder(lux, { type: 'attack', target: target.id });
  w.step();
  const release = lux.releaseTick!;
  expect(release).toBeGreaterThan(w.tick);
  target.x = 400;
  target.y = 200;
  const finisher = w.spawn('melee', 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = release;
  finisher.attackTarget = nexus.id;
  w.step(release - w.tick);
  expect(w.winner).toBe('blue');
  expect(w.tick).toBe(release);
  expect(w.projectiles).toEqual([]);
  const v = w.luxAttackVisuals[0];
  expect(v.launchTick).toBe(release);
  expect(v.stopTick).toBe(release);
  expect(v.frames).toHaveLength(1);
  expect(v.frames[0]).toMatchObject({
    tick: release,
    x: lux.x,
    y: lux.y,
    trailDistance: 0,
  });
  expect(v.frames[0].facing).toBeCloseTo(Math.atan2(target.x - lux.x, target.y - lux.y), 12);
  expect(target.hp).toBe(5000);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  w.step(60);
  expect(w.snapshot()).toBe(saved);
});
