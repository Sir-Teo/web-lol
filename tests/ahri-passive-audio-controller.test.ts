import { afterEach, expect, it, vi } from 'vitest';
import { AhriPassiveAudio } from '../src/audio/ahri-passive';
import { AHRI_PASSIVE_AUDIO_PROFILES as P } from '../src/content/ahri-passive-audio-policy';
import {
  passiveRecord,
  consumedPassiveRecord,
  passiveStates,
  ownPassiveScene,
} from './helpers/ahri-passive-audio';

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
  const controller = new AhriPassiveAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('deduplicates shared healing media and retries only the failed unique master explicitly', async () => {
  const { controller, requests, fail } = await loaded(158983157);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(5);
  expect(new Set(requests).size).toBe(5);
  controller.update(
    new Context() as any,
    true,
    [passiveRecord()],
    140,
    { x: 0, y: 0 },
    {},
    ownPassiveScene
  );
  expect(requests).toHaveLength(5);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(6);
  expect(requests.at(-1)).toBe(158983157);
});
it('mute and suspension release nodes; resumption seeks the original finite sample phase', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = consumedPassiveRecord(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownPassiveScene);
  update(130);
  expect(controller.activeVoices).toBe(3);
  update(131, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(140);
  expect(context.sources.slice(3).map((s) => s.starts[0][1])).toEqual(
    passiveStates([r], 140).map((s) => s.offset)
  );
  context.state = 'suspended';
  update(141);
  expect(controller.activeVoices).toBe(0);
});
it('source gain ownership, finite stops and sample rates remain per event despite shared PCM', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = consumedPassiveRecord();
  r.kind = 'minion';
  const champion = consumedPassiveRecord();
  champion.id++;
  const records = [r, champion],
    states = passiveStates(records, 130);
  controller.update(context as any, true, records, 130, { x: 0, y: 0 }, {}, ownPassiveScene);
  expect(context.sources).toHaveLength(states.length);
  for (let i = 0; i < states.length; i++) {
    const s = states[i],
      clip = P[s.kind].variants[s.variant];
    expect(context.sources[i].starts).toEqual([[10, s.offset]]);
    expect(context.sources[i].playbackRate.value).toBe(1);
    expect(context.sources[i].loop).toBe(false);
    expect(context.sources[i].scheduledStops[0]).toBeCloseTo(10 + s.endAge - s.age, 12);
    expect(context.gains[i * 2].gain.value).toBeCloseTo(0.2 * 10 ** (clip.gainDb / 20), 9);
  }
});
it('finished sources stay suppressed at frozen time; owner replacement and rewind reset them', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = consumedPassiveRecord(),
    owner = {};
  const update = (tick: number, nextOwner = owner) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, nextOwner, ownPassiveScene);
  update(130);
  const count = context.sources.length;
  for (const s of [...context.sources]) s.onended?.();
  update(130);
  expect(context.sources).toHaveLength(count);
  update(130, {});
  expect(context.sources).toHaveLength(count * 2);
  update(99);
  expect(controller.activeVoices).toBe(0);
});
it('four separate container caps suppress stolen voices and clean up retired owners', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => {
    const r = consumedPassiveRecord();
    r.id += i;
    r.kind = i % 2 ? 'minion' : 'champion';
    return r;
  });
  controller.update(context as any, true, records, 130, { x: 0, y: 0 }, owner, ownPassiveScene);
  expect(controller.activeVoices).toBe(16);
  const count = context.sources.length;
  controller.update(context as any, true, records, 131, { x: 0, y: 0 }, owner, ownPassiveScene);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 500, { x: 0, y: 0 }, owner, ownPassiveScene);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});

it('terminal time drains passive source tails without mutating the winning World', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const { World } = await import('../src/simulation/world');
  const { PRACTICE_FIXTURE } = await import('../src/content/practice-fixture');
  const { controller } = await loaded(),
    context = new Context(),
    game = new GameAudio();
  const w = new World(
    false,
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      developmentAhri: true,
      lineWalkable: () => true,
      reachable: (p) => ({ ...p }),
      findPath: (_a, b) => [{ ...b }],
    },
    'ahri'
  );
  w.nextWaveTick = 1e9;
  w.hero.ai = false;
  const victim = w.spawn('champion', 'red', { x: w.hero.x, y: w.hero.y }, 'lux');
  victim.ai = false;
  w.damage(w.hero, victim, 1e9, 'true');
  w.step();
  expect(w.ahriPassiveAudio[0].end?.reason).toBe('consumed');
  const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
  w.damage(w.hero, nexus, 1e9, 'true');
  (game.ahriPassive as any).controller = controller;
  for (const family of [
    'ahriCharm',
    'ahriOrb',
    'ahriFoxFire',
    'ahriSpiritRush',
    'ahriAA',
    'ahriLifecycle',
    'ahriRecall',
  ])
    (game as any)[family] = { status: 'ready', update() {}, stop() {} };
  game.context = context as any;
  const saved = w.snapshot();
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(3);
  context.currentTime += 10;
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(0);
  expect(w.snapshot()).toBe(saved);
});
