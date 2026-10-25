import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LEONA_DEATH_AUDIO as P } from '../src/content/leona-death-audio';
import { LeonaDeathAudio } from '../src/audio/leona-death';
import {
  leonaDeathAudioStates,
  LEONA_DEATH_AUDIO_KINDS as kinds,
  type LeonaDeathAudioRecord,
} from '../src/audio/leona-death-state';
function fixture(visible = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, {
    x: visible ? -200 : -3000,
    y: 0,
    previous: { x: visible ? -200 : -3000, y: 0 },
  });
  const u = w.spawn('champion', 'red', { x: 150, y: 0 }, 'leona');
  for (const v of w.units) v.ai = false;
  w.damage(w.hero, u, 1e9, 'true');
  const state = w.championState(u.id)!;
  const records = (): LeonaDeathAudioRecord[] =>
    state.leonaDeathVisuals.map((r) => ({ ...r, id: u.id }));
  return { w, u, state, records };
}
function controller() {
  const made: any[] = [],
    gains: any[] = [];
  const context: any = {
    state: 'running',
    currentTime: 10,
    destination: {},
    createBufferSource() {
      const n: any = {
        onended: null,
        playbackRate: { value: 1 },
        starts: [],
        stops: [],
        disconnected: 0,
        connect: (g: any) => g,
        disconnect: () => n.disconnected++,
        start: (...v: number[]) => n.starts.push(v),
        stop: (...v: number[]) => n.stops.push(v),
      };
      made.push(n);
      return n;
    },
    createGain() {
      const n: any = {
        disconnected: 0,
        calls: [],
        connect: (g: any) => g,
        disconnect: () => n.disconnected++,
        gain: {
          value: 0,
          cancelScheduledValues: (...v: number[]) => n.calls.push(['cancel', ...v]),
          setValueAtTime: (...v: number[]) => n.calls.push(['set', ...v]),
          linearRampToValueAtTime: (...v: number[]) => n.calls.push(['ramp', ...v]),
          setTargetAtTime: () => {},
        },
      };
      gains.push(n);
      return n;
    },
  };
  const audio: any = new LeonaDeathAudio();
  audio.status = 'ready';
  audio.buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds }))])
  );
  const update = (
    records: LeonaDeathAudioRecord[],
    tick: number,
    audible = true,
    visible = () => true
  ) => audio.update(context, audible, records, tick, { x: 0, y: 0 }, visible, 'blue');
  return { audio, context, made, gains, update };
}

test('one accepted death starts both direct layers with the authored second delay, without variants or future births', () => {
  const f = fixture(),
    states = leonaDeathAudioStates(f.records(), 0);
  expect(states.map((s) => [s.kind, s.variant, s.leadSeconds, s.offset, s.playbackRate])).toEqual([
    ['first', 0, 0, 0, 1],
    ['second', 0, 1.75, 0, 1],
  ]);
  expect(states.map((s) => s.startTick)).toEqual([0, 105]);
  expect(states[0].remaining).toBe(P.first.maxDurationSeconds);
  expect(states[1].remaining).toBe(1.75 + P.second.maxDurationSeconds);
  expect(leonaDeathAudioStates(f.records(), -1)).toEqual([]);
  expect(leonaDeathAudioStates(f.records(), Infinity)).toEqual([]);
  expect(
    leonaDeathAudioStates(f.records(), 105).map((s) => [s.kind, s.offset, s.leadSeconds])
  ).toEqual([
    ['first', 1.75, 0],
    ['second', 0, 0],
  ]);
  expect(leonaDeathAudioStates(f.records(), 219).map((s) => s.kind)).toEqual(['second']);
  expect(leonaDeathAudioStates(f.records(), 338)).toEqual([]);
});

test('both phases resume after event-log retirement and restore from saved facts without touching RNG, IDs or snapshots', () => {
  const f = fixture();
  f.w.step(151);
  expect(f.w.events.some((e) => e.type === 'death')).toBe(false);
  const saved = f.w.snapshot(),
    rng = f.w.random.state,
    id = f.w.nextId,
    copy = World.fromSnapshot(saved, f.w.battlefield);
  const states = leonaDeathAudioStates(f.records(), 151),
    records = copy.championState(f.u.id)!.leonaDeathVisuals.map((r) => ({ ...r, id: f.u.id }));
  expect(states.map((s) => s.offset)).toEqual([151 / 60, 46 / 60]);
  expect(states.every((s) => s.leadSeconds === 0)).toBe(true);
  expect(leonaDeathAudioStates(records, 151)).toEqual(states);
  expect(f.w.snapshot()).toBe(saved);
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id);
});

