import { afterEach, expect, it, vi } from 'vitest';
import { AhriCharmAudio } from '../src/audio/ahri-charm';
import { AHRI_CHARM_AUDIO as P } from '../src/content/ahri-charm-audio';
import { charmRecord as record, states } from './helpers/ahri-charm-audio';
import { charmEnvelope } from '../src/audio/ahri-charm-state';

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
          clip = P.flatMap((p) => [...p.variants]).find((v) => v.id === id)!;
        return { numberOfChannels: 1, sampleRate: clip.sampleRate, length: clip.frames };
      }
    }
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const controller = new AhriCharmAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads nine source masters once and retries only the failed media explicitly', async () => {
  const { controller, requests, fail } = await loaded(387105962);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(9);
  controller.update(
    new Context() as any,
    true,
    [record()],
    states([record()], 145),
    145,
    { x: 0, y: 0 },
    {}
  );
  expect(requests).toHaveLength(9);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(10);
  expect(requests.at(-1)).toBe(387105962);
});
it('seeks at saved offset and resumes from simulation time after mute or suspension', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(
      context as any,
      audible,
      [record()],
      states([record()], tick),
      tick,
      { x: 0, y: 0 },
      owner
    );
  update(145);
  const expected = states([record()], 145);
  expect(controller.activeVoices).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(context.sources[i].starts).toEqual([[10, expected[i].offset]]);
    expect(context.sources[i].playbackRate.value).toBe(1);
    expect(context.sources[i].loop).toBe(false);
    expect(context.gains[i * 2].gain.value).toBeCloseTo(
      0.2 * 10 ** (P[expected[i].profileIndex].gainDb / 20)
    );
  }
  update(146, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(150);
  const next = states([record()], 150);
  expect(context.sources.slice(expected.length).map((s) => s.starts[0][1])).toEqual(
    next.map((s) => s.offset)
  );
  context.state = 'suspended';
  update(150);
  expect(controller.activeVoices).toBe(0);
});
it('does not replay naturally ended voices at a frozen tick and resets ownership', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  controller.update(
    context as any,
    true,
    [record()],
    states([record()], 145),
    145,
    { x: 0, y: 0 },
    owner
  );
  const count = context.sources.length;
  for (const source of [...context.sources]) source.onended?.();
  controller.update(
    context as any,
    true,
    [record()],
    states([record()], 145),
    145,
    { x: 0, y: 0 },
    owner
  );
  expect(context.sources).toHaveLength(count);
  controller.update(
    context as any,
    true,
    [record()],
    states([record()], 145),
    145,
    { x: 0, y: 0 },
    {}
  );
  expect(context.sources).toHaveLength(count * 2);
  controller.update(context as any, true, [], [], 90, { x: 0, y: 0 }, owner);
  expect(controller.activeVoices).toBe(0);
});
it('caps each container independently and never revives stolen voices on the next frame', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => record(i + 1));
  controller.update(
    context as any,
    true,
    records,
    states(records, 145),
    145,
    { x: 0, y: 0 },
    owner
  );
  expect(controller.activeVoices).toBe(8);
  const count = context.sources.length;
  controller.update(
    context as any,
    true,
    records,
    states(records, 146),
    146,
    { x: 0, y: 0 },
    owner
  );
  expect(context.sources).toHaveLength(count);
  controller.reset();
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped)).toBe(true);
});

it('slices the original stop curve on mute-resume and updates a live flight envelope', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const r = record();
  r.stop = null;
  r.hit = null;
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], states([r], tick), tick, { x: 0, y: 0 }, owner);
  update(116);
  const flightIndex = states([r], 116).findIndex((s) => s.profileIndex === 1);
  const envelope = context.gains[flightIndex * 2 + 1].gain;
  expect(envelope.sets[0][0]).toBeCloseTo(1 / 3, 6);
  expect(envelope.ramps[0][0]).toBe(1);
  expect(envelope.ramps[0][1]).toBeCloseTo(10 + 0.05 - 1 / 60);
  r.stop = { tick: 117, point: { x: 400, y: 0 }, reason: 'range' };
  update(117);
  const state = states([r], 117).find((s) => s.profileIndex === 1)!;
  expect(envelope.sets.at(-1)![0]).toBeCloseTo(2 / 3, 6);
  const ramps = envelope.ramps.slice(-127);
  expect(ramps).toHaveLength(127);
  for (const i of [0, 30, 62, 95, 126]) {
    const age = state.offset + ((state.endAge - state.offset) * (i + 1)) / 127;
    expect(ramps[i][0]).toBeCloseTo(charmEnvelope(state, age), 12);
    expect(ramps[i][1]).toBeCloseTo(10 + age - state.offset, 12);
  }
  update(130, false);
  update(150);
  const late = states([r], 150).find((s) => s.profileIndex === 1)!;
  const resumed = context.gains.at(-1)!.gain;
  expect(resumed.sets[0][0]).toBeCloseTo(charmEnvelope(late), 12);
  expect(resumed.sets[0][0]).toBeLessThan(2 / 3);
});

it('ready source Charm replaces the generic cast tone while unavailable audio keeps its fallback', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const game = new GameAudio();
  game.context = new Context() as any;
  const tone = vi.spyOn(game as any, 'tone').mockImplementation(() => {});
  const status = vi.spyOn(game.ahriCharm, 'status', 'get').mockReturnValue('ready');
  const event = { id: 1, type: 'cast', champion: 'ahri', text: 'e', x: 0, y: 0, tick: 1 };
  game.update([event as any], 1);
  expect(tone).not.toHaveBeenCalled();
  status.mockReturnValue('failed');
  game.update([{ ...event, id: 2 } as any], 2);
  expect(tone).toHaveBeenCalledTimes(1);
});

it('terminal audio time drains finite Charm tails without changing the saved winning world', async () => {
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
  w.learnSpell('e');
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'e',
    point: { x: w.hero.x + 900, y: w.hero.y },
  });
  w.step(16);
  const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
  w.damage(w.hero, nexus, 1e9, 'true');
  expect(w.winner).toBe('blue');
  (game as any).ahriOrb = { status: 'ready', update() {}, stop() {} };
  (game.ahriCharm as any).controller = controller;
  game.context = context as any;
  const saved = w.snapshot();
  (game as any).ahriFoxFire = { status: 'ready', update() {}, stop() {} };
  (game as any).ahriSpiritRush = { status: 'ready', update() {}, stop() {} };
  (game as any).ahriPassive = { status: 'ready', update() {}, stop() {} };
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(2);
  context.currentTime += 10;
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(0);
  expect(w.snapshot()).toBe(saved);
});

it('schedules the source Linear fade at exactly 50 ms instead of quantizing it across the whole clip', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = record();
  r.stop = null;
  r.hit = null;
  const initial = states([r], 115);
  controller.update(context as any, true, [r], initial, 115, { x: 0, y: 0 }, {});
  const index = initial.findIndex((s) => s.profileIndex === 1);
  const envelope = context.gains[index * 2 + 1].gain;
  expect(envelope.sets).toEqual([[0, 10]]);
  expect(envelope.ramps).toEqual([[1, 10.05]]);
});
