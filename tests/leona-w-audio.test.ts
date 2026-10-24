import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LEONA_W_AUDIO as P } from '../src/content/leona-w-audio';
import {
  LEONA_W_AUDIO_KINDS as kinds,
  leonaWAudioStates,
  leonaWVariant,
  type LeonaWAudioRecord,
} from '../src/audio/leona-w-state';
import { LeonaEclipseAudio } from '../src/audio/leona-w';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { eclipseVisualExpiry } from '../src/simulation/leona-w-visuals';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fixture(hit = true) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', 'red', { x: hit ? 100 : 3000, y: 0 }, 'lux');
  target.hp = target.maxHp = 10000;
  for (const unit of w.units) unit.ai = false;
  w.learnSpell('w', u.id);
  const state = w.championState(u.id)!;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step();
  };
  cast();
  const records = (world = w): LeonaWAudioRecord[] =>
    world.championState(u.id)!.leonaWVisuals.map((r) => ({
      ...r,
      id: u.id,
      castVisible: true,
      burstVisible: true,
    }));
  return { w, u, target, state, cast, records };
}
test('Eclipse ships all seven events and eighteen unchanged float masters, with finite buff clips and delayed stops', () => {
  const raw = readFileSync('docs/reference/leona-w-audio.json'),
    graph = JSON.parse(raw.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/leona-w-audio-decoded.json', 'utf8'));
  expect(decoded.sourceGraphSha256).toBe(sha(raw));
  expect(graph.extractionSha256).toBe(
    sha(readFileSync('docs/reference/leona-audio-extraction.json'))
  );
  expect(graph.referenceSha256).toBe(sha(readFileSync('docs/reference/leona-model.json')));
  expect(graph.events).toHaveLength(7);
  expect(graph.nodes).toHaveLength(40);
  expect(graph.media).toHaveLength(18);
  expect(graph.unresolvedHierarchyIds).toEqual([1259461568]);
  expect(
    kinds.map((k) => [P[k].gainDb, P[k].variants.length, P[k].policy.u16MaxNumInstance])
  ).toEqual([
    [-10, 4, 2],
    [-9, 3, 4],
    [-20, 3, 4],
    [-9, 4, 2],
    [-13, 4, 4],
  ]);
  expect(P.initial.fadeInSeconds).toBe(0.005);
  for (const k of ['initial', 'extended'] as const)
    expect(P[k].stop).toMatchObject({
      delaySeconds: 0.5,
      authoredTransitionSeconds: null,
      curve: 4,
    });
  let outside = 0;
  for (const kind of kinds)
    for (const v of P[kind].variants) {
      const m = decoded.media.find((m: any) => m.id === v.id),
        bank = graph.media.find((m: any) => m.id === v.id);
      expect(sha(readFileSync('public/' + v.url))).toBe(v.sha256);
      expect(m.wavSha256).toBe(v.sha256);
      expect(m.pcmSha256).toBe(v.pcmSha256);
      expect(m.encodedSha256).toBe(bank.sha256);
      expect(m.decoderMetadata.loopingInfo).toBeNull();
      expect([m.frames, m.sampleRate, m.channels]).toEqual([v.frames, 44100, 1]);
      outside += m.samplesOutsideUnitRange;
    }
  expect(outside).toBeGreaterThan(0); // Source headroom was not clipped to int16.
});
test('Eclipse phases seek finite clips, preserve the 5 ms onset and 500 ms stop delay, and never create a loop or expiry cue', () => {
  const f = fixture(),
    r = f.records();
  expect(leonaWAudioStates(r, 0)).toEqual([]);
  expect(leonaWAudioStates(r, NaN)).toEqual([]);
  expect(leonaWAudioStates(r, f.w.tick).map((s) => [s.kind, s.offset, s.envelope])).toEqual([
    ['cast', 0, 1],
    ['initial', 0, 0],
  ]);
  expect(
    leonaWAudioStates(r, f.w.tick + 0.15).find((s) => s.kind === 'initial')!.envelope
  ).toBeCloseTo(0.5);
  f.w.step(180);
  expect(leonaWAudioStates(f.records(), f.w.tick).map((s) => s.kind)).toEqual([
    'initial',
    'extended',
    'hit',
  ]);
  const initial = leonaWAudioStates(f.records(), f.w.tick + 5).find((s) => s.kind === 'initial')!;
  expect(initial.stopAtTick).toBe(211);
  expect(initial.remaining).toBeGreaterThan(0);
  expect(leonaWAudioStates(f.records(), 211).some((s) => s.kind === 'initial')).toBe(false);
  f.w.step(180);
  expect(leonaWAudioStates(f.records(), f.w.tick).map((s) => s.kind)).toEqual(['extended']);
  expect(leonaWAudioStates(f.records(), 391)).toEqual([]);
  const miss = fixture(false);
  miss.w.step(180);
  expect(leonaWAudioStates(miss.records(), miss.w.tick).map((s) => s.kind)).toEqual([
    'initial',
    'miss',
  ]);
  for (const kind of kinds)
    expect(new Set(Array.from({ length: 100 }, (_, id) => leonaWVariant(id, 55, kind))).size).toBe(
      P[kind].variants.length
    );
});
test('existing strict histories cover every sound tail through early recast, death, victory and exact restored futures', () => {
  for (const mode of ['recast', 'death', 'match-end', 'hit', 'miss'] as const) {
    const f = fixture(mode !== 'miss');
    if (mode === 'hit' || mode === 'miss') f.w.step(180);
    else f.w.step(10);
    if (mode === 'recast') {
      f.state.cooldowns.w = 0;
      f.u.mana = f.u.maxMana;
      f.cast();
    }
    if (mode === 'death') f.w.damage(f.w.hero, f.u, 1e9, 'true');
    if (mode === 'match-end') {
      const inhibitor = f.w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
      f.w.damage(f.w.hero, inhibitor, 1e9, 'true');
      const nexus = f.w.spawn('nexus', 'red', { x: 1200, y: 1000 });
      f.w.damage(f.w.hero, nexus, 1e9, 'true');
    }
    const saved = f.w.snapshot(),
      copy = World.fromSnapshot(saved, f.w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    for (let age = 0; age < 240; age += 3)
      expect(leonaWAudioStates(f.records(copy), f.w.tick + age)).toEqual(
        leonaWAudioStates(f.records(), f.w.tick + age)
      );
    for (const r of f.records())
      if (r.stopTick !== null) {
        expect(leonaWAudioStates([r], eclipseVisualExpiry(r) - 1)).toEqual([]);
        if (!r.detonation)
          expect(
            leonaWAudioStates([r], f.w.tick).some((s) =>
              ['extended', 'hit', 'miss'].includes(s.kind)
            )
          ).toBe(false);
      }
    expect(f.w.snapshot()).toBe(saved);
    f.w.step(40);
    copy.step(40);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
});
test('cast and explosion audiences are independent; a multi-target burst produces one hit recording', () => {
  const f = fixture();
  f.w.spawn('champion', 'red', { x: 120, y: 0 }, 'lux').ai = false;
  f.w.step(180);
  expect(f.records()[0].detonation!.contacts.length).toBeGreaterThan(1);
  expect(leonaWAudioStates(f.records(), f.w.tick).filter((s) => s.kind === 'hit')).toHaveLength(1);
  expect(
    leonaWAudioStates(
      f.records().map((r) => ({ ...r, castVisible: false })),
      f.w.tick
    ).map((s) => s.kind)
  ).toEqual(['extended', 'hit']);
  expect(
    leonaWAudioStates(
      f.records().map((r) => ({ ...r, burstVisible: false })),
      f.w.tick
    ).map((s) => s.kind)
  ).toEqual(['initial']);
  expect(
    leonaWAudioStates(
      f.records().map((r) => ({ ...r, castVisible: false, burstVisible: false })),
      f.w.tick
    )
  ).toEqual([]);
});
function controller() {
  const calls: any[] = [],
    sources: any[] = [],
    gains: any[] = [];
  const context: any = {
    state: 'running',
    currentTime: 10,
    destination: {},
    createBufferSource() {
      const v: any = {
        onended: null,
        connect: (target: any) => target,
        disconnect: () => calls.push(['disconnectSource']),
        start: (...args: number[]) => calls.push(['start', ...args]),
        stop: (...args: number[]) => calls.push(['stop', ...args]),
      };
      sources.push(v);
      return v;
    },
    createGain() {
      const g: any = {
        connect: (target: any) => target,
        disconnect: () => calls.push(['disconnectGain']),
        gain: {
          value: 0,
          setValueAtTime: (...args: number[]) => calls.push(['value', ...args]),
          linearRampToValueAtTime: (...args: number[]) => calls.push(['ramp', ...args]),
          setTargetAtTime: () => {},
        },
      };
      gains.push(g);
      return g;
    },
  };
  const audio: any = new LeonaEclipseAudio();
  audio.status = 'ready';
  audio.buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds }))])
  );
  return { audio, context, calls, sources, gains };
}
test('controller owns finite sources, fades only the onset, reschedules delayed stops and releases every node', () => {
  const f = fixture(),
    p = controller(),
    listener = { x: 0, y: 0 };
  p.audio.update(p.context, true, f.records(), f.w.tick, listener);
  expect(p.sources).toHaveLength(2);
  expect(p.sources.every((s) => s.loop === false)).toBe(true);
  expect(p.calls.filter((c) => c[0] === 'ramp')).toEqual([['ramp', 1, 10.005]]);
  const first = p.sources[1];
  f.w.step(10);
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  p.audio.update(p.context, true, f.records(), f.w.tick, listener);
  expect(p.sources[1]).toBe(first);
  expect(p.calls).toContainEqual(['stop', 10.5]);
  expect(p.calls.filter((c) => c[0] === 'ramp')).toHaveLength(1);
  p.audio.stop();
  expect(p.audio.voices.size).toBe(0);
  expect(p.calls.filter((c) => c[0] === 'disconnectSource')).toHaveLength(2);
  expect(p.calls.filter((c) => c[0] === 'disconnectGain')).toHaveLength(4);
});
test('natural completions and stolen voices stay remembered through fog while mute/resume seeks current phase', () => {
  const f = fixture(),
    p = controller(),
    at = { x: 0, y: 0 };
  p.audio.suppressCast(f.u.id, f.w.tick);
  p.audio.update(p.context, true, f.records(), f.w.tick + 1, at);
  expect(p.sources).toHaveLength(1);
  p.sources[0].onended();
  p.audio.update(
    p.context,
    true,
    f.records().map((r) => ({ ...r, castVisible: false })),
    f.w.tick + 1,
    at
  );
  p.audio.update(p.context, true, f.records(), f.w.tick + 1, at);
  expect(p.sources).toHaveLength(1);
  const other = controller();
  other.audio.update(other.context, true, f.records(), f.w.tick + 30, at);
  other.audio.update(other.context, false, f.records(), f.w.tick + 30, at);
  expect(other.audio.voices.size).toBe(0);
  other.audio.update(other.context, true, f.records(), f.w.tick + 60, at);
  expect(
    other.calls
      .filter((c) => c[0] === 'start')
      .slice(-2)
      .map((c) => c[2])
  ).toEqual([1, 1]);
  const crowded = Array.from({ length: 8 }, (_, id) => ({ ...f.records()[0], id: id + 100 }));
  other.audio.update(other.context, true, crowded, f.w.tick + 1, at);
  expect(other.audio.voices.size).toBe(6); // Separate two-cast/four-buff global caps.
  other.audio.update(other.context, true, [], f.w.tick + 1, at);
  expect([
    other.audio.voices.size,
    other.audio.finished.size,
    other.audio.fallbackCasts.size,
  ]).toEqual([0, 0, 0]);
});
