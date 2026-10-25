import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { SunlightVisual } from '../src/simulation/sunlight-visuals';
import { LEONA_SUNLIGHT_AUDIO as P } from '../src/content/leona-sunlight-audio';
import { LeonaSunlightAudio } from '../src/audio/leona-sunlight';
import { leonaSunlightAudioStates, leonaSunlightVariant } from '../src/audio/leona-sunlight-state';
const kinds = ['hit'] as const;
function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const leona = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  for (const u of w.units) u.ai = false;
  const mark = () => w.applySunlight(leona, target),
    trigger = () => w.damage(w.hero, target, 1, 'physical');
  return { w, leona, target, mark, trigger };
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
  const audio: any = new LeonaSunlightAudio();
  audio.status = 'ready';
  audio.buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds }))])
  );
  const update = (records: SunlightVisual[], tick: number, audible = true, visible = () => true) =>
    audio.update(context, audible, records, tick, { x: 0, y: 0 }, visible, 'blue');
  return { audio, context, made, gains, update };
}

test('only accepted ally consumption creates a finite source cue; active marks and owner damage stay silent', () => {
  const f = fixture();
  f.mark();
  expect(leonaSunlightAudioStates(f.w.sunlightVisuals, 0)).toEqual([]);
  f.w.damage(f.leona, f.target, 1, 'physical');
  expect(leonaSunlightAudioStates(f.w.sunlightVisuals, 0)).toEqual([]);
  f.trigger();
  const state = leonaSunlightAudioStates(f.w.sunlightVisuals, 0)[0];
  expect(state).toMatchObject({
    key: '1:0:hit',
    kind: 'hit',
    offset: 0,
    playbackRate: 1,
    x: 150,
    y: 0,
    envelope: 1,
  });
  expect(state.remaining).toBe(P.hit.variants[state.variant].durationSeconds);
  expect(leonaSunlightAudioStates(f.w.sunlightVisuals, -1)).toEqual([]);
  expect(leonaSunlightAudioStates(f.w.sunlightVisuals, 42)).toEqual([]);
  expect(leonaSunlightAudioStates(f.w.sunlightVisuals, Infinity)).toEqual([]);
});

test('saved serials choose stable media, interpolate moving target poses and consume no gameplay RNG or IDs', () => {
  const f = fixture();
  f.mark();
  f.trigger();
  f.w.setOrder(f.target, { type: 'move', point: { x: 500, y: 0 } });
  f.w.step(7);
  const saved = f.w.snapshot(),
    rng = f.w.random.state,
    id = f.w.nextId,
    copy = World.fromSnapshot(saved, f.w.battlefield),
    r = f.w.sunlightVisuals[0];
  const state = leonaSunlightAudioStates(f.w.sunlightVisuals, 6.5)[0];
  expect(state.x).toBeCloseTo((r.frames[6].x + r.frames[7].x) / 2);
  expect(state.x).toBeGreaterThan(150);
  expect(state.variant).toBe(leonaSunlightVariant(r.id, r.startTick));
  expect(state.offset).toBeCloseTo(6.5 / 60);
  expect(leonaSunlightAudioStates(copy.sunlightVisuals, 6.5)).toEqual([state]);
  expect(f.w.snapshot()).toBe(saved);
  expect(f.w.nextId).toBe(id);
  expect(f.w.random.state).toBe(rng);
});

test('a hidden accepted consumption stays silent after later target reveal', () => {
  const f = fixture(),
    w = f.w;
  w.units = [w.hero];
  const leona = w.spawn('champion', 'red', { x: 3500, y: 0 }, 'leona'),
    ally = w.spawn('champion', 'red', { x: 3500, y: 100 }, 'garen'),
    target = w.spawnMonster({ x: 3650, y: 0 }, null, 'red');
  target.hp = target.maxHp = 100000;
  for (const u of w.units) u.ai = false;
  w.applySunlight(leona, target);
  w.damage(ally, target, 1, 'physical');
  expect(w.sunlightVisuals).toHaveLength(1);
  expect(w.sunlightVisuals[0].audience).not.toContain('blue');
  Object.assign(w.hero, { x: 3500, y: 500, previous: { x: 3500, y: 500 } });
  w.step(2);
  expect(w.visible(target, 'blue')).toBe(true);
  expect(leonaSunlightAudioStates(w.sunlightVisuals, w.tick)).toEqual([]);
  expect(leonaSunlightAudioStates(w.sunlightVisuals, w.tick, 'red')).toHaveLength(1);
});

test('lethal consumption uses the detached saved target endpoint through target removal', () => {
  const f = fixture();
  f.target.hp = 10;
  f.mark();
  f.trigger();
  const r = f.w.sunlightVisuals[0];
  expect(r.detachedTick).toBe(0);
  expect(r.sourceId).toBe(f.leona.id);
  const point = { x: r.frames[0].x, y: r.frames[0].y };
  f.w.units = f.w.units.filter((u) => u.id !== f.target.id);
  f.w.step(3);
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield),
    state = leonaSunlightAudioStates(f.w.sunlightVisuals, 3)[0];
  expect({ x: state.x, y: state.y }).toEqual(point);
  expect(leonaSunlightAudioStates(copy.sunlightVisuals, 3)).toEqual([state]);
});

test('ten same-tick consumptions keep distinct stable keys and the cap admits newest numeric serials', () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    f.mark();
    f.trigger();
  }
  const records = [...f.w.sunlightVisuals].reverse(),
    states = leonaSunlightAudioStates(records, 0),
    c = controller();
  expect(states.map((s) => Number(s.key.split(':')[0]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  c.update(records, 0);
  expect([...c.audio.voices.keys()]).toEqual(['9:0:hit', '10:0:hit']);
  expect(c.audio.finished.size).toBe(8);
  c.audio.stop();
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
});

test('source gain, finite scheduling, mute/visibility seeking and frozen completion preserve node ownership', () => {
  const f = fixture();
  f.mark();
  f.trigger();
  const c = controller(),
    state = leonaSunlightAudioStates(f.w.sunlightVisuals, 0)[0];
  c.update(f.w.sunlightVisuals, 0);
  expect(c.made[0].starts).toEqual([[10, 0]]);
  expect(c.made[0].loop).toBe(false);
  expect(c.made[0].stops[0][0]).toBeCloseTo(10 + state.remaining);
  expect(c.gains[1].gain.value).toBeCloseTo(0.2 * 10 ** (-12 / 20));
  c.update(f.w.sunlightVisuals, 0, false);
  expect(c.audio.voices.size).toBe(0);
  c.update(f.w.sunlightVisuals, 3);
  expect(c.made.at(-1).starts[0][1]).toBeCloseTo(0.05);
  c.update(f.w.sunlightVisuals, 3, true, () => false);
  expect(c.audio.voices.size).toBe(0);
  c.update(f.w.sunlightVisuals, 3);
  c.made.at(-1).onended();
  const n = c.made.length;
  c.update(f.w.sunlightVisuals, 3);
  expect(c.made).toHaveLength(n);
  expect(c.gains.every((g) => g.disconnected === 1)).toBe(true);
  c.update([], 100);
  expect(c.audio.finished.size).toBe(0);
});

test('three masters load once and a failed load settles without frame or repeated-call retries', async () => {
  const fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      arrayBuffer: async () => new ArrayBuffer(4),
    })),
    decode = vi.fn(async () => ({ duration: 1 })),
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      decodeAudioData = decode;
    }
  );
  try {
    const c = new LeonaSunlightAudio();
    await c.load();
    await c.load();
    expect(c.status).toBe('failed');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(decode).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
    warn.mockRestore();
  }
});
