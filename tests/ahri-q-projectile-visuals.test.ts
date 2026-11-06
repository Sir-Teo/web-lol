import { expect, test } from 'vitest';
import data from '../src/content/ahri-q-projectile-particles.json';
import { eclipsePeak } from '../src/render/leona-eclipse-values';
import { AHRI_Q_PROJECTILE_HISTORY_TICKS as retention } from '../src/content/ahri-q-projectile-timing';
import { advanceAhriOrbMotion, createAhriOrbMotion } from '../src/simulation/ahri-orb-motion';
import type { AhriOrb } from '../src/simulation/ahri-orbs';
import {
  launchQProjectileVisual,
  moveQProjectileVisual,
  finishQProjectileVisual,
  advanceQProjectileVisuals,
  type ProjectileVisualWorld,
} from '../src/simulation/ahri-q-projectile-visuals';

function fixture() {
  let visible = false;
  const world: ProjectileVisualWorld = {
    tick: 16,
    ahriQProjectileVisuals: [],
    pointVisible: () => visible,
  };
  const orb: AhriOrb = {
    ...createAhriOrbMotion({ x: 0, y: 0 }, { x: 1000, y: 0 }, 16),
    id: 9,
    sourceId: 1,
    team: 'red',
    rank: 1,
    damage: 100,
    outwardHits: [],
    returnHits: [],
  };
  launchQProjectileVisual(world, orb);
  return {
    world,
    orb,
    show: () => {
      visible = true;
    },
  };
}
test('retention covers every authored lifetime without importing particle data into simulation', () => {
  const maximum = Math.max(...data.profiles.map((p) => eclipsePeak(p.life)));
  expect(maximum).toBe(6);
  expect(retention).toBe(Math.ceil(maximum * 60));
});
test('observer follows actual motion, captures the mixed turn tick and permits hidden entry', () => {
  const { world, orb, show } = fixture();
  const r = world.ahriQProjectileVisuals![0];
  expect(r.birthAudience).toEqual(['red']);
  let finished = false;
  for (; world.tick < 200; world.tick++) {
    const caster = { x: world.tick < 90 ? 0 : -300, y: 0 };
    const movement = advanceAhriOrbMotion(orb, world.tick, caster);
    Object.assign(orb, movement.motion);
    moveQProjectileVisual(world, orb, caster, movement.segments);
    if (world.tick === 40) show();
    advanceQProjectileVisuals(world);
    if (movement.finished) {
      finishQProjectileVisual(world, orb, 'caught');
      finished = true;
      break;
    }
  }
  expect(finished).toBe(true);
  expect(r.birthAudience).toEqual(['red']);
  expect(r.frames.find((f) => f.tick === 39)!.audience).toEqual(['red']);
  expect(r.frames.find((f) => f.tick === 40)!.audience).toEqual(['blue', 'red']);
  expect(r.turn).toMatchObject({ tick: 62, point: { x: 1000, y: 0 } });
  expect(r.frames.find((f) => f.tick === 62)!.x).toBeLessThan(1000);
  expect(r.end).toMatchObject({ reason: 'caught', point: { x: -300, y: 0 } });
  expect(r.frames.at(-1)!.sourcePoint).toEqual({ x: -300, y: 0 });
  const frozen = structuredClone(r);
  world.tick++;
  finishQProjectileVisual(world, orb, 'expired');
  expect(r).toEqual(frozen);
  world.tick = r.end!.tick + retention - 1;
  advanceQProjectileVisuals(world);
  expect(world.ahriQProjectileVisuals).toHaveLength(1);
  world.tick++;
  advanceQProjectileVisuals(world);
  expect(world.ahriQProjectileVisuals).toEqual([]);
});
test('launch and immediate match end need no invented motion frame; copies do not alias the orb', () => {
  const { world, orb } = fixture();
  finishQProjectileVisual(world, orb, 'match-end');
  const saved = structuredClone(world.ahriQProjectileVisuals![0]);
  orb.position.x = 9;
  orb.origin.x = 9;
  orb.direction.x = 9;
  moveQProjectileVisual(world, orb, { x: 3, y: 4 }, []);
  expect(world.ahriQProjectileVisuals![0]).toEqual(saved);
  expect(saved.frames).toEqual([]);
});
test('optional observer leaves minimal physics worlds unchanged', () => {
  const { orb } = fixture();
  const w = { tick: 16 };
  launchQProjectileVisual(w, orb);
  moveQProjectileVisual(w, orb, { x: 0, y: 0 }, []);
  finishQProjectileVisual(w, orb, 'lost-source');
  advanceQProjectileVisuals(w);
  expect(w).toEqual({ tick: 16 });
});
