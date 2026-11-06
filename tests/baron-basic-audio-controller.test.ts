import { afterEach, expect, it, vi } from 'vitest';
import { BaronBasicAttackAudio } from '../src/audio/baron-basic';
import { BARON_BASIC_AUDIO as P } from '../src/content/baron-basic-audio';
import { baronBasicAudioStates, type BaronBasicAudioRecord } from '../src/audio/baron-basic-state';

class Param {
  value = 1;
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
  stop() {
    this.stopped = true;
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
const record = (id = 1): BaronBasicAudioRecord => ({
  id,
  launchTick: 100,
  origin: { x: 0, y: 0 },
  castVisible: true,
  impact: { startTick: 130, point: { x: 0, y: 0 }, visible: true },
});
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
  const controller = new BaronBasicAttackAudio();
  const pending = controller.load();
  expect(controller.load()).toBe(pending);
  await pending;
  return { controller, requests, fail };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('loads eight private masters once and retries only the failed media explicitly', async () => {
  const { controller, requests, fail } = await loaded(159616409);
  expect(controller.status).toBe('failed');
  expect(requests).toHaveLength(8);
  controller.update(new Context() as any, true, [record()], 145, { x: 0, y: 0 }, {});
  expect(requests).toHaveLength(8);
  fail.id = null;
  await controller.load();
  expect(controller.status).toBe('ready');
  expect(requests).toHaveLength(9);
  expect(requests.at(-1)).toBe(159616409);
});
it('seeks at pitched offset and resumes from simulation time after mute or suspension', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const update = (tick: number, audible = true) =>
    controller.update(context as any, audible, [record()], tick, { x: 0, y: 0 }, owner);
  update(145);
  const states = baronBasicAudioStates([record()], 145);
  expect(controller.activeVoices).toBe(states.length);
  for (let i = 0; i < states.length; i++) {
    expect(context.sources[i].starts).toEqual([[10, states[i].offset]]);
    expect(context.sources[i].playbackRate.value).toBe(states[i].rate);
    expect(context.sources[i].loop).toBe(false);
    expect(context.gains[i].gain.value).toBeCloseTo(
      0.2 * 10 ** (P[states[i].profileIndex].gainDb / 20)
    );
  }
  update(146, false);
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  expect(context.gains.every((g) => g.disconnected)).toBe(true);
  update(150);
  const next = baronBasicAudioStates([record()], 150);
  expect(context.sources.slice(states.length).map((s) => s.starts[0][1])).toEqual(
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
  controller.update(context as any, true, [record()], 145, { x: 0, y: 0 }, owner);
  const count = context.sources.length;
  for (const source of [...context.sources]) source.onended?.();
  controller.update(context as any, true, [record()], 145, { x: 0, y: 0 }, owner);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [record()], 145, { x: 0, y: 0 }, {});
  expect(context.sources).toHaveLength(count * 2);
  controller.update(context as any, true, [], 90, { x: 0, y: 0 }, owner);
  expect(controller.activeVoices).toBe(0);
});
it('keeps already observed missed-cast tails after visual pruning, then releases all ownership', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const r = { ...record(), impact: null };
  controller.update(context as any, true, [r], 120, { x: 0, y: 0 }, owner);
  const count = context.sources.length;
  controller.update(context as any, true, [], 130, { x: 0, y: 0 }, owner);
  expect(controller.activeVoices).toBeGreaterThan(0);
  expect(context.sources).toHaveLength(count);
  controller.update(context as any, true, [], 1000, { x: 0, y: 0 }, owner);
  expect(controller.activeVoices).toBe(0);
  expect((controller as any).records.size).toBe(0);
  expect((controller as any).finished.size).toBe(0);
});
it('caps each container independently and never revives stolen voices on the next frame', async () => {
  const { controller } = await loaded(),
    context = new Context(),
    owner = {};
  const records = Array.from({ length: 30 }, (_, i) => record(i + 1));
  controller.update(context as any, true, records, 145, { x: 0, y: 0 }, owner);
  expect(controller.activeVoices).toBe(10);
  const count = context.sources.length;
  controller.update(context as any, true, records, 146, { x: 0, y: 0 }, owner);
  expect(context.sources).toHaveLength(count);
  controller.reset();
  expect(controller.activeVoices).toBe(0);
  expect(context.sources.every((s) => s.stopped)).toBe(true);
});
