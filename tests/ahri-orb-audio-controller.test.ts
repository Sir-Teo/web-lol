import { afterEach, expect, it, vi } from 'vitest';
import { AhriOrbAudio } from '../src/audio/ahri-orb';
import { AHRI_ORB_AUDIO_PROFILES as P } from '../src/content/ahri-orb-audio-policy';
import { orbRecord, caughtOrbRecord, orbStates, ownOrbScene } from './helpers/ahri-orb-audio';

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
          clip = Object.values(P)
            .flatMap((p) => [...p.variants])
            .find((v) => v.id === id)!;
        return { numberOfChannels: 1, sampleRate: clip.sampleRate, length: clip.frames };
      }
    }
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const controller = new AhriOrbAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads twenty-two masters once and explicitly retries only a failed media', async () => {
  const { controller, requests, fail } = await loaded(504850886);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(22);
  controller.update(
    new Context() as any,
    true,
    [orbRecord()],
    145,
    { x: 0, y: 0 },
    {},
    ownOrbScene
  );
  expect(requests).toHaveLength(22);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(23);
  expect(requests.at(-1)).toBe(504850886);
});
it('seeks using each source pitch and resumes from original game time after mute or suspension', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = orbRecord();
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownOrbScene);
  update(145);
  const states = orbStates([r], 145);
  expect(controller.activeVoices).toBe(states.length);
  for (let i = 0; i < states.length; i++) {
    const state = states[i],
      clip = P[state.kind].variants[state.variant];
    expect(context.sources[i].starts).toEqual([[10, state.offset]]);
    expect(context.sources[i].playbackRate.value).toBe(state.rate);
    expect(context.sources[i].loop).toBe(false);
    expect(context.gains[i * 2].gain.value).toBeCloseTo(0.2 * 10 ** (clip.gainDb / 20), 9);
  }
  update(146, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(150);
  expect(context.sources.slice(states.length).map((s) => s.starts[0][1])).toEqual(
    orbStates([r], 150).map((s) => s.offset)
  );
  context.state = 'suspended';
  update(151);
  expect(controller.activeVoices).toBe(0);
});
it('suppresses naturally ended voices at frozen time and resets on replacement or rewind', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = orbRecord();
  const update = (tick: number, nextOwner = owner) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, nextOwner, ownOrbScene);
  update(145);
  const count = context.sources.length;
  for (const source of [...context.sources]) source.onended?.();
  update(145);
  expect(context.sources).toHaveLength(count);
  update(145, {});
  expect(context.sources).toHaveLength(count * 2);
  update(90);
  expect(controller.activeVoices).toBe(0);
});
it('caps every child and root independently and never revives stolen voices next frame', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => {
    const r = caughtOrbRecord(i + 10);
    r.turn!.tick = 116;
    r.end!.tick = 130;
    r.hits = Array.from({ length: 18 }, (_, j) => ({
      tick: 130 + (j % 9),
      point: { x: 300, y: 0 },
      targetId: 99 + (j % 9),
      leg: j < 9 ? ('outward' as const) : ('return' as const),
      audience: ['blue' as const],
    }));
    return r;
  });
  controller.update(context as any, true, records, 145, { x: 0, y: 0 }, owner, ownOrbScene);
  expect(controller.activeVoices).toBe(20);
  const voices = [...(controller as any).voices.values()];
  for (const p of Object.values(P)) {
    expect(voices.filter((v) => v.containerId === p.containerId).length).toBeLessThanOrEqual(
      p.maxVoices
    );
    expect(voices.filter((v) => v.rootId === p.rootId).length).toBeLessThanOrEqual(p.rootMaxVoices);
  }
  const count = context.sources.length;
  controller.update(context as any, true, records, 146, { x: 0, y: 0 }, owner, ownOrbScene);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 300, { x: 0, y: 0 }, owner, ownOrbScene);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});
it('reschedules a live stop once and seeks a later return fade in its original domain', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    r = caughtOrbRecord();
  r.end = null;
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownOrbScene);
  update(175);
  const returning = [...(controller as any).voices.values()].find(
    (v) => v.containerId === P.return.containerId
  );
  expect(returning.envelope.gain.ramps).toHaveLength(0);
  r.end = { tick: 180, point: { x: 20, y: 0 }, reason: 'caught', audience: ['blue'] };
  r.turn!.currentPoint = { x: 20, y: 0 };
  update(180);
  expect(returning.envelope.gain.ramps).toHaveLength(1);
  update(181);
  expect(returning.envelope.gain.ramps).toHaveLength(1);
  update(185, false);
  update(190);
  const resumed = [...(controller as any).voices.values()].find(
    (v) => v.containerId === P.return.containerId
  );
  expect(resumed.envelope.gain.sets[0][0]).toBeCloseTo(1 - (40 / 60 - 0.5) / 0.75, 12);
});

it('ready Q source replaces the generic cast tone and unavailable source preserves its fallback', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const game = new GameAudio();
  game.context = new Context() as any;
  const tone = vi.spyOn(game as any, 'tone').mockImplementation(() => {});
  const status = vi.spyOn(game.ahriOrb, 'status', 'get').mockReturnValue('ready');
  const event = { id: 1, type: 'cast', champion: 'ahri', text: 'q', x: 0, y: 0, tick: 1 };
  game.update([event as any], 1);
  expect(tone).not.toHaveBeenCalled();
  status.mockReturnValue('failed');
  game.update([{ ...event, id: 2 } as any], 2);
  expect(tone).toHaveBeenCalledTimes(1);
});
it('terminal clock drains Q tails without mutating the frozen winning snapshot', async () => {
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
  w.learnSpell('q');
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'q',
    point: { x: w.hero.x + 900, y: w.hero.y },
  });
  w.step(16);
  const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
  w.damage(w.hero, nexus, 1e9, 'true');
  expect(w.winner).toBe('blue');
  (game.ahriOrb as any).controller = controller;
  (game as any).ahriCharm = { status: 'ready', update() {}, stop() {} };
  game.context = context as any;
  const saved = w.snapshot();
  (game as any).ahriFoxFire = { status: 'ready', update() {}, stop() {} };
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(2);
  context.currentTime += 10;
  game.updateAhri(w);
  expect(controller.activeVoices).toBe(0);
  expect(w.snapshot()).toBe(saved);
});
