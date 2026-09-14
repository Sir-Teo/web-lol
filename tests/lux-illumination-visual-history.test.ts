import { expect, test } from 'vitest';
import { LUX_R } from '../src/content/lux-r';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_ILLUMINATION_HISTORY_TICKS } from '../src/content/lux-illumination-presentation';

function setup(champion = false) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const target = champion
    ? w.spawn('champion', 'red', { x: 200, y: 0 }, 'ashe')
    : w.spawn('dummy', 'red', { x: 200, y: 0 });
  target.hp = target.maxHp = 5000;
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(5);
  return { w, lux, target };
}
function attack(s: ReturnType<typeof setup>) {
  s.w.setOrder(s.lux, { type: 'attack', target: s.target.id });
  for (let i = 0; i < 60 && !s.w.luxIlluminationVisuals.length; i++) s.w.step();
  s.w.setOrder(s.lux, { type: 'idle' });
  expect(s.w.luxIlluminationVisuals).toHaveLength(1);
}
test('consumption records once, saves exact continuation, and retains the complete particle tail', () => {
  const s = setup();
  expect(s.w.luxIlluminationVisuals).toEqual([]);
  attack(s);
  const v = s.w.luxIlluminationVisuals[0];
  expect(v.frames).toHaveLength(1);
  expect(v.audience).toEqual(['blue', 'red']);
  expect(v.id).not.toBe(s.w.luxImpactVisuals[0].id);
  const restored = World.fromSnapshot(s.w.snapshot(), s.w.battlefield);
  s.w.setOrder(s.lux, { type: 'attack', target: s.target.id });
  restored.setOrder(restored.unit(s.lux.id)!, { type: 'attack', target: s.target.id });
  s.w.step(70);
  restored.step(70);
  expect(restored.snapshot()).toBe(s.w.snapshot());
  expect(s.w.luxImpactVisuals.length).toBeLessThanOrEqual(1);
  expect(s.w.luxIlluminationVisuals).toHaveLength(1);
  expect(v.frames).toHaveLength(71);
  s.w.step(LUX_ILLUMINATION_HISTORY_TICKS - 71);
  expect(s.w.luxIlluminationVisuals).toHaveLength(1);
  s.w.step();
  expect(s.w.luxIlluminationVisuals).toEqual([]);
});
test('Final Spark records marked consumption and refreshes; unmarked hits and Q application do not record', () => {
  const { w, lux, target } = setup();
  const cast = () =>
    (w as any).releaseFinalSpark(lux, { x: 0, y: 0 }, { x: LUX_R.range, y: 0 }, 100);
  cast();
  expect(w.luxIlluminationVisuals).toHaveLength(1);
  expect(target.illumination).toHaveLength(1);
  target.illumination = [];
  cast();
  expect(w.luxIlluminationVisuals).toHaveLength(1);
  expect(target.illumination).toHaveLength(1);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
test('lethal consumption retains the final target pose and detaches instead of following respawn', () => {
  const s = setup(true);
  s.target.hp = 1;
  attack(s);
  const v = s.w.luxIlluminationVisuals[0];
  expect(v.detachedTick).toBe(v.startTick);
  expect(v.frames[0].animationTimeline).not.toBeNull();
  const { tick: _tick, ...pose } = v.frames[0];
  s.target.x += 1000;
  s.w.step(3);
  expect(v.frames.at(-1)).toEqual({ tick: s.w.tick, ...pose });
  expect(World.fromSnapshot(s.w.snapshot(), s.w.battlefield).snapshot()).toBe(s.w.snapshot());
});
test('detonation audience remains fixed when later vision changes', () => {
  const { w, lux, target } = setup();
  target.x = 3000;
  target.previous = { x: 3000, y: 0 };
  (w as any).releaseFinalSpark(lux, { x: 0, y: 0 }, { x: LUX_R.range, y: 0 }, 100);
  expect(w.luxIlluminationVisuals[0].audience).toEqual(['red']);
  lux.x = 2900;
  lux.previous = { x: 2900, y: 0 };
  w.step();
  expect(w.visible(target)).toBe(true);
  const sound = w.events.find((event) => event.type === 'illumination')!;
  expect(sound.audience).toEqual(['red']);
  expect(w.eventVisible(sound)).toBe(false);
  expect(w.luxIlluminationVisuals[0].audience).toEqual(['red']);
  expect(
    World.fromSnapshot(w.snapshot(), w.battlefield).luxIlluminationVisuals[0].audience
  ).toEqual(['red']);
});
test('saved detonation rejects invalid owners, pose history, audience and lifetime', () => {
  const s = setup();
  attack(s);
  s.w.step(3);
  const saved = s.w.snapshot();
  for (const corrupt of [
    (v: any) => {
      v.sourceId = s.target.id;
    },
    (v: any) => {
      v.id = s.target.id;
    },
    (v: any) => {
      v.critical = true;
    },
    (v: any) => {
      v.frames[1].tick++;
    },
    (v: any) => {
      v.frames.pop();
    },
    (v: any) => {
      v.audience = ['blue', 'blue'];
    },
    (v: any) => {
      v.audience = ['neutral'];
    },
    (v: any) => {
      v.audience = [];
    },
    (v: any, state: any) => {
      state.luxIlluminationVisuals.push(v);
    },
    (v: any, state: any) => {
      v.startTick = state.tick + 1;
    },
  ]) {
    const state = JSON.parse(saved);
    corrupt(state.luxIlluminationVisuals[0], state);
    expect(() => World.fromSnapshot(JSON.stringify(state), s.w.battlefield)).toThrow();
  }
});
