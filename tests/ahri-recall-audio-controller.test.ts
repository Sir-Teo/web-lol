import { afterEach, expect, it, vi } from 'vitest';
import { AhriRecallAudio } from '../src/audio/ahri-recall';
import { AHRI_RECALL_AUDIO_PROFILE } from '../src/content/ahri-recall-audio-policy';
const P = { recall: AHRI_RECALL_AUDIO_PROFILE };
import { recallRecord, ownRecallScene } from './helpers/ahri-recall-audio';

class Param {
  value = 1;
  sets: number[][] = [];
  ramps: number[][] = [];
  setValueAtTime(...args: number[]) {
    this.sets.push(args);
  }
  linearRampToValueAtTime(...args: number[]) {
    this.ramps.push(args);
  }
  cancelScheduledValues() {}
  setTargetAtTime(value: number) {
    this.value = value;
  }
}
class Gain {
  gain = new Param();
  disconnected = false;
  connect(target: unknown) {
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
}
class Source {
  buffer: unknown;
  loop = true;
  playbackRate = new Param();
  onended: (() => void) | null = null;
  starts: number[][] = [];
  stopped = false;
  scheduledStops: number[] = [];
  disconnected = false;
  connect(target: Gain) {
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
  start(...args: number[]) {
    this.starts.push(args);
  }
  stop(time?: number) {
    if (time === undefined) this.stopped = true;
    else this.scheduledStops.push(time);
  }
}
class Context {
  state = 'running';
  currentTime = 10;
  destination = {};
  sources: Source[] = [];
  gains: Gain[] = [];
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  createGain() {
    const gain = new Gain();
    this.gains.push(gain);
    return gain;
  }
}
async function loaded(failId: number | null = null) {
  const requests: number[] = [];
  const fail = { id: failId };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const id = Number(url.split('/').at(-1)!.replace('.wav', ''));
      requests.push(id);
      return {
        ok: id !== fail.id,
        status: 503,
        arrayBuffer: async () => new Uint32Array([id]).buffer,
      };
    })
  );
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      async decodeAudioData(raw: ArrayBuffer) {
        const id = new Uint32Array(raw)[0],
          clip = Object.values(P)
            .flatMap((p) => [...p.variants])
            .find((v) => v.id === id)!;
        return {
          numberOfChannels: 1,
          sampleRate: clip.sampleRate,
          length: clip.frames,
          duration: clip.durationSeconds,
        };
      }
    }
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const controller = new AhriRecallAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads the one exact master and retries failures only on explicit load', async () => {
  const { controller, requests, fail } = await loaded(795142737);
  expect(controller.status).toBe('failed');
  expect(requests).toEqual([795142737]);
  controller.update(
    new Context() as any,
    true,
    [recallRecord()],
    110,
    { x: 0, y: 0 },
    {},
    ownRecallScene
  );
  expect(requests).toHaveLength(1);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toEqual([795142737, 795142737]);
});
it('mute and suspension release nodes while resume seeks the original finite phase', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = recallRecord(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownRecallScene);
  update(110);
  expect(controller.activeVoices).toBe(1);
  expect(context.sources[0].loop).toBe(false);
  expect(context.gains[0].gain.value).toBeCloseTo(0.2 * 10 ** (-5 / 20), 9);
  update(111, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources[0].disconnected).toBe(true);
  update(120);
  expect(context.sources[1].starts).toEqual([[10, 20 / 60]]);
  context.state = 'suspended';
  update(121);
  expect(controller.activeVoices).toBe(0);
});
it('local interruption reschedules the envelope and source stop with finite times', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = recallRecord(),
    owner = {};
  const update = (tick: number) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, owner, ownRecallScene);
  update(110);
  const natural = context.sources[0].scheduledStops[0];
  r.end = { tick: 110, point: { x: 30, y: 40 }, reason: 'cancelled' };
  update(110);
  expect(context.sources[0].scheduledStops.at(-1)).toBeCloseTo(10.02, 9);
  expect(natural).toBeGreaterThan(19);
  expect(context.gains[1].gain.ramps.at(-1)?.[0]).toBeCloseTo(0, 12);
  update(112);
  expect(controller.activeVoices).toBe(0);
});
it('ended sources cannot revive; replacement and rewind reset ownership without decoding again', async () => {
  const { controller, requests } = await loaded(),
    context = new Context(),
    r = recallRecord(),
    owner = {};
  const update = (tick: number, o = owner) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, o, ownRecallScene);
  update(110);
  context.sources[0].onended?.();
  update(110);
  expect(context.sources).toHaveLength(1);
  update(110, {});
  expect(context.sources).toHaveLength(2);
  update(99);
  expect(controller.activeVoices).toBe(0);
  expect(requests).toHaveLength(1);
});
it('raw zero declarations remain separate from a local sixteen voice ceiling and stolen sources stay suppressed', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => ({
    ...recallRecord(),
    id: 100 + i,
    sourceId: 1000 + i,
  }));
  controller.update(context as any, true, records, 110, { x: 0, y: 0 }, owner, ownRecallScene);
  expect(controller.activeVoices).toBe(16);
  const count = context.sources.length;
  controller.update(context as any, true, records, 111, { x: 0, y: 0 }, owner, ownRecallScene);
  expect(context.sources).toHaveLength(count);
});
it('the shared winning clock drains the local Recall release without changing terminal state', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const { World } = await import('../src/simulation/world');
  const { PRACTICE_FIXTURE } = await import('../src/content/practice-fixture');
  const { controller } = await loaded(),
    context = new Context(),
    game = new GameAudio();
  const w = new World(
    false,
    { ...PRACTICE_FIXTURE, initialUnits: [], developmentAhri: true },
    'ahri'
  );
  w.hero.ai = false;
  w.nextWaveTick = 1e9;
  w.enqueue({ type: 'recall', unit: w.hero.id });
  w.step();
  const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  w.damage(w.hero, nexus, 1e6, 'true');
  (game.ahriRecall as any).controller = controller;
  for (const family of [
    'ahriCharm',
    'ahriOrb',
    'ahriFoxFire',
    'ahriSpiritRush',
    'ahriPassive',
    'ahriAA',
    'ahriLifecycle',
  ])
    (game as any)[family] = { status: 'ready', update() {}, stop() {} };
  game.context = context as any;
  const saved = w.snapshot();
  game.updateAhri(w, w.hero);
  expect(controller.activeVoices).toBe(1);
  context.currentTime += 1;
  game.updateAhri(w, w.hero);
  expect(controller.activeVoices).toBe(0);
  expect(w.snapshot()).toBe(saved);
});
