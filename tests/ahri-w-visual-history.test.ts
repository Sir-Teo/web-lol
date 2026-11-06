import { expect, test } from 'vitest';
import type { FoxFireCast } from '../src/simulation/ahri-fox-fires';
import {
  beginWVisualHistory,
  dispatchWVisualHistory,
  sampleWVisualHistory,
  endWVisualHistory,
  refreshWVisualAudience,
  type WVisualObserverWorld,
} from '../src/simulation/ahri-w-visual-history';

function fixture() {
  let visible = false;
  const world: WVisualObserverWorld = {
    tick: 1,
    ahriWVisuals: [],
    pointVisible: () => visible,
  };
  const cast: FoxFireCast = {
    id: 9, sourceId: 1, team: 'red', rank: 1, damage: 40,
    startTick: 1, releaseTick: 16, lastTick: 0, facing: 0,
    released: false, stopTick: null,
    fires: [0, 1, 2].map((index) => ({
      index, phase: 'orbit', position: { x: index * 100, y: 0 },
      previous: { x: index * 100, y: 0 }, targetId: null,
      dispatchTick: null, stopTick: null, stopReason: null, hit: null,
    })),
  };
  return { world, cast, reveal: () => { visible = true; } };
}

test('W history separates dispatch root from same-tick movement and copies all positions', () => {
  const { world, cast } = fixture();
  const source = { x: 10, y: 20 };
  const gameplay = structuredClone(cast);
  beginWVisualHistory(world, cast, source);
  expect(cast).toEqual(gameplay);
  const fire = cast.fires[0];
  fire.phase = 'flight'; fire.targetId = 77;
  dispatchWVisualHistory(world, cast, fire);
  fire.position.x = 23;
  sampleWVisualHistory(world, cast, fire, source);
  const record = world.ahriWVisuals![0];
  expect(record.fires[0].dispatch).toMatchObject({ point: { x: 0, y: 0 }, targetId: 77 });
  expect(record.fires[0].frames[0].point).toEqual({ x: 23, y: 0 });
  source.x = 500; fire.position.x = 999;
  expect(record.origin).toEqual({ x: 10, y: 20 });
  expect(record.fires[0].frames[0].sourcePoint).toEqual({ x: 10, y: 20 });
  expect(record.fires[0].frames[0].point.x).toBe(23);
});

test('W history refreshes only current sight samples and keeps terminal endpoints immutable', () => {
  const { world, cast, reveal } = fixture();
  const fire = cast.fires[0];
  beginWVisualHistory(world, cast, { x: 0, y: 0 });
  sampleWVisualHistory(world, cast, fire, { x: 0, y: 0 });
  world.tick++;
  fire.position.x = 50;
  sampleWVisualHistory(world, cast, fire, { x: 0, y: 0 });
  reveal();
  refreshWVisualAudience(world);
  const r = world.ahriWVisuals![0].fires[0];
  expect(r.birth.audience).toEqual(['red']);
  expect(r.frames.map((f) => f.audience)).toEqual([['red'], ['blue', 'red']]);
  endWVisualHistory(world, cast, fire, 'hit');
  const ended = structuredClone(r);
  world.tick++;
  fire.position.x = 900;
  endWVisualHistory(world, cast, fire, 'match-end');
  sampleWVisualHistory(world, cast, fire, { x: 100, y: 0 });
  expect(r).toEqual(ended);
});

test('W history rejects duplicate casts, invalid dispatch and repeated frame ticks', () => {
  const { world, cast } = fixture();
  beginWVisualHistory(world, cast, { x: 0, y: 0 });
  expect(() => beginWVisualHistory(world, cast, { x: 0, y: 0 })).toThrow('Duplicate');
  expect(() => dispatchWVisualHistory(world, cast, cast.fires[0])).toThrow('committed target');
  sampleWVisualHistory(world, cast, cast.fires[0], { x: 0, y: 0 });
  expect(() => sampleWVisualHistory(world, cast, cast.fires[0], { x: 0, y: 0 })).toThrow('consecutive');
  world.tick += 2;
  expect(() => sampleWVisualHistory(world, cast, cast.fires[0], { x: 0, y: 0 })).toThrow('consecutive');
});

test('W observation is optional for gameplay-only callers', () => {
  const { cast } = fixture();
  const before = structuredClone(cast);
  const world = { tick: 1 };
  beginWVisualHistory(world, cast, { x: 0, y: 0 });
  dispatchWVisualHistory(world, cast, cast.fires[0]);
  sampleWVisualHistory(world, cast, cast.fires[0], { x: 0, y: 0 });
  endWVisualHistory(world, cast, cast.fires[0], 'death');
  refreshWVisualAudience(world);
  expect(cast).toEqual(before);
  expect(world).toEqual({ tick: 1 });
});