test('Web Audio schedules 1.75 seconds exactly, preserves both finite stops and applies the direct-sound gain', () => {
  const f = fixture(),
    c = controller();
  c.update(f.records(), 0);
  expect(c.made.map((n) => n.starts)).toEqual([[[10, 0]], [[11.75, 0]]]);
  expect(c.made[0].stops[0][0]).toBeCloseTo(10 + P.first.maxDurationSeconds);
  expect(c.made[1].stops[0][0]).toBeCloseTo(11.75 + P.second.maxDurationSeconds);
  expect(c.made.every((n) => !n.loop && n.playbackRate.value === 1)).toBe(true);
  for (const i of [1, 3]) expect(c.gains[i].gain.value).toBeCloseTo(0.2 * 10 ** (-10 / 20));
  c.audio.stop();
  expect(c.made.every((n) => n.disconnected === 1)).toBe(true);
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
});

test('mute cancels the pending layer and resumes only its remaining action delay while the generic visibility hook releases both roles', () => {
  const f = fixture(),
    c = controller();
  c.update(f.records(), 0);
  c.update(f.records(), 0, false);
  expect(c.audio.voices.size).toBe(0);
  c.context.currentTime = 20;
  c.update(f.records(), 60);
  expect(c.made.slice(2).map((n) => n.starts)).toEqual([[[20, 1]], [[20.75, 0]]]);
  c.update(f.records(), 60, true, () => false);
  expect(c.audio.voices.size).toBe(0);
  c.context.currentTime = 30;
  c.update(f.records(), 151);
  expect(c.made.slice(4).map((n) => n.starts)).toEqual([[[30, 151 / 60]], [[30, 46 / 60]]]);
  c.audio.stop();
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
});

test('a hidden accepted death remains silent after later corpse visibility for both layers', () => {
  const f = fixture(false);
  expect(f.records()[0].audience).toEqual(['red']);
  Object.assign(f.w.hero, { x: 150, y: 500, previous: { x: 150, y: 500 } });
  f.w.step(2);
  expect(f.w.visible(f.u, 'blue')).toBe(true);
  expect(leonaDeathAudioStates(f.records(), 2)).toEqual([]);
  expect(leonaDeathAudioStates(f.records(), 2, 'red')).toHaveLength(2);
  const c = controller();
  c.update(f.records(), 2);
  expect(c.made).toEqual([]);
});

test('both direct-sound caps remain independent with deterministic numeric admission', () => {
  const f = fixture(),
    r = f.records()[0],
    c = controller(),
    ids = [2, 10, 3, 9, 4, 8];
  c.update(
    ids.map((id) => ({ ...structuredClone(r), id })),
    0
  );
  expect(c.made).toHaveLength(12);
  expect(c.audio.finished.size).toBe(4);
  for (const kind of kinds)
    expect([...c.audio.voices.keys()].filter((k: string) => k.endsWith(':' + kind))).toEqual(
      [4, 8, 9, 10].map((id) => `${id}:0:${kind}`)
    );
  c.audio.stop();
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
});

test('completed layers cannot replay at a frozen tick and their finished keys retire with the saved fact', () => {
  const f = fixture(),
    c = controller();
  c.update(f.records(), 0);
  c.made[0].onended();
  c.update(f.records(), 0);
  expect(c.made).toHaveLength(2);
  expect(c.audio.voices.size).toBe(1);
  c.made[1].onended();
  c.update(f.records(), 0);
  expect(c.made).toHaveLength(2);
  expect(c.audio.finished.size).toBe(2);
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
  c.update([], 338);
  expect(c.audio.finished.size).toBe(0);
});

test.each([true, false])(
  'two direct masters load once with ready=%s and no repeated-call retries',
  async (ok) => {
    const fetch = vi.fn(async () => ({
        ok,
        status: 503,
        arrayBuffer: async () => new ArrayBuffer(4),
      })),
      decode = vi.fn(async () => ({ duration: 4 })),
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        decodeAudioData = decode;
      }
    );
    try {
      const c: any = new LeonaDeathAudio();
      await c.load();
      await c.load();
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(c.status).toBe(ok ? 'ready' : 'failed');
      expect(decode).toHaveBeenCalledTimes(ok ? 2 : 0);
      expect(warn).toHaveBeenCalledTimes(ok ? 0 : 1);
      if (ok) {
        expect(c.buffers.first).toHaveLength(1);
        expect(c.buffers.second).toHaveLength(1);
        expect(c.buffers.first[0]).not.toBe(c.buffers.second[0]);
      }
    } finally {
      vi.unstubAllGlobals();
      warn.mockRestore();
    }
  }
);
