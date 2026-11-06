import { afterEach, expect, it, vi } from 'vitest';
import { AhriAttackAudio } from '../src/audio/ahri-attack';
import { AHRI_ATTACK_AUDIO_PROFILES as P } from '../src/content/ahri-attack-audio-policy';
import {
  attackRecord,
  firedAttackRecord,
  attackStates,
  ownAttackScene,
} from './helpers/ahri-attack-audio';

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
  const controller = new AhriAttackAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads twelve unique masters and retries only the failed source explicitly', async () => {
  const { controller, requests, fail } = await loaded(1071743868);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(12);
  controller.update(
    new Context() as any,
    true,
    [attackRecord()],
    110,
    { x: 0, y: 0 },
    {},
    ownAttackScene
  );
  expect(requests).toHaveLength(12);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(13);
  expect(requests.at(-1)).toBe(1071743868);
});
it('mute and suspension release nodes while resume seeks the original cast missile and contact phases', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = firedAttackRecord(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownAttackScene);
  update(132);
  expect(controller.activeVoices).toBe(3);
  update(132.25, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(133);
  expect(context.sources.slice(3).map((s) => s.starts[0][1])).toEqual(
    attackStates([r], 133).map((s) => s.offset)
  );
  context.state = 'suspended';
  update(134);
  expect(controller.activeVoices).toBe(0);
});
it('source gain variants pitch modifiers and exact finite offsets remain per container', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = firedAttackRecord(),
    states = attackStates([r], 132);
  controller.update(context as any, true, [r], 132, { x: 0, y: 0 }, {}, ownAttackScene);
  expect(context.sources).toHaveLength(3);
  expect(states.some((s) => s.rate !== 1)).toBe(true);
  for (let i = 0; i < states.length; i++) {
    const s = states[i],
      clip = P[s.kind].variants[s.variant];
    expect(context.sources[i].starts).toEqual([[10, s.offset]]);
    expect(context.sources[i].loop).toBe(false);
    expect(context.sources[i].playbackRate.value).toBe(s.rate);
    expect(context.gains[i * 2].gain.value).toBeCloseTo(0.2 * 10 ** (clip.gainDb / 20), 9);
  }
});
it('a newly observed stop schedules once and late resume keeps the original Linear fade domain', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = firedAttackRecord(),
    owner = {};
  r.launch!.end = null;
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownAttackScene);
  update(125);
  const voice = [...(controller as any).voices.values()].find(
    (v: any) => v.containerId === P.launch.containerId
  ) as any;
  r.launch!.end = { tick: 128, point: { x: 350, y: 0 }, reason: 'hit', audience: ['blue'] };
  update(129);
  expect(voice.source.scheduledStops).toHaveLength(2);
  expect(voice.source.scheduledStops.at(-1)).toBeCloseTo(10 + (0.1 - 1 / 60), 12);
  update(129.25);
  expect(voice.source.scheduledStops).toHaveLength(2);
  update(129.5, false);
  update(130);
  const resumed = [...(controller as any).voices.values()].find(
    (v: any) => v.containerId === P.launch.containerId
  ) as any;
  expect(resumed.envelope.gain.sets[0][0]).toBeCloseTo(2 / 3, 12);
  expect(resumed.source.starts[0][1]).toBe(12 / 60);
});
it('ended sources stay suppressed at frozen time while owner replacement and rewind reset them', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = firedAttackRecord(),
    owner = {};
  const update = (tick: number, nextOwner = owner) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, nextOwner, ownAttackScene);
  update(132);
  const count = context.sources.length;
  for (const s of [...context.sources]) s.onended?.();
  update(132);
  expect(context.sources).toHaveLength(count);
  update(132, {});
  expect(context.sources).toHaveLength(count * 2);
  update(99);
  expect(controller.activeVoices).toBe(0);
});
it('shared ordinary and critical containers cap at eight voices and never revive stolen swings', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {},
    records = Array.from({ length: 30 }, (_, i) => {
      const r = firedAttackRecord();
      r.sourceId += i;
      r.launch!.id += i;
      r.critical = !!(i % 2);
      return r;
    });
  controller.update(context as any, true, records, 132, { x: 0, y: 0 }, owner, ownAttackScene);
  expect(controller.activeVoices).toBe(8);
  const count = context.sources.length;
  controller.update(context as any, true, records, 132.5, { x: 0, y: 0 }, owner, ownAttackScene);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 500, { x: 0, y: 0 }, owner, ownAttackScene);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});
