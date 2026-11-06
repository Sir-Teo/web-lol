import { afterEach, expect, it, vi } from 'vitest';
import { AhriSpiritRushAudio } from '../src/audio/ahri-spirit-rush';
import { AHRI_SPIRIT_RUSH_AUDIO_PROFILES as P } from '../src/content/ahri-spirit-rush-audio-policy';
import {
  spiritRushRecord,
  firedSpiritRushRecord,
  spiritRushStates,
  ownSpiritRushScene,
} from './helpers/ahri-spirit-rush-audio';

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
  const controller = new AhriSpiritRushAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads fourteen masters and explicitly retries only a failed activation resource', async () => {
  const { controller, requests, fail } = await loaded(698907153);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(14);
  controller.update(
    new Context() as any,
    true,
    [spiritRushRecord()],
    140,
    { x: 0, y: 0 },
    {},
    ownSpiritRushScene
  );
  expect(requests).toHaveLength(14);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(15);
  expect(requests.at(-1)).toBe(698907153);
});
it('activation stays continuous and resumes at its original sample phase after mute or suspension', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = spiritRushRecord();
  const update = (tick: number, audible = true) =>
    controller.update(
      context as any,
      audible,
      [r],
      tick,
      { x: 0, y: 0 },
      owner,
      ownSpiritRushScene
    );
  update(140);
  expect(controller.activeVoices).toBe(2);
  const loop = context.sources.find((s) => s.loop)!;
  expect((loop as any).loopStart).toBe(0);
  expect((loop as any).loopEnd).toBe(P.activation.variants[0].durationSeconds);
  expect(loop.scheduledStops).toEqual([]);
  update(141, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(150);
  expect(context.sources.slice(2).map((s) => s.starts[0][1])).toEqual(
    spiritRushStates([r], 150).map((s) => s.offset)
  );
  context.state = 'suspended';
  update(151);
  expect(controller.activeVoices).toBe(0);
});
it('cast, missiles and hit modifiers preserve independent source rates, gains and sample offsets', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = firedSpiritRushRecord(),
    states = spiritRushStates([r], 130);
  controller.update(context as any, true, [r], 130, { x: 0, y: 0 }, {}, ownSpiritRushScene);
  expect(context.sources).toHaveLength(states.length);
  expect(states.some((s) => s.rate !== 1)).toBe(true);
  for (let i = 0; i < states.length; i++) {
    const state = states[i],
      clip = P[state.kind].variants[state.variant];
    expect(context.sources[i].starts).toEqual([[10, state.offset]]);
    expect(context.sources[i].playbackRate.value).toBe(state.rate);
    expect(context.sources[i].loop).toBe(state.loop);
    expect(context.gains[i * 2].gain.value).toBeCloseTo(0.2 * 10 ** (clip.gainDb / 20), 9);
  }
});
it('window closure reschedules its local Linear release once and resumes the original domain', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = spiritRushRecord(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(
      context as any,
      audible,
      [r],
      tick,
      { x: 0, y: 0 },
      owner,
      ownSpiritRushScene
    );
  update(140);
  const loop = [...(controller as any).voices.values()].find(
    (v: any) => v.containerId === P.activation.containerId
  ) as any;
  expect(loop.source.scheduledStops).toHaveLength(0);
  r.end = { tick: 145, point: { x: 20, y: 0 }, reason: 'match-end', audience: ['blue'] };
  update(145);
  expect(loop.source.scheduledStops).toEqual([10.02]);
  expect(loop.envelope.gain.ramps).toHaveLength(1);
  update(145.25);
  expect(loop.source.scheduledStops).toHaveLength(1);
  update(145.5, false);
  update(146);
  const resumed = [...(controller as any).voices.values()].find(
    (v: any) => v.containerId === P.activation.containerId
  ) as any;
  expect(resumed.envelope.gain.sets[0][0]).toBeCloseTo(1 - (46 / 60 - 45 / 60) / 0.02, 12);
  expect(resumed.source.starts[0][1]).toBe(46 / 60);
  expect(resumed.source.scheduledStops[0]).toBeCloseTo(10 + 0.77 - 46 / 60, 12);
});
it('ended voices cannot restart at frozen time and replacement/rewind resets ownership', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = spiritRushRecord();
  const update = (tick: number, nextOwner = owner) =>
    controller.update(
      context as any,
      true,
      [r],
      tick,
      { x: 0, y: 0 },
      nextOwner,
      ownSpiritRushScene
    );
  update(140);
  const count = context.sources.length;
  for (const s of [...context.sources]) s.onended?.();
  update(140);
  expect(context.sources).toHaveLength(count);
  update(140, {});
  expect(context.sources).toHaveLength(count * 2);
  update(99);
  expect(controller.activeVoices).toBe(0);
});
it('caps all source containers and suppresses stolen multi-index voices on later frames', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => {
    const r = firedSpiritRushRecord();
    r.id += i;
    r.sourceId += i;
    r.end = { tick: 195, point: { x: 20, y: 0 }, reason: 'match-end', audience: ['blue'] };
    const b = structuredClone(r.bursts[0]);
    b.index = 1;
    b.tick = 190;
    b.dashEndTick = 194;
    for (const p of b.bolts) p.end!.tick = 194;
    r.bursts.push(b);
    return r;
  });
  controller.update(
    context as any,
    true,
    records,
    195.5,
    { x: 0, y: 0 },
    owner,
    ownSpiritRushScene
  );
  expect(controller.activeVoices).toBe(12);
  const voices = [...(controller as any).voices.values()];
  for (const p of Object.values(P))
    expect(voices.filter((v: any) => v.containerId === p.containerId).length).toBeLessThanOrEqual(
      p.maxVoices
    );
  const count = context.sources.length;
  controller.update(context as any, true, records, 196, { x: 0, y: 0 }, owner, ownSpiritRushScene);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 500, { x: 0, y: 0 }, owner, ownSpiritRushScene);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});

it('ready Spirit Rush source owns the generic R tone while failure retains its fallback', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const game = new GameAudio();
  game.context = new Context() as any;
  const tone = vi.spyOn(game as any, 'tone').mockImplementation(() => {});
  const status = vi.spyOn(game.ahriSpiritRush, 'status', 'get').mockReturnValue('ready');
  const event = { id: 1, type: 'cast', champion: 'ahri', text: 'r', x: 0, y: 0, tick: 1 };
  game.update([event as any], 1);
  expect(tone).not.toHaveBeenCalled();
  status.mockReturnValue('failed');
  game.update([{ ...event, id: 2 } as any], 2);
  expect(tone).toHaveBeenCalledTimes(1);
});
it('terminal time drains local activation release, deactivation and cast without changing victory', async () => {
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
  w.gainExperience(1e6);
  w.learnSpell('r');
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'r',
    point: { x: w.hero.x + 900, y: w.hero.y },
  });
  w.step(5);
  const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
  w.damage(w.hero, nexus, 1e9, 'true');
  expect(w.winner).toBe('blue');
  (game.ahriSpiritRush as any).controller = controller;
  for (const family of ['ahriCharm', 'ahriOrb', 'ahriFoxFire', 'ahriPassive'])
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
