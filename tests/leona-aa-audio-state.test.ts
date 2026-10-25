import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { leonaAttackAnimation } from '../src/content/leona-presentation';
import { LeonaBasicAttackAudio } from '../src/audio/leona-aa';
import {
  LEONA_AA_AUDIO_PROFILE as P,
  LEONA_AA_AUDIO_KINDS as kinds,
  leonaAAAudioStates,
  leonaAAPitchCents,
  leonaAAVariant,
  type LeonaAAAudioRecord,
} from '../src/audio/leona-aa-state';
function fixture(kind: 'attack1' | 'attack2' | 'crit' | 'spell2_attack' = 'attack1') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 100000;
  const s = w.championState(u.id)!;
  if (kind === 'crit')
    s.inventory.push('agility', 'agility', 'agility', 'agility', 'agility', 'infinity-edge');
  else if (kind === 'spell2_attack') {
    w.learnSpell('w', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step();
  } else {
    let n = 0;
    while (leonaAttackAnimation(u.id, w.tick + 1) !== kind) {
      w.step();
      if (++n > 100) throw Error('Missing local clip');
    }
  }
  w.setOrder(u, { type: 'attack', target: target.id });
  w.step();
  const records = (): LeonaAAAudioRecord[] => s.leonaAAVisuals.map((r) => ({ ...r, id: u.id }));
  return { w, u, target, s, records, start: s.leonaAAVisuals[0].startTick };
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
  const audio: any = new LeonaBasicAttackAudio();
  audio.status = 'ready';
  audio.buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds }))])
  );
  const update = (
    records: LeonaAAAudioRecord[],
    tick: number,
    audible = true,
    visible = () => true
  ) => audio.update(context, audible, records, tick, { x: 0, y: 0 }, visible, 'blue');
  return { audio, context, made, gains, update };
}

test.each(['attack1', 'attack2', 'crit', 'spell2_attack'] as const)(
  '%s maps its saved slot to the authored action delay without future contact',
  (kind) => {
    const f = fixture(kind),
      r = f.records()[0],
      state = leonaAAAudioStates([r], f.start)[0],
      delay = kind === 'attack1' || kind === 'spell2_attack' ? 0.04 : 0;
    expect(r.kind).toBe(kind);
    expect(state.kind).toBe(kind === 'crit' ? 'criticalCast' : 'normalCast');
    expect(state.leadSeconds).toBeCloseTo(delay);
    expect(state.offset).toBe(0);
    expect(state.startTick).toBeCloseTo(f.start + delay * 60);
    expect(state.remaining).toBeCloseTo(
      P[state.kind].variants[state.variant].durationSeconds + delay
    );
    expect(leonaAAAudioStates([r], f.start - 1)).toEqual([]);
    f.w.step(f.u.releaseTick! - f.w.tick);
    expect(
      leonaAAAudioStates(f.records(), f.start).some(
        (s) => s.kind.includes('Hit') || s.kind.startsWith('hit')
      )
    ).toBe(false);
  }
);

test('four material branches and critical contacts preserve distinct source gains, caps and ranged pitch', () => {
  const f = fixture();
  f.w.step(f.u.releaseTick! - f.w.tick);
  const r = f.records()[0];
  for (const material of ['Flesh', 'Metal', 'Stone', 'Wood'] as const) {
    const copy = structuredClone(r);
    copy.impact!.material = material;
    const hit = leonaAAAudioStates([copy], copy.impact!.tick + 3).find(
      (s) => s.kind === `hit${material}`
    )!;
    expect(P[hit.kind].gainDb).toBe(-14);
    expect(P[hit.kind].policy.u16MaxNumInstance).toBe(4);
    const pitch = leonaAAPitchCents(r.id, r.startTick, hit.kind);
    expect(pitch).toBeGreaterThanOrEqual(-300);
    expect(pitch).toBeLessThanOrEqual(300);
    expect(hit.playbackRate).toBeCloseTo(2 ** (pitch / 1200));
    expect(hit.offset).toBeCloseTo(0.05 * hit.playbackRate);
  }
  const c = fixture('crit');
  c.w.step(c.u.releaseTick! - c.w.tick);
  const hit = leonaAAAudioStates(c.records(), c.w.tick).find((s) => s.kind === 'criticalHit')!;
  expect(hit.playbackRate).toBe(1);
  expect(P.criticalHit.gainDb).toBe(-12);
  expect(P.criticalHit.policy.u16MaxNumInstance).toBe(2);
  expect([P.normalCast.gainDb, P.criticalCast.gainDb]).toEqual([-11, -9]);
});

test('saved voices choose stable indexed media and pitch without touching gameplay IDs, RNG or snapshots', () => {
  const f = fixture('attack2');
  f.w.step(f.u.releaseTick! - f.w.tick + 3);
  const saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield),
    rng = f.w.random.state,
    id = f.w.nextId;
  const states = leonaAAAudioStates(f.records(), f.w.tick + 0.5);
  const restored = copy.championState(f.u.id)!.leonaAAVisuals.map((r) => ({ ...r, id: f.u.id }));
  expect(leonaAAAudioStates(restored, f.w.tick + 0.5)).toEqual(states);
  for (const s of states) expect(s.variant).toBe(leonaAAVariant(f.u.id, f.start, s.kind));
  expect(f.w.snapshot()).toBe(saved);
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id);
});

