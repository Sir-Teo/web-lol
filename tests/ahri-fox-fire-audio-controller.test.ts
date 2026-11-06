import { afterEach, expect, it, vi } from 'vitest';
import { AhriFoxFireAudio } from '../src/audio/ahri-fox-fire';
import { AHRI_FOX_FIRE_AUDIO_PROFILES as P } from '../src/content/ahri-fox-fire-audio-policy';
import {
  foxFireRecord,
  firedFoxFireRecord,
  foxFireStates,
  ownFoxFireScene,
} from './helpers/ahri-fox-fire-audio';

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
  const controller = new AhriFoxFireAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads eleven masters and retries only the failed activation resource when explicitly asked', async () => {
  const { controller, requests, fail } = await loaded(966532132);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(11);
  controller.update(
    new Context() as any,
    true,
    [foxFireRecord()],
    140,
    { x: 0, y: 0 },
    {},
    ownFoxFireScene
  );
  expect(requests).toHaveLength(11);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(12);
  expect(requests.at(-1)).toBe(966532132);
});
it('keeps activation continuous and seeks its source phase across mute and suspension', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = foxFireRecord();
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownFoxFireScene);
  update(140);
  expect(controller.activeVoices).toBe(2);
  const loop = context.sources[1];
  expect(loop.loop).toBe(true);
  expect((loop as any).loopStart).toBe(0);
  expect((loop as any).loopEnd).toBe(P.activation.variants[0].durationSeconds);
  expect(loop.scheduledStops).toEqual([]);
  expect(context.sources[0].loop).toBe(false);
  update(141, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(150);
  expect(context.sources.slice(2).map((s) => s.starts[0][1])).toEqual(
    foxFireStates([r], 150).map((s) => s.offset)
  );
  context.state = 'suspended';
  update(151);
  expect(controller.activeVoices).toBe(0);
});
it('finite shot and hit sources seek at their own selected pitch and preserve source gains', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = firedFoxFireRecord(),
    states = foxFireStates([r], 150);
  controller.update(context as any, true, [r], 150, { x: 0, y: 0 }, {}, ownFoxFireScene);
  expect(context.sources).toHaveLength(states.length);
  expect(states.some((s) => s.rate !== 1)).toBe(true);
  for (let i = 0; i < states.length; i++) {
    const state = states[i],
      clip = P[state.kind].variants[state.variant];
    expect(context.sources[i].starts).toEqual([[10, state.offset]]);
    expect(context.sources[i].playbackRate.value).toBe(state.rate);
    expect(context.sources[i].loop).toBe(false);
    expect(context.gains[i * 2].gain.value).toBeCloseTo(0.2 * 10 ** (clip.gainDb / 20), 9);
  }
});
it('reschedules a live activation stop once and resumes its original Exp1 fade domain', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = foxFireRecord(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownFoxFireScene);
  update(140);
  const loop = [...(controller as any).voices.values()].find(
    (v: any) => v.containerId === P.activation.containerId
  ) as any;
  expect(loop.source.scheduledStops).toHaveLength(0);
  r.activationStop = { tick: 145, point: { x: 20, y: 0 }, reason: 'death', audience: ['blue'] };
  for (const f of r.fires)
    f.end = { tick: 145, point: { x: 100, y: 0 }, reason: 'death', audience: ['blue'] };
  update(145);
  expect(loop.source.scheduledStops).toEqual([10.2]);
  expect(loop.envelope.gain.ramps).toHaveLength(127);
  update(146);
  expect(loop.source.scheduledStops).toHaveLength(1);
  update(148, false);
  update(150);
  const resumed = [...(controller as any).voices.values()].find(
    (v: any) => v.containerId === P.activation.containerId
  ) as any;
  const t = (50 / 60 - 45 / 60) / 0.2;
  expect(resumed.envelope.gain.sets[0][0]).toBeCloseTo(1 - ((t + 1) * t) / 2, 12);
  expect(resumed.source.starts[0][1]).toBe(50 / 60);
  expect(resumed.source.scheduledStops[0]).toBeCloseTo(10 + 0.95 - 50 / 60, 12);
});
it('suppresses ended voices at a frozen tick and resets on world replacement or rewind', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = foxFireRecord();
  const update = (tick: number, nextOwner = owner) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, nextOwner, ownFoxFireScene);
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
it('caps all five source containers and never restarts stolen voices on the next frame', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => {
    const r = firedFoxFireRecord();
    r.id += i;
    r.sourceId += i;
    r.activationStop!.tick = 195;
    for (const f of r.fires) {
      f.launch!.tick = 190;
      f.end!.tick = 198;
    }
    return r;
  });
  controller.update(context as any, true, records, 200, { x: 0, y: 0 }, owner, ownFoxFireScene);
  expect(controller.activeVoices).toBe(16);
  const voices = [...(controller as any).voices.values()];
  for (const p of Object.values(P))
    expect(voices.filter((v: any) => v.containerId === p.containerId).length).toBeLessThanOrEqual(
      p.maxVoices
    );
  const count = context.sources.length;
  controller.update(context as any, true, records, 201, { x: 0, y: 0 }, owner, ownFoxFireScene);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 500, { x: 0, y: 0 }, owner, ownFoxFireScene);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});

it('ready Fox-Fire source replaces the generic W tone and failure keeps the fallback', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const game = new GameAudio();
  game.context = new Context() as any;
  const tone = vi.spyOn(game as any, 'tone').mockImplementation(() => {});
  const status = vi.spyOn(game.ahriFoxFire, 'status', 'get').mockReturnValue('ready');
  const event = { id: 1, type: 'cast', champion: 'ahri', text: 'w', x: 0, y: 0, tick: 1 };
  game.update([event as any], 1);
  expect(tone).not.toHaveBeenCalled();
  status.mockReturnValue('failed');
  game.update([{ ...event, id: 2 } as any], 2);
  expect(tone).toHaveBeenCalledTimes(1);
});
it('terminal clock drains activation, stop-tail and cast without advancing the winning World', async () => {
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
  w.nextWaveTick = 1e9;
  w.hero.ai = false;
  w.learnSpell('w');
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: w.hero.x, y: w.hero.y } });
  w.step(5);
  const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
  w.damage(w.hero, nexus, 1e9, 'true');
  expect(w.winner).toBe('blue');
  (game.ahriFoxFire as any).controller = controller;
  (game as any).ahriCharm = { status: 'ready', update() {}, stop() {} };
  (game as any).ahriOrb = { status: 'ready', update() {}, stop() {} };
  game.context = context as any;
  const saved = w.snapshot();
  (game as any).ahriSpiritRush = { status: 'ready', update() {}, stop() {} };
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(3);
  context.currentTime += 10;
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(0);
  expect(w.snapshot()).toBe(saved);
});
