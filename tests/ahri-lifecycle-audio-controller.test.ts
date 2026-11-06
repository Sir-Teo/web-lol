import { afterEach, expect, it, vi } from 'vitest';
import { AhriLifecycleAudio } from '../src/audio/ahri-lifecycle';
import { AHRI_LIFECYCLE_AUDIO_PROFILES as P } from '../src/content/ahri-lifecycle-audio-policy';
import {
  lifecycleRecord,
  respawnedLifecycleRecord,
  ownLifecycleScene,
} from './helpers/ahri-lifecycle-audio';

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
  const controller = new AhriLifecycleAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads two unique masters and retries only the failed source explicitly', async () => {
  const { controller, requests, fail } = await loaded(1057065243);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(2);
  controller.update(
    new Context() as any,
    true,
    [lifecycleRecord()],
    110,
    { x: 0, y: 0 },
    {},
    ownLifecycleScene
  );
  expect(requests).toHaveLength(2);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(3);
  expect(requests.at(-1)).toBe(1057065243);
});
it('mute and suspension release finite nodes while resume seeks the original death sample phase', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = lifecycleRecord(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [r], tick, { x: 0, y: 0 }, owner, ownLifecycleScene);
  update(110);
  expect(controller.activeVoices).toBe(1);
  expect(context.sources[0].loop).toBe(false);
  expect(context.sources[0].scheduledStops.every(Number.isFinite)).toBe(true);
  update(111, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources[0].stopped && context.sources[0].disconnected).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(120);
  expect(context.sources[1].starts).toEqual([[10, 20 / 60]]);
  context.state = 'suspended';
  update(121);
  expect(controller.activeVoices).toBe(0);
});
it('a finished death cue cannot revive but its later actual respawn remains eligible with its own gain', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    r = lifecycleRecord(),
    owner = {};
  const update = (tick: number) =>
    controller.update(context as any, true, [r], tick, { x: 0, y: 0 }, owner, ownLifecycleScene);
  update(110);
  expect(context.gains[0].gain.value).toBeCloseTo(0.2 * 10 ** (-12 / 20), 9);
  context.sources[0].onended?.();
  update(110);
  expect(controller.activeVoices).toBe(0);
  update(500);
  expect(context.sources).toHaveLength(1);
  r.respawn = { tick: 700, point: { x: 0, y: 0 }, audience: ['blue'] };
  update(710);
  expect(controller.activeVoices).toBe(1);
  expect(context.sources).toHaveLength(2);
  expect(context.sources[1].starts).toEqual([[10, 10 / 60]]);
  expect(context.gains[2].gain.value).toBeCloseTo(0.2 * 10 ** (-9 / 20), 9);
});
it('world replacement and rewind reset only ownership while preserving decoded buffers', async () => {
  const { controller, requests } = await loaded(),
    context = new Context(),
    r = lifecycleRecord(),
    owner = {};
  const update = (tick: number, nextOwner = owner) =>
    controller.update(
      context as any,
      true,
      [r],
      tick,
      { x: 0, y: 0 },
      nextOwner,
      ownLifecycleScene
    );
  update(110);
  context.sources[0].onended?.();
  update(110);
  expect(context.sources).toHaveLength(1);
  update(110, {});
  expect(context.sources).toHaveLength(2);
  update(99);
  expect(controller.activeVoices).toBe(0);
  expect(requests).toHaveLength(2);
});
it('zero source declarations never become a zero runtime cap; explicit local ceilings bound both cue pools', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = [
    ...Array.from({ length: 30 }, (_, i) => {
      const r = respawnedLifecycleRecord();
      r.id = 1000 + i;
      r.sourceId = 7 + i;
      return r;
    }),
    ...Array.from({ length: 30 }, (_, i) => {
      const r = lifecycleRecord();
      r.id = 2000 + i;
      r.sourceId = 70 + i;
      r.startTick = 700;
      r.respawnTick = 1300;
      return r;
    }),
  ];
  controller.update(context as any, true, records, 710, { x: 0, y: 0 }, owner, ownLifecycleScene);
  expect(controller.activeVoices).toBe(32);
  const count = context.sources.length;
  controller.update(context as any, true, records, 711, { x: 0, y: 0 }, owner, ownLifecycleScene);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 2000, { x: 0, y: 0 }, owner, ownLifecycleScene);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});
it('terminal time drains finite death or respawn tails without changing the winning World', async () => {
  const { GameAudio } = await import('../src/audio/audio');
  const { World } = await import('../src/simulation/world');
  const { PRACTICE_FIXTURE } = await import('../src/content/practice-fixture');
  for (const respawn of [false, true]) {
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
    const enemy = w.spawn('champion', 'red', { x: w.hero.x + 450, y: w.hero.y }, 'lux');
    enemy.ai = false;
    w.damage(enemy, w.hero, 1e9, 'true');
    if (respawn) w.step(w.ahriLifecycleAudio[0].respawnTick);
    const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
    w.damage(w.hero, nexus, 1e9, 'true');
    (game.ahriLifecycle as any).controller = controller;
    for (const family of [
      'ahriCharm',
      'ahriOrb',
      'ahriFoxFire',
      'ahriSpiritRush',
      'ahriPassive',
      'ahriAA',
    ])
      (game as any)[family] = { status: 'ready', update() {}, stop() {} };
    game.context = context as any;
    const saved = w.snapshot();
    game.updateAhri(w, w.hero);
    expect(controller.activeVoices).toBe(1);
    context.currentTime += 10;
    game.updateAhri(w, w.hero);
    expect(controller.activeVoices).toBe(0);
    expect(w.snapshot()).toBe(saved);
  }
});
