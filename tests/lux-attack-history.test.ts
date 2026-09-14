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
    { tick: 10, x: 0, y: 0, facing: 3.1 },
    { tick: 11, x: 10, y: 20, facing: -3.1 },
  ];
  expect(luxAttackFrame(effect, 9.9)).toBeNull();
  const middle = luxAttackFrame(effect, 10.5)!;
  expect(middle.x).toBe(5);
  expect(middle.y).toBe(10);
  expect(middle.facing).toBeCloseTo(Math.PI, 12);
  expect(luxAttackFrame(effect, 50)).toEqual({ x: 10, y: 20, facing: -3.1 });
});