it('fallback suppression survives first owner binding and explicit failed-resource retry', async () => {
  const { controller, fail } = await loaded(1071743868),
    context = new Context(),
    r = firedAttackRecord(),
    owner = {};
  controller.suppressSwing(r.sourceId, r.startTick);
  fail.id = null;
  await controller.load();
  controller.update(context as any, true, [r], 132, { x: 0, y: 0 }, owner, ownAttackScene);
  expect(controller.activeVoices).toBe(0);
  controller.update(context as any, true, [r], 132, { x: 0, y: 0 }, {}, ownAttackScene);
  expect(controller.activeVoices).toBe(3);
});
it('lazy import preserves current fallback ownership and discards it across a world replacement', async () => {
  await loaded();
  const { LazyAhriAttackAudio } = await import('../src/audio/ahri-attack-lazy');
  const r = firedAttackRecord(),
    context = new Context();
  for (const replacement of [false, true]) {
    const lazy = new LazyAhriAttackAudio(),
      owner = {},
      next = {};
    lazy.update(null, false, [r], 132, { x: 0, y: 0 }, owner, ownAttackScene);
    lazy.suppressSwing(r.sourceId, r.startTick);
    if (replacement) lazy.update(null, false, [r], 132, { x: 0, y: 0 }, next, ownAttackScene);
    await lazy.load();
    lazy.update(
      context as any,
      true,
      [r],
      132,
      { x: 0, y: 0 },
      replacement ? next : owner,
      ownAttackScene
    );
    expect(lazy.activeVoices).toBe(replacement ? 3 : 0);
    lazy.stop();
  }
});
it('ready source owns only tagged Ahri attack feedback while failure retains and records fallback', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const game = new GameAudio();
  game.context = new Context() as any;
  const tone = vi.spyOn(game as any, 'tone').mockImplementation(() => {}),
    suppress = vi.spyOn(game.ahriAA, 'suppressSwing'),
    status = vi.spyOn(game.ahriAA, 'status', 'get').mockReturnValue('ready');
  const event = {
    id: 1,
    type: 'attack',
    champion: 'ahri',
    unit: 7,
    ahriAAStartTick: 100,
    x: 0,
    y: 0,
    tick: 118,
  };
  game.update([event as any], 118);
  expect(tone).not.toHaveBeenCalled();
  status.mockReturnValue('failed');
  game.update([{ ...event, id: 2 } as any], 118);
  expect(tone).toHaveBeenCalledTimes(1);
  expect(suppress).toHaveBeenCalledWith(7, 100);
  status.mockReturnValue('ready');
  const untagged = { ...event, id: 3 };
  delete (untagged as any).ahriAAStartTick;
  game.update([untagged as any], 118);
  expect(tone).toHaveBeenCalledTimes(2);
});

it('terminal time drains cast missile-stop and hit tails without changing the winning World', async () => {
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
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 450, y: w.hero.y });
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, armor: 0 });
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.step(35);
  w.setOrder(w.hero, { type: 'idle' });
  expect(w.ahriAttackAudio[0].launch?.end?.reason).toBe('hit');
  const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
  w.damage(w.hero, nexus, 1e9, 'true');
  (game.ahriAA as any).controller = controller;
  for (const family of [
    'ahriCharm',
    'ahriOrb',
    'ahriFoxFire',
    'ahriSpiritRush',
    'ahriPassive',
    'ahriLifecycle',
    'ahriRecall',
  ])
    (game as any)[family] = { status: 'ready', update() {}, stop() {} };
  game.context = context as any;
  const saved = w.snapshot();
  game.updateAhri(w, w.hero);
  expect(controller.activeVoices).toBe(3);
  context.currentTime += 10;
  game.updateAhri(w, w.hero);
  expect(controller.activeVoices).toBe(0);
  expect(w.snapshot()).toBe(saved);
});
