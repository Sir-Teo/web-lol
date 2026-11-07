import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_W_VISUAL_HISTORY_TICKS } from '../src/content/ahri-w-visual-timing';

const field = {
  ...PRACTICE_FIXTURE,
  initialUnits: [],
  lineOfSight: () => true,
  inBrush: () => false,
  lineWalkable: () => true,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
};
function fixture() {
  const w = new World(false, field);
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  w.learnSpell('w', ahri.id);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: 0, y: 0 } });
  return { w, ahri, target };
}

test('W visual schema restores complete histories and identical futures through pruning', () => {
  const checkpoints = [1, 5, 15, 16, 24, 25, 26, 35, 60, 119, 120, 150, 300, 360, 400];
  for (const checkpoint of checkpoints) {
    const { w: control } = fixture();
    control.step(checkpoint);
    const saved = control.snapshot();
    const restored = World.fromSnapshot(saved, field);
    expect(restored.snapshot(), 'round-trip tick ' + checkpoint).toBe(saved);
    restored.step(10);
    control.step(10);
    expect(restored.snapshot(), 'future tick ' + checkpoint).toBe(control.snapshot());
  }
  const { w } = fixture();
  w.step(400);
  expect(JSON.parse(w.snapshot()).version).toBe(180);
  expect(w.ahriWVisuals).toEqual([]);
  expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriWVisuals');
});

test('W restore rejects missing live history, forged motion, links and extra properties', () => {
  const { w } = fixture();
  w.step(26);
  const original = JSON.parse(w.snapshot());
  const changes = [
    (s: typeof original) => {
      delete s.ahriWVisuals;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].origin.x++;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].fires[0].frames[25].point.x++;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].fires[0].frames.pop();
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].fires[0].dispatch.targetId = s.nextId;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].fires[0].dispatch.targetId++;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].id = s.player.id;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].invented = true;
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].fires[0].frames[0].audience = [];
    },
    (s: typeof original) => {
      s.ahriWVisuals[0].releaseTick++;
    },
    (s: typeof original) => {
      s.version = 177;
    },
  ];
  for (const [index, change] of changes.entries()) {
    const state = structuredClone(original);
    change(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), field), 'corruption ' + index).toThrow();
  }
});

test('W terminal settlement survives restore and ended identities remain reserved', () => {
  const { w } = fixture();
  w.step(26);
  const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  expect(w.ahriWVisuals[0].fires.every((f) => f.end !== null)).toBe(true);
  expect(World.fromSnapshot(w.snapshot(), field).snapshot()).toBe(w.snapshot());
  const state = JSON.parse(w.snapshot());
  state.ahriWVisuals[0].id = state.player.id;
  expect(() => World.fromSnapshot(JSON.stringify(state), field)).toThrow();
});

test('W history expires exactly at the final endpoint plus the local retention window', () => {
  const { w } = fixture();
  w.step(100);
  const r = w.ahriWVisuals[0];
  const end = Math.max(...r.fires.map((f) => f.end!.tick));
  w.step(end + AHRI_W_VISUAL_HISTORY_TICKS - 1 - w.tick);
  expect(w.ahriWVisuals).toHaveLength(1);
  expect(() => World.fromSnapshot(w.snapshot(), field)).not.toThrow();
  w.step();
  expect(w.ahriWVisuals).toEqual([]);
  expect(() => World.fromSnapshot(w.snapshot(), field)).not.toThrow();
});
