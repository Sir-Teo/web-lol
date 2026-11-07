import { expect, test } from 'vitest';
import { AHRI_W } from '../src/content/ahri-w';
import { DT } from '../src/content/rules';
import { foxFireOrbitPoint, type FoxFireCast } from '../src/simulation/ahri-fox-fires';
import { direction, distance } from '../src/simulation/math';
import {
  beginWVisualHistory,
  dispatchWVisualHistory,
  sampleWVisualHistory,
  endWVisualHistory,
  type WVisualObserverWorld,
} from '../src/simulation/ahri-w-visual-history';
import { validateWVisualMotion } from '../src/simulation/ahri-w-visual-history-validation';

function recordedFlight() {
  const source = { x: 0, y: 0 },
    target = { x: 400, y: 0 };
  const cast: FoxFireCast = {
    id: 9,
    sourceId: 1,
    team: 'blue',
    rank: 1,
    damage: 40,
    startTick: 1,
    releaseTick: 16,
    lastTick: 0,
    facing: 0,
    released: false,
    stopTick: null,
    fires: [],
  };
  cast.fires = [0, 1, 2].map((index) => ({
    index,
    phase: 'orbit',
    position: foxFireOrbitPoint(cast, index, 1, source),
    previous: foxFireOrbitPoint(cast, index, 1, source),
    targetId: null,
    dispatchTick: null,
    stopTick: null,
    stopReason: null,
    hit: null,
  }));
  const world: WVisualObserverWorld = { tick: 1, ahriWVisuals: [] };
  beginWVisualHistory(world, cast, source);
  const r = world.ahriWVisuals![0];
  for (; world.tick < 100; world.tick++) {
    source.x = (world.tick - 1) * 2;
    for (const fire of cast.fires) {
      if (fire.phase === 'spent') continue;
      if (fire.phase === 'orbit') {
        fire.position = foxFireOrbitPoint(cast, fire.index, world.tick, source);
        if (world.tick === 16) {
          fire.phase = 'flight';
          fire.targetId = 50;
          fire.dispatchTick = world.tick;
          dispatchWVisualHistory(world, cast, fire, source);
        }
      }
      let hit = false;
      if (fire.phase === 'flight') {
        const travel = AHRI_W.damageSplineSpeed * DT;
        hit = distance(fire.position, target) <= travel;
        const delta = direction(fire.position, target);
        fire.position = hit
          ? { ...target }
          : {
              x: fire.position.x + delta.x * travel,
              y: fire.position.y + delta.y * travel,
            };
      }
      sampleWVisualHistory(world, cast, fire, source, target);
      if (hit) {
        endWVisualHistory(world, cast, fire, 'hit');
        fire.phase = 'spent';
      }
    }
    validateWVisualMotion(r, world.tick);
    if (cast.fires.every((f) => f.phase === 'spent')) break;
  }
  return { r, tick: world.tick };
}

test('W motion validator accepts orbit, same-tick dispatch movement and terminal hits', () => {
  const { r, tick } = recordedFlight();
  expect(r.fires.every((f) => f.end?.reason === 'hit')).toBe(true);
  expect(r.fires[0].dispatch!.point).not.toEqual(r.fires[0].frames[15].point);
  expect(() => validateWVisualMotion(r, tick)).not.toThrow();
});

test('W motion validator rejects corrupted orbit, homing, phase, clocks and anchors', () => {
  const { r, tick } = recordedFlight();
  const mutations: ((changed: typeof r) => void)[] = [
    (c) => {
      c.releaseTick++;
    },
    (c) => {
      c.fires[0].birth.point.x++;
    },
    (c) => {
      c.fires[0].frames[3].point.y++;
    },
    (c) => {
      c.fires[0].frames[3].sourcePoint.y++;
    },
    (c) => {
      c.fires[0].frames[3].audience = [];
    },
    (c) => {
      c.fires[0].frames[3].audience = ['blue', 'blue'];
    },
    (c) => {
      c.fires[0].frames[15].point.x++;
    },
    (c) => {
      c.fires[0].frames[15].targetPoint!.y += 100;
    },
    (c) => {
      c.fires[0].frames[15].phase = 'orbit';
    },
    (c) => {
      c.fires[0].frames[15].tick++;
    },
    (c) => {
      c.fires[0].dispatch!.sourcePoint.y++;
    },
    (c) => {
      c.fires[0].dispatch!.tick++;
    },
    (c) => {
      c.fires[0].end!.point.x++;
    },
    (c) => {
      c.fires[0].end!.reason = 'death';
    },
    (c) => {
      c.fires[0].end!.tick--;
    },
    (c) => {
      c.fires[0].frames.pop();
    },
    (c) => {
      c.fires.pop();
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(r);
    mutate(changed);
    expect(() => validateWVisualMotion(changed, tick), 'mutation ' + index).toThrow();
  }
});

test('W motion validator accepts orbit cancellation before movement and rejects false expiry clocks', () => {
  const { r } = recordedFlight();
  for (const f of r.fires) {
    f.dispatch = null;
    f.frames = f.frames.slice(0, 5);
    f.end = { ...structuredClone(f.frames.at(-1)!), reason: 'death' };
  }
  expect(() => validateWVisualMotion(r, 5)).not.toThrow();
  for (const f of r.fires) f.end!.reason = 'match-end';
  expect(() => validateWVisualMotion(r, 5)).not.toThrow();
  r.fires[0].end!.reason = 'expired';
  expect(() => validateWVisualMotion(r, 5)).toThrow();
});