test('canceled casts finish independently and fixed cast/contact audiences never admit hidden starts', () => {
  const f = fixture(),
    r = f.s.leonaAAVisuals[0];
  f.w.setOrder(f.u, { type: 'move', point: { x: 0, y: 500 } });
  f.w.step(3);
  expect(r.cancelTick).not.toBeNull();
  const states = leonaAAAudioStates(f.records(), f.w.tick);
  expect(states.map((s) => s.kind)).toEqual(['normalCast']);
  expect(states[0].y).toBeGreaterThan(0);
  const hidden = structuredClone(f.records()[0]);
  hidden.castAudience = ['red'];
  expect(leonaAAAudioStates([hidden], f.w.tick)).toEqual([]);
  expect(leonaAAAudioStates([hidden], f.w.tick, 'red')).toHaveLength(1);
  expect(leonaAAAudioStates([hidden], Infinity)).toEqual([]);
});

test('a delayed cast schedules precisely with a nonnegative offset and the attack attenuation table', () => {
  const f = fixture('attack1'),
    c = controller(),
    s = leonaAAAudioStates(f.records(), f.start)[0];
  c.update(f.records(), f.start);
  expect(c.made[0].starts).toEqual([[10.04, 0]]);
  expect(c.made[0].loop).toBe(false);
  expect(c.made[0].stops[0][0]).toBeCloseTo(10 + s.remaining);
  expect(c.gains[1].gain.value).toBeCloseTo(0.2 * 10 ** (-11 / 20));
  c.audio.stop();
  expect(c.made[0].disconnected).toBe(1);
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
  const far = structuredClone(f.records());
  for (const frame of far[0].frames) frame.x = 2412;
  const d = controller();
  d.update(far, f.start);
  expect(d.gains[1].gain.value).toBeCloseTo(0.2 * 10 ** (-11 / 20) * 10 ** (-96.3 / 20), 12);
});

test('mute, visibility and finite completion release every node and cannot restart finished frozen voices', () => {
  const f = fixture('attack1'),
    c = controller();
  c.update(f.records(), f.start);
  c.update(f.records(), f.start, false);
  expect(c.audio.voices.size).toBe(0);
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
  c.update(f.records(), f.start + 4);
  const last = c.made.at(-1);
  expect(last.starts[0][1]).toBeCloseTo(4 / 60 - 0.04);
  c.update(f.records(), f.start + 4, true, () => false);
  expect(last.disconnected).toBe(1);
  c.update(f.records(), f.start + 4);
  c.made.at(-1).onended();
  const count = c.made.length;
  c.update(f.records(), f.start + 4);
  expect(c.made).toHaveLength(count);
  expect(c.audio.finished.size).toBe(1);
  c.update([], f.start + 100);
  expect(c.audio.finished.size).toBe(0);
});

test('normal aliases share their cap, critical casts keep a separate cap and fallback suppresses the whole attempt', () => {
  const f = fixture('attack1'),
    critical = fixture('crit'),
    r = f.records()[0],
    cr = critical.records()[0],
    c = controller();
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => ({ ...structuredClone(r), id: 100 + i })),
    ...Array.from({ length: 6 }, (_, i) => ({ ...structuredClone(cr), id: 200 + i })),
  ];
  c.update(rows, Math.max(r.startTick, cr.startTick));
  expect([...c.audio.voices.values()].filter((v: any) => v.kind === 'normalCast')).toHaveLength(2);
  expect([...c.audio.voices.values()].filter((v: any) => v.kind === 'criticalCast')).toHaveLength(
    2
  );
  c.audio.stop();
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
  const d = controller();
  d.audio.suppressSwing(r.id, r.startTick);
  f.w.step(f.u.releaseTick! - f.w.tick);
  d.update(f.records(), f.w.tick);
  expect(d.made).toEqual([]);
  expect(d.audio.fallbackCasts.size).toBe(7);
  d.update([], f.w.tick + 100);
  expect(d.audio.fallbackCasts.size).toBe(0);
});

test('one load decodes twenty-four unique URLs while normal/critical media keep separate containers', async () => {
  const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })),
    decode = vi.fn(async () => ({ duration: 1 }));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      decodeAudioData = decode;
    }
  );
  try {
    const c: any = new LeonaBasicAttackAudio();
    await c.load();
    await c.load();
    expect(c.status).toBe('ready');
    expect(fetch).toHaveBeenCalledTimes(24);
    expect(decode).toHaveBeenCalledTimes(24);
    expect(new Set(fetch.mock.calls.map((call: any) => call[0])).size).toBe(24);
    expect(c.buffers.normalCast).not.toBe(c.buffers.criticalCast);
    expect(c.buffers.normalCast[0]).toBe(c.buffers.criticalCast[0]);
  } finally {
    vi.unstubAllGlobals();
  }
});
