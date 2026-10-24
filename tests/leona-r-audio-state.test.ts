import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LEONA_R_AUDIO as P } from '../src/content/leona-r-audio';
import {
  leonaRAudioStates,
  leonaRVariant,
  LEONA_R_AUDIO_KINDS,
  type LeonaRAudioRecord,
} from '../src/audio/leona-r-state';
import { LeonaSolarAudio } from '../src/audio/leona-r';
import timing from '../src/content/leona-r-history-bounds.json';
function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  w.gainExperience(2400, u.id);
  w.learnSpell('r', u.id);
  w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: 500, y: 0 } });
  w.step();
  const record = (): LeonaRAudioRecord => ({
    ...w.championState(u.id)!.leonaRVisuals[0],
    id: u.id,
  });
  return { w, u, record };
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
test('three source roles retain ordered variants, authored gain/caps and nine unchanged float masters', () => {
  const graphBytes = readFileSync('docs/reference/leona-r-audio.json'),
    graph = JSON.parse(graphBytes.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/leona-r-audio-decoded.json', 'utf8'));
  expect(graph.events).toHaveLength(3);
  expect(graph.nodes).toHaveLength(20);
  expect(graph.media).toHaveLength(9);
  expect(graph.stopAudit.matchingStopActions).toEqual([]);
  expect(decoded.sourceGraphSha256).toBe(sha(graphBytes));
  expect(
    LEONA_R_AUDIO_KINDS.map((k) => [
      k,
      P[k].gainDb,
      P[k].policy.u16MaxNumInstance,
      P[k].pitchCents,
      P[k].stop,
    ])
  ).toEqual([
    ['cast', -7, 2, 0, null],
    ['area', -5, 0, 0, null],
    ['impact', -1, 2, 0, null],
  ]);
  expect(P.cast.variants.map((v) => v.id)).toEqual([301505004, 268813398, 963566819, 9767343]);
  expect(P.area.variants.map((v) => v.id)).toEqual([909451855]);
  expect(P.impact.variants.map((v) => v.id)).toEqual([88061807, 1021210821, 1039384851, 895356404]);
  for (const k of LEONA_R_AUDIO_KINDS)
    for (const clip of P[k].variants) {
      const bytes = readFileSync('public/' + clip.url),
        m = decoded.media.find((m: any) => m.id === clip.id);
      expect(sha(bytes)).toBe(clip.sha256);
      expect(bytes.length).toBe(m.wavBytes);
      expect(clip.sampleRate).toBe(44100);
      expect(clip.channels).toBe(1);
    }
  expect(decoded.media.reduce((n: number, m: any) => n + m.frames, 0)).toBe(648634);
  expect(decoded.media.reduce((n: number, m: any) => n + m.samplesOutsideUnitRange, 0)).toBe(1);
  expect(Math.max(...decoded.media.map((m: any) => m.peak))).toBeGreaterThan(1);
});
test('accepted cast/area and one impact cue have independent fixed/moving placement even on a miss', () => {
  const f = fixture(),
    before = leonaRAudioStates([f.record()], 1);
  expect(before.map((s) => [s.kind, s.x, s.y, s.offset, s.playbackRate])).toEqual([
    ['cast', 0, 0, 0, 1],
    ['area', 500, 0, 0, 1],
  ]);
  f.w.enqueue({ type: 'cast', unit: f.u.id, ability: 'd', point: { x: 0, y: 400 } });
  f.w.step(38);
  const states = leonaRAudioStates([f.record()], 39);
  expect(states.find((s) => s.kind === 'cast')).toMatchObject({ x: 0, y: 400, age: 38 / 60 });
  expect(states.filter((s) => s.kind === 'area')).toHaveLength(1);
  expect(states.filter((s) => s.kind === 'impact')).toHaveLength(1);
  expect(states.find((s) => s.kind === 'impact')).toMatchObject({
    x: 500,
    y: 0,
    startTick: 39,
    offset: 0,
  });
  expect(f.record().impact?.contacts).toEqual([]);
});
test('historical caster/area/impact audiences independently prevent late reveal replay', () => {
  const f = fixture();
  f.w.step(38);
  const r = f.record();
  r.castFrame.audience = ['red'];
  r.areaAudience = [];
  r.impact!.audience = ['blue'];
  expect(leonaRAudioStates([r], 39).map((s) => s.kind)).toEqual(['impact']);
  expect(leonaRAudioStates([r], 39, 'red').map((s) => s.kind)).toEqual(['cast']);
  r.impact!.audience = [];
  expect(leonaRAudioStates([r], 40)).toEqual([]);
});
test('death and terminal cancellation invent no stop for accepted finite cues; released impact stays independent', () => {
  for (const released of [false, true]) {
    const f = fixture();
    Object.assign(f.w.hero, { x: 500, y: 50 });
    if (released) f.w.step(15);
    f.w.damage(f.w.hero, f.u, 1e6, 'true');
    const now = f.w.tick;
    const states = leonaRAudioStates([f.record()], now + 1);
    expect(states.map((s) => s.kind)).toEqual(['cast', 'area']);
    expect(
      states.every((s) => s.stopAtTick === null && s.envelope === 1 && s.fadeOutSeconds === 0)
    ).toBe(true);
    f.w.step(39 - f.w.tick);
    expect(leonaRAudioStates([f.record()], 40).some((s) => s.kind === 'impact')).toBe(released);
  }
  const f = fixture(),
    nexus = f.w.spawn('nexus', 'red', { x: 2000, y: 0 });
  f.w.damage(f.u, nexus, 1e6, 'true');
  const saved = f.w.snapshot(),
    states = leonaRAudioStates([f.record()], f.w.tick + 1);
  expect(f.record().endReason).toBe('match-end');
  expect(states.map((s) => s.kind)).toEqual(['cast', 'area']);
  expect(states.every((s) => s.stopAtTick === null)).toBe(true);
  expect(f.w.snapshot()).toBe(saved);
});
test('sample offsets and natural endings are sought from saved event clocks without history mutation', () => {
  const f = fixture();
  f.w.step(38);
  const r = f.record(),
    saved = f.w.snapshot(),
    rng = f.w.random.state,
    next = f.w.nextId;
  for (const kind of LEONA_R_AUDIO_KINDS) {
    const start = kind === 'impact' ? 39 : 1,
      variant = leonaRVariant(r.id, r.startTick, kind),
      clip = P[kind].variants[variant];
    const state = leonaRAudioStates([r], start + 12.5).find((s) => s.kind === kind)!;
    expect(state.offset).toBeCloseTo(12.5 / 60, 12);
    expect(state.remaining).toBeCloseTo(clip.durationSeconds - 12.5 / 60, 12);
    expect(
      leonaRAudioStates([r], start + clip.durationSeconds * 60 + 0.001).some((s) => s.kind === kind)
    ).toBe(false);
  }
  expect(leonaRAudioStates([r], NaN)).toEqual([]);
  expect(leonaRAudioStates([r], -1)).toEqual([]);
  expect(f.w.snapshot()).toBe(saved);
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(next);
});
test('indexed cosmetic variants are stable and every finite source tail fits retained history', () => {
  for (const kind of LEONA_R_AUDIO_KINDS) {
    const seen = new Set<number>();
    for (let id = 1; id <= 100; id++) {
      const v = leonaRVariant(id, 17, kind);
      expect(leonaRVariant(id, 17, kind)).toBe(v);
      seen.add(v);
      expect(Math.ceil(P[kind].variants[v].durationSeconds * 60)).toBeLessThan(
        timing.bounds.history
      );
    }
    expect(seen.size).toBe(P[kind].variants.length);
  }
  expect(Math.ceil(P.impact.maxDurationSeconds * 60)).toBe(142);
});
test('shared finite controller steals oldest capped voices, keeps zero-cap area cues and remembers completion', () => {
  const f = fixture(),
    base = f.record(),
    records = Array.from({ length: 4 }, (_, i) => ({ ...structuredClone(base), id: 10 + i })),
    c: any = new LeonaSolarAudio(),
    made: any[] = [];
  c.status = 'ready';
  c.buffers = Object.fromEntries(
    LEONA_R_AUDIO_KINDS.map((k) => [k, P[k].variants.map(() => ({}))])
  );
  const gain = () => {
    const node: any = {
      gain: {
        value: 1,
        cancelScheduledValues() {},
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        setTargetAtTime() {},
      },
      disconnect() {
        node.disconnected = true;
      },
      connect() {
        return node;
      },
    };
    return node;
  };
  const context: any = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: gain,
    createBufferSource: () => {
      const n: any = {
        playbackRate: { value: 1 },
        connect: (g: any) => g,
        disconnect: () => {
          n.disconnected = true;
        },
        start: (_when: number, offset: number) => {
          n.offset = offset;
        },
        stop: () => {
          n.stopped = true;
        },
        onended: null,
      };
      made.push(n);
      return n;
    },
  };
  c.update(context, true, records, 1, { x: 0, y: 0 });
  expect([...c.voices.values()].filter((v: any) => v.kind === 'cast')).toHaveLength(2);
  expect([...c.voices.values()].filter((v: any) => v.kind === 'area')).toHaveLength(4);
  expect(c.finished.size).toBe(2);
  expect(made.filter((n) => n.stopped && n.disconnected)).toHaveLength(2);
  const voice = [...c.voices.values()][0] as any;
  voice.source.onended();
  const count = made.length;
  c.update(context, true, records, 1, { x: 0, y: 0 });
  expect(made).toHaveLength(count);
  c.stop();
  expect(c.voices.size).toBe(0);
  c.update(context, true, [], 2, { x: 0, y: 0 });
  expect(c.finished.size).toBe(0);
});
