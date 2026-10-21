import { expect, test, vi } from 'vitest';
import { GAREN_Q_AUDIO as P } from '../src/content/garen-q-audio';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../src/content/garen-q-audio-timing';
import {
  garenQAudioStates,
  garenQVariant,
  GAREN_Q_AUDIO_KINDS,
  type GarenQAudioRecord,
} from '../src/audio/garen-q-state';
import { GarenDecisiveStrikeAudio } from '../src/audio/garen-q';

const record: GarenQAudioRecord = {
  id: 1,
  startTick: 100,
  rank: 1,
  stopTick: null,
  endReason: null,
  attacks: [{ startTick: 110, releaseTick: 129 }],
  x: 0,
  y: 0,
  visible: true,
};
test('Q states preserve exact delayed-action time, source offsets and natural durations without looping', () => {
  expect(garenQAudioStates([record], 99)).toEqual([]);
  expect(garenQAudioStates([record], NaN)).toEqual([]);
  expect(garenQAudioStates([{ ...record, visible: false }], 110)).toEqual([]);
  const first = garenQAudioStates([record], 110);
  expect(first.map((s) => s.kind)).toEqual(['cast', 'active', 'attack', 'attackDelayed']);
  expect(first.find((s) => s.kind === 'attackDelayed')).toMatchObject({ delay: 0.23, offset: 0 });
  const near = garenQAudioStates([record], 123).find((s) => s.kind === 'attackDelayed')!;
  expect(near.delay).toBeCloseTo(0.23 - 13 / 60);
  const after = garenQAudioStates([record], 124).find((s) => s.kind === 'attackDelayed')!;
  expect(after.delay).toBe(0);
  expect(after.offset).toBeCloseTo(14 / 60 - 0.23);
  expect(garenQAudioStates([record], 1000)).toEqual([]);
  for (const kind of GAREN_Q_AUDIO_KINDS)
    expect(new Set(Array.from({ length: 100 }, (_, id) => garenQVariant(id, 100, kind))).size).toBe(
      P[kind].variants.length
    );
});
test('Q ending cues distinguish consumption/expiry from death/recast/match-end while all accepted attacks retain their own tails', () => {
  for (const endReason of ['consumed', 'expired', 'death', 'recast', 'match-end'] as const) {
    const ended = { ...record, stopTick: 129, endReason };
    const states = garenQAudioStates([ended], 135);
    expect(states.some((s) => s.kind === 'end')).toBe(['consumed', 'expired'].includes(endReason));
    expect(states.find((s) => s.kind === 'active')).toMatchObject({ fade: 0.6 });
    expect(states.filter((s) => s.kind.startsWith('attack'))).toHaveLength(2);
    expect(garenQAudioStates([ended], 144).some((s) => s.kind === 'active')).toBe(false);
    expect(garenQAudioStates([ended], 129 + GAREN_Q_AUDIO_TAIL_TICKS)).toEqual([]);
  }
  expect(GAREN_Q_AUDIO_TAIL_TICKS).toBe(200);
  const recast = { ...record, startTick: 130, attacks: [] };
  const states = garenQAudioStates(
    [{ ...record, stopTick: 130, endReason: 'recast' }, recast],
    132
  );
  expect(new Set(states.map((s) => s.key)).size).toBe(states.length);
  expect(states.filter((s) => s.kind === 'cast')).toHaveLength(2);
});

class Param {
  value = 1;
  ramps: number[][] = [];
  sets: number[][] = [];
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.sets.push([v, t]);
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.ramps.push([v, t]);
    return this;
  }
  setTargetAtTime() {
    return this;
  }
}
class Gain {
  gain = new Param();
  connect(x: any) {
    return x;
  }
  disconnect() {}
}
class Source {
  buffer: any;
  loop = true;
  onended: (() => void) | null = null;
  starts: number[][] = [];
  stops: (number | undefined)[] = [];
  connect(x: any) {
    return x;
  }
  disconnect() {}
  start(when: number, offset: number) {
    this.starts.push([when, offset]);
  }
  stop(when?: number) {
    this.stops.push(when);
  }
}
class Context {
  state = 'running';
  currentTime = 10;
  destination = {};
  sources: Source[] = [];
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  createGain() {
    return new Gain();
  }
}
async function loaded(fail = false) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url);
      return { ok: !fail, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
    })
  );
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      async decodeAudioData() {
        return { duration: 10 };
      }
    }
  );
  const controller = new GarenDecisiveStrikeAudio(),
    a = controller.load(),
    b = controller.load();
  expect(a).toBe(b);
  await a;
  return { controller, requests };
}
test('Q controller schedules both source actions from one clock, keeps sound gain separate from the stop envelope and seeks after mute', async () => {
  try {
    const { controller, requests } = await loaded(),
      context = new Context();
    expect(requests).toHaveLength(13);
    expect(controller.status).toBe('ready');
    controller.update(context as any, true, [record], 110, { x: 0, y: 0 });
    const voices = (controller as any).voices as Map<string, any>;
    expect(voices.get('1:110:attack').source.starts).toEqual([[10, 0]]);
    expect(voices.get('1:110:attackDelayed').source.starts).toEqual([[10.23, 0]]);
    expect(context.sources.every((s) => !s.loop)).toBe(true);
    controller.update(
      context as any,
      true,
      [{ ...record, stopTick: 129, endReason: 'consumed' }],
      135,
      { x: 300, y: 0 }
    );
    const active = voices.get('1:100:active');
    expect(active.envelope.gain.value).toBeCloseTo(0.6);
    expect(active.envelope.gain.ramps.at(-1)).toEqual([0, 10.15]);
    expect(active.source.stops.at(-1)).toBeCloseTo(10.15);
    controller.stop();
    context.currentTime = 20;
    controller.update(context as any, true, [record], 140, { x: 0, y: 0 });
    expect(voices.get('1:110:attackDelayed').source.starts[0][1]).toBeCloseTo(0.5 - 0.23);
    expect(requests).toHaveLength(13);
  } finally {
    vi.unstubAllGlobals();
  }
});
test('Q controller suppresses synthesized cues, honors independent global caps and does not replay finished sounds on a frozen clock', async () => {
  try {
    const { controller } = await loaded(),
      context = new Context();
    controller.suppressCast(1, 100);
    controller.suppressAttack(1, 110);
    controller.update(context as any, true, [record], 110, { x: 0, y: 0 });
    const voices = (controller as any).voices as Map<string, any>;
    expect([...voices.values()].map((v) => v.kind)).toEqual(['active']);
    controller.stop();
    const records = [2, 3, 4].map((id) => ({ ...record, id }));
    controller.update(context as any, true, records, 110, { x: 0, y: 0 });
    for (const kind of ['cast', 'attack', 'attackDelayed'])
      expect([...voices.values()].filter((v) => v.kind === kind)).toHaveLength(2);
    const count = context.sources.length;
    for (const voice of [...voices.values()]) voice.source.onended();
    controller.update(context as any, true, records, 110, { x: 0, y: 0 });
    expect(context.sources).toHaveLength(count);
    controller.update(context as any, true, [], 400, { x: 0, y: 0 });
    expect((controller as any).finished.size).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
test('Q source failure is bounded and does not retry on subsequent load or frame updates', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const { controller, requests } = await loaded(true);
    expect(controller.status).toBe('failed');
    await controller.load();
    controller.update(new Context() as any, true, [record], 110, { x: 0, y: 0 });
    expect(requests).toHaveLength(13);
  } finally {
    warn.mockRestore();
    vi.unstubAllGlobals();
  }
});
