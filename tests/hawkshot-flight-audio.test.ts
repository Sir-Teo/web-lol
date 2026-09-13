import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HAWKSHOT_FLIGHT_AUDIO as A } from '../src/content/hawkshot-flight-audio';
import { flightAudioStates } from '../src/audio/hawkshot-flight-state';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('flight audio preserves both source layers, gain, linear stops and all float masters', () => {
  const graph = JSON.parse(readFileSync('docs/reference/hawkshot-audio.json', 'utf8'));
  const event = graph.events.find((e: any) => e.id === A.eventId);
  const assets = [...A.variants, A.loop];
  expect(assets.map((a) => a.id).sort((a, b) => a - b)).toEqual(event.mediaIds);
  const property = (id: number, label: string) => {
    const fields = graph.nodes.find((n: any) => n.id === id).parameters;
    const pid = fields.find((p: any) => p[0].endsWith('/pID') && p[3]?.includes(`[${label}]`));
    return Number(fields.find((p: any) => p[0] === pid[0].slice(0, -3) + 'pValue')[2]);
  };
  expect(A.variantGainDb).toBe(property(3429, 'MakeUpGain'));
  expect(A.loopGainDb).toBe(property(921284325, 'MakeUpGain'));
  for (const id of [754547015, 405725596]) {
    expect(A.fadeSeconds).toBe(property(id, 'TransitionTime') / 1000);
    const p = graph.nodes
      .find((n: any) => n.id === id)
      .parameters.find((p: any) => p[0].endsWith('/eFadeCurve'));
    expect(Number(p[2])).toBe(A.fadeCurve);
  }
  expect(A.fadeCurve).toBe(4);
  const decoded = JSON.parse(readFileSync('docs/reference/hawkshot-audio-decoded.json', 'utf8'));
  for (const asset of assets) {
    expect(asset.sha256).toBe(decoded.media.find((m: any) => m.id === asset.id).wavSha256);
    expect(
      createHash('sha256')
        .update(readFileSync(`public${asset.url}`))
        .digest('hex')
    ).toBe(asset.sha256);
  }
});

for (const distance of [700, 10000])
  test(`flight audio predicts landing and restores through stop fade at range ${distance}`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.units = [w.hero];
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: distance, y: 0 } });
    w.step(16);
    const initial = flightAudioStates(w.projectiles, w.scoutVisuals, w.tick)[0];
    expect(initial).toBeDefined();
    while (!w.scoutVisuals.length) {
      const state = flightAudioStates(w.projectiles, w.scoutVisuals, w.tick)[0];
      expect(state.stopAge).toBe(initial.stopAge);
      expect(state.variant).toBe(initial.variant);
      w.step();
    }
    const at = flightAudioStates(w.projectiles, w.scoutVisuals, w.tick)[0];
    expect(at.stopAge).toBe(initial.stopAge);
    expect(at.fade).toBe(1);
    w.step(5);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    const state = flightAudioStates(w.projectiles, w.scoutVisuals, w.tick);
    expect(flightAudioStates(restored.projectiles, restored.scoutVisuals, restored.tick)).toEqual(
      state
    );
    expect(state[0].fade).toBeCloseTo(4 / 9, 10);
    w.step(4);
    expect(flightAudioStates(w.projectiles, w.scoutVisuals, w.tick)).toEqual([]);
  });
