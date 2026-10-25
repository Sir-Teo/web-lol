import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LEONA_Q_AUDIO as P } from '../src/content/leona-q-audio';
import {
  LEONA_Q_CAST_AUDIO_TICKS,
  LEONA_Q_ATTACK_AUDIO_TICKS,
  LEONA_Q_HIT_AUDIO_TICKS,
} from '../src/content/leona-q-audio-timing';
import { LeonaDaybreakAudio } from '../src/audio/leona-q';
import {
  leonaQAudioStates,
  leonaQVariant,
  LEONA_Q_AUDIO_KINDS,
  type LeonaQAudioRecord,
} from '../src/audio/leona-q-state';
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
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 100000;
  w.learnSpell('q', u.id);
  w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: u });
  w.step();
  const records = (): LeonaQAudioRecord[] =>
    w.championState(u.id)!.leonaQVisuals.map((r) => ({ ...r, id: u.id }));
  return { w, u, target, records };
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
  const audio: any = new LeonaDaybreakAudio();
  audio.status = 'ready';
  audio.buffers = Object.fromEntries(
    LEONA_Q_AUDIO_KINDS.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds }))])
  );
  const update = (
    records: LeonaQAudioRecord[],
    tick: number,
    audible = true,
    visible = () => true
  ) => audio.update(context, audible, records, tick, { x: 0, y: 0 }, visible, 'blue');
  return { audio, context, made, gains, update };
}

test('retention constants cover every finite master without eager simulation audio dependencies', () => {
  expect([LEONA_Q_CAST_AUDIO_TICKS, LEONA_Q_ATTACK_AUDIO_TICKS, LEONA_Q_HIT_AUDIO_TICKS]).toEqual([
    114, 28, 52,
  ]);
  for (const [kind, ticks] of [
    ['cast', 114],
    ['attack', 28],
    ['hit', 52],
  ] as const)
    expect(Math.max(...P[kind].variants.map((v) => Math.ceil(v.durationSeconds * 60)))).toBe(ticks);
});

test('finite cast/attempt/contact and whole-master buff loop seek independently and survive saved futures', () => {
  const f = fixture();
  f.w.setOrder(f.u, { type: 'attack', target: f.target.id });
  f.w.step(16);
  const states = leonaQAudioStates(f.records(), f.w.tick);
  expect(states.map((s) => s.kind).sort()).toEqual(['attack', 'buff', 'cast', 'hit']);
  expect(states.find((s) => s.kind === 'attack')).toMatchObject({ startTick: 2, offset: 15 / 60 });
  expect(states.find((s) => s.kind === 'hit')).toMatchObject({ startTick: 17, offset: 0, x: 150 });
  const saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield);
  expect(
    leonaQAudioStates(
      copy.championState(f.u.id)!.leonaQVisuals.map((r) => ({ ...r, id: f.u.id })),
      22.5
    )
  ).toEqual(leonaQAudioStates(f.records(), 22.5));
  f.w.step(10);
  copy.step(10);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  for (const s of states)
    expect(s.variant).toBe(leonaQVariant(f.u.id, 1, s.kind, s.kind === 'attack' ? 2 : 0));
  const long = fixture();
  long.w.step(200);
  const buff = leonaQAudioStates(long.records(), 201).find((s) => s.kind === 'buff')!;
  expect(buff.remaining).toBe(Infinity);
  expect(buff.offset).toBeCloseTo((200 / 60) % P.buff.variants[0].durationSeconds);
  expect(buff.envelope).toBe(1);
});

test('canceled attempts remain audible without invented hits and use their own fixed start audiences', () => {
  const f = fixture();
  f.w.setOrder(f.u, { type: 'attack', target: f.target.id });
  f.w.step();
  f.w.damage(f.w.hero, f.target, 1e9, 'true');
  f.w.step();
  const r = structuredClone(f.records()[0]);
  expect(leonaQAudioStates([r], 3).some((s) => s.kind === 'attack')).toBe(true);
  expect(leonaQAudioStates([r], 3).some((s) => s.kind === 'hit')).toBe(false);
  r.frames[0].audience = ['red'];
  r.frames.find((p) => p.tick === 2)!.audience = ['red'];
  expect(leonaQAudioStates([r], 3)).toEqual([]);
  expect(
    leonaQAudioStates([r], 3, 'red')
      .map((s) => s.kind)
      .sort()
  ).toEqual(['attack', 'buff', 'cast']);
  expect(leonaQAudioStates([r], Infinity)).toEqual([]);
});

