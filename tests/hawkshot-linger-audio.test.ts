import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HAWKSHOT_LINGER_AUDIO as A } from '../src/content/hawkshot-linger-audio';
import { HAWKSHOT_PRESENTATION_TAIL_SECONDS } from '../src/content/hawkshot-linger-timing';
import { lingerAudioState, lingerFade } from '../src/audio/hawkshot-linger-state';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('linger source preserves infinite looping, gain and Exp1 stop transition', () => {
  const graph = JSON.parse(readFileSync('docs/reference/hawkshot-audio.json', 'utf8'));
  const stop = graph.nodes.find((n: any) => n.id === 852892569).parameters;
  expect(stop.find((p: any) => p[0].endsWith('/eFadeCurve'))[2]).toBe(String(A.fadeCurve));
  expect(A.fadeCurve).toBe(6);
  const property = (id: number, label: string) => {
    const fields = graph.nodes.find((n: any) => n.id === id).parameters;
    const pid = fields.find((p: any) => p[0].endsWith('/pID') && p[3]?.includes(`[${label}]`));
    return Number(fields.find((p: any) => p[0] === pid[0].slice(0, -3) + 'pValue')[2]);
  };
  expect(A.fadeSeconds).toBe(property(852892569, 'TransitionTime') / 1000);
  expect(A.gainDb).toBe(property(604153567, 'MakeUpGain'));
  expect(property(604153567, 'Loop')).toBe(0);
  expect(A.loop).toBe(true);
  expect(
    createHash('sha256')
      .update(readFileSync(`public/${A.url}`))
      .digest('hex')
  ).toBe(A.sha256);
  expect([lingerFade(0), lingerFade(0.5), lingerFade(1)]).toEqual([1, 0.625, 0]);
});

test('audio phase and final fade restore after the particle tail without restoring vision', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 700, y: 0 } });
  w.step(45);
  const effect = w.scoutVisuals[0],
    duration = 203769 / 44100;
  expect(HAWKSHOT_PRESENTATION_TAIL_SECONDS).toBe(1.25);
  expect(effect.endTick - effect.stopTick).toBe(75);
  w.step(366); // 6.1 seconds after arrival; all sustained particles have expired.
  expect(w.visionAreas).toHaveLength(0);
  expect(w.scoutVisuals).toHaveLength(1);
  const state = lingerAudioState(effect, w.tick, duration)!;
  expect(state.offset).toBeCloseTo(6.1 % duration, 10);
  expect(state.fade).toBeCloseTo(lingerFade(1.1 / 1.25), 10);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(lingerAudioState(restored.scoutVisuals[0], restored.tick, duration)).toEqual(state);
  const previous = JSON.parse(w.snapshot());
  previous.version = 21;
  expect(() => World.fromSnapshot(JSON.stringify(previous), w.battlefield)).toThrow();
  w.step(9);
  expect(w.scoutVisuals).toHaveLength(0);
  expect(lingerAudioState(effect, w.tick, duration)).toBeNull();
});
