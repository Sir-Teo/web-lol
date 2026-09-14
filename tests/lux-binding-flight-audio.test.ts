import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { bindingFlightAudioStates } from '../src/audio/lux-binding-flight-state';
import { LUX_BINDING_FLIGHT_AUDIO } from '../src/content/lux-binding-flight-audio';
function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  return { w, lux };
}
test('flight variants alternate across save/load without changing simulation randomness', () => {
  const { w, lux } = setup();
  const rng = w.random.state;
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  expect(w.releaseLightBinding(lux, { x: 0, y: 0 }, 80)).toBe(false);
  expect(w.nextBindingAudioVariant).toBe(1);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.releaseLightBinding(
      world.units.find((u) => u.id === lux.id)!,
      { x: 1300, y: 0 },
      80
    );
    world.releaseLightBinding(
      world.units.find((u) => u.id === lux.id)!,
      { x: 1300, y: 0 },
      80
    );
    expect(world.projectiles.map((p) => p.bindingAudioVariant)).toEqual([0, 1, 0]);
    expect(world.random.state).toBe(rng);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const mutate of [
    (s: any) => (s.nextBindingAudioVariant = 2),
    (s: any) => delete s.projectiles[0].bindingAudioVariant,
    (s: any) => (s.projectiles[0].bindingAudioVariant = -1),
  ]) {
    const state = JSON.parse(w.snapshot());
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow();
  }
});
test('live range prediction stays fixed and stopped playback uses its exact fade age', () => {
  const { w, lux } = setup();
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  const first = bindingFlightAudioStates(w.projectiles, [], w.tick)[0];
  w.step(10);
  const live = bindingFlightAudioStates(w.projectiles, [], w.tick)[0];
  expect(live.stopTick).toBe(first.stopTick);
  expect(live.age).toBe(10 / 60);
  expect(live.x).toBe(200);
  w.step(55);
  const stop = w.bindingStops[0];
  expect(stop.variant).toBe(0);
  const state = bindingFlightAudioStates([], w.bindingStops, w.tick + 30)[0];
  expect(state.fade).toBeCloseTo(5 / 6);
  expect(state.remainingFade).toBe(2.5);
  expect(state.x).toBe(1300);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(bindingFlightAudioStates([], saved.bindingStops, w.tick + 30)).toEqual([state]);
  expect(
    bindingFlightAudioStates(
      [],
      w.bindingStops,
      Math.ceil(LUX_BINDING_FLIGHT_AUDIO.variants[0].durationSeconds * 60)
    )
  ).toEqual([]);
});
