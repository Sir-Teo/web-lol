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
    { tick: 10, x: 0, y: 0, facing: 3.1, distance: 0 },
    { tick: 11, x: 10, y: 20, facing: -3.1, distance: Math.hypot(10, 20) },
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
    distance: Math.hypot(10, 20),
  });
});

it('retains cumulative travel through turns, clipped hits and bounded history retirement', () => {
  const { w, target } = launch();
  const effect = w.luxAttackVisuals[0];
  let previous = { ...effect.origin },
    distance = 0;
  const first = effect.frames[0];
  distance += Math.hypot(first.x - previous.x, first.y - previous.y);
  expect(first.distance).toBe(distance);
  previous = first;
  w.projectiles[0].speed = 20;
  for (let i = 0; i < 70; i++) {
    target.y += i % 2 ? 80 : -40;
    w.step();
    const f = effect.frames.at(-1)!;
    distance += Math.hypot(f.x - previous.x, f.y - previous.y);
    expect(f.distance).toBe(distance);
    previous = f;
  }
  expect(effect.frames[0].tick).toBeGreaterThan(effect.launchTick);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  target.x = previous.x + 50;
  target.y = previous.y;
  w.projectiles[0].speed = 60000;
  w.step();
  const hit = effect.frames.at(-1)!;
  expect(hit.distance).toBeCloseTo(
    distance + Math.hypot(hit.x - previous.x, hit.y - previous.y),
    10
  );
  expect(effect.stopTick).toBe(w.tick);
});
it('rejects absent, decreasing and spatially inconsistent odometers', () => {
  const { w } = launch();
  w.step(3);
  for (const edit of [
    (s: any) => {
      delete s.luxAttackVisuals[0].frames[0].distance;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[0].distance = -1;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[1].distance += 10;
    },
    (s: any) => {
      s.luxAttackVisuals[0].frames[1].distance = 0;
    },
  ]) {
    const saved = JSON.parse(w.snapshot());
    edit(saved);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