test('buff stop fades from its current fade-in level and never schedules a stop at infinity', () => {
  const f = fixture(),
    c = controller();
  c.update(f.records(), 1);
  const buff = [...c.audio.voices.values()].find((v: any) => v.kind === 'buff') as any;
  expect(buff.source.loop).toBe(true);
  expect(buff.source.stops).toEqual([]);
  expect(buff.envelope.gain).toBeDefined();
  f.w.step();
  f.w.damage(f.target, f.u, 1e9, 'true');
  c.update(f.records(), 2);
  expect(buff.envelope.calls).toContainEqual(['set', 1 / 6, 10]);
  expect(buff.envelope.calls).toContainEqual(['ramp', 0, 10.5]);
  expect(buff.source.stops).toEqual([[10.5]]);
  const half = leonaQAudioStates(f.records(), 17).find((s) => s.kind === 'buff')!;
  expect(half.envelope).toBeCloseTo(1 / 12);
  expect(half.remainingIn).toBe(0);
  expect(half.remaining).toBe(0.25);
  expect(leonaQAudioStates(f.records(), 32).some((s) => s.kind === 'buff')).toBe(false);
});

test('mute/resume and visibility release all owned nodes then seek a live loop from the saved clock', () => {
  const f = fixture();
  f.w.step(180);
  const c = controller();
  c.update(f.records(), 181);
  expect(c.made).toHaveLength(1);
  const old = c.made[0];
  c.update(f.records(), 181, false);
  expect(old.disconnected).toBe(1);
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
  c.update(f.records(), 201);
  expect(c.made).toHaveLength(2);
  expect(c.made[1].starts[0][1]).toBeCloseTo((200 / 60) % P.buff.variants[0].durationSeconds);
  c.update(f.records(), 201, true, () => false);
  expect(c.audio.voices.size).toBe(0);
  c.update(f.records(), 201);
  expect(c.made).toHaveLength(3);
  c.audio.stop();
  expect(c.audio.voices.size).toBe(0);
  expect(c.gains.every((n) => n.disconnected === 1)).toBe(true);
});

test('finite completion, per-attempt fallback suppression and authored caps cannot restart at a frozen tick', () => {
  const f = fixture();
  f.w.setOrder(f.u, { type: 'attack', target: f.target.id });
  f.w.step();
  const c = controller(),
    r = f.records()[0];
  c.audio.suppressCast(r.id, 1);
  c.audio.suppressAttack(r.id, 1, 2);
  c.update([r], 2);
  expect(c.made).toHaveLength(1);
  expect(c.made[0].loop).toBe(true);
  c.update([], 3);
  expect(c.audio.fallbackCasts.size).toBe(0);
  const d = controller();
  d.update(f.records(), 2);
  const cast = [...d.audio.voices.values()].find((v: any) => v.kind === 'cast') as any;
  cast.source.onended();
  const count = d.made.length;
  d.update(f.records(), 2);
  expect(d.made).toHaveLength(count);
  const crowded = Array.from({ length: 6 }, (_, i) => ({
    ...structuredClone(r),
    id: 100 + i,
    attackStarts: [],
  }));
  const e = controller();
  e.update(crowded, 1);
  expect([...e.audio.voices.values()].filter((v: any) => v.kind === 'cast')).toHaveLength(2);
  expect([...e.audio.voices.values()].filter((v: any) => v.kind === 'buff')).toHaveLength(6);
  expect(e.audio.finished.size).toBe(4);
  e.audio.stop();
  expect(e.gains.every((n) => n.disconnected === 1)).toBe(true);
});

test.each(['expired', 'recast', 'match-end'] as const)(
  'Q %s stops the old loop with exactly a half-second tail',
  (reason) => {
    const f = fixture();
    if (reason === 'expired') f.w.step(360);
    else if (reason === 'recast') {
      f.w.step(299);
      f.w.enqueue({ type: 'cast', unit: f.u.id, ability: 'q', point: f.u });
      f.w.step();
    } else {
      f.w.step(20);
      const inhibitor = f.w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
      f.w.damage(f.w.hero, inhibitor, 1e9, 'true');
      const nexus = f.w.spawn('nexus', 'red', { x: 2500, y: 2500 });
      f.w.damage(f.w.hero, nexus, 1e9, 'true');
    }
    const r = f.records()[0];
    expect(r.endReason).toBe(reason);
    const buff = leonaQAudioStates(f.records(), r.stopTick! + 15).filter((s) => s.kind === 'buff');
    const old = buff.find((s) => s.key === `${f.u.id}:1:buff`)!;
    expect(old.remaining).toBe(0.25);
    expect(old.envelope).toBe(0.5);
    expect(leonaQAudioStates(f.records(), r.stopTick! + 30).some((s) => s.key === old.key)).toBe(
      false
    );
    if (reason === 'recast') expect(buff).toHaveLength(2);
    expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
  }
);
