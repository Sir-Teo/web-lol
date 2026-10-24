import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LEONA_E_AUDIO as P } from '../src/content/leona-e-audio';
import { LEONA_W_AUDIO } from '../src/content/leona-w-audio';
import {
  leonaEAudioStates,
  leonaEVariant,
  LEONA_E_AUDIO_KINDS as kinds,
  type LeonaEAudioRecord,
} from '../src/audio/leona-e-state';
import { LeonaZenithAudio } from '../src/audio/leona-e';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import bounds from '../src/content/leona-e-history-bounds.json';
import { zenithExpiry } from '../src/simulation/leona-e-visuals';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function fixture(hit = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = 300;
  w.hero.y = -100;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', 'red', { x: hit ? 800 : 3000, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  for (const unit of w.units) unit.ai = false;
  w.learnSpell('e', u.id);
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
  };
  cast();
  const records = (world = w): LeonaEAudioRecord[] =>
    world.championState(u.id)!.leonaEVisuals.map((r) => ({ ...r, id: u.id }));
  return { w, u, target, cast, records, state: w.championState(u.id)! };
}
test('eight source events and 21 float masters retain provenance, pitch, finite decoding, stops and attenuation', () => {
  const raw = readFileSync('docs/reference/leona-e-audio.json'),
    graph = JSON.parse(raw.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/leona-e-audio-decoded.json', 'utf8'));
  expect(decoded.sourceGraphSha256).toBe(sha(raw));
  expect(graph.extractionSha256).toBe(
    sha(readFileSync('docs/reference/leona-audio-extraction.json'))
  );
  expect(graph.events).toHaveLength(8);
  expect(graph.media).toHaveLength(21);
  expect(graph.unresolvedHierarchyIds).toEqual([1259461568]);
  expect(P.attenuation).toEqual(LEONA_W_AUDIO.attenuation);
  expect(
    kinds.map((k) => [P[k].gainDb, P[k].variants.length, P[k].policy.u16MaxNumInstance])
  ).toEqual([
    [-9, 4, 2],
    [-8, 4, 2],
    [-11, 1, 0],
    [-11, 4, 3],
    [-10, 4, 4],
    [-14, 4, 4],
  ]);
  expect(P.contact.pitchCents).toBe(300);
  expect(P.contact.policy.bKillNewest).toBe(1);
  expect(P.dash.stop).toMatchObject({ delaySeconds: 0.25, fadeSeconds: 0 });
  expect(P.flight.stop).toMatchObject({ delaySeconds: 0, fadeSeconds: 0.25 });
  let headroom = 0;
  for (const k of kinds)
    for (const v of P[k].variants) {
      const m = decoded.media.find((m: any) => m.id === v.id),
        bank = graph.media.find((m: any) => m.id === v.id);
      expect(sha(readFileSync('public/' + v.url))).toBe(v.sha256);
      expect(m.wavSha256).toBe(v.sha256);
      expect(m.pcmSha256).toBe(v.pcmSha256);
      expect(m.encodedSha256).toBe(bank.sha256);
      expect([m.channels, m.sampleRate, m.frames]).toEqual([1, 44100, v.frames]);
      expect(m.decoderMetadata.loopingInfo).toBeNull();
      headroom += m.samplesOutsideUnitRange;
      expect((v.durationSeconds / 2 ** (P[k].pitchCents / 1200)) * 60).toBeLessThan(
        bounds.bounds.history
      );
    }
  expect(headroom).toBeGreaterThan(0);
});
test('real saved cast, launch, contacts, dash and arrival expose six independent finite roles', () => {
  const f = fixture(),
    seen = new Set<string>();
  expect(leonaEAudioStates(f.records(), 0)).toEqual([]);
  expect(leonaEAudioStates(f.records(), NaN)).toEqual([]);
  expect(leonaEAudioStates(f.records(), f.w.tick).map((s) => s.kind)).toEqual(['cast']);
  for (let i = 0; i < 150; i++) {
    for (const s of leonaEAudioStates(f.records(), f.w.tick)) seen.add(s.kind);
    f.w.step();
  }
  expect([...seen].sort()).toEqual([...kinds].sort());
  expect(leonaEAudioStates(f.records(), f.w.tick)).toEqual([]);
  for (const kind of kinds)
    expect(new Set(Array.from({ length: 200 }, (_, id) => leonaEVariant(id, 55, kind))).size).toBe(
      P[kind].variants.length
    );
});
test('phase stop uses a flight fade and a distinct unattenuated dash delay; positive pitch advances media time', () => {
  const f = fixture();
  f.w.step(80);
  const r = structuredClone(f.records()[0]),
    flight = r.flight!,
    dash = r.dash!;
  flight.stopTick = flight.startTick + 10;
  dash.stopTick = dash.startTick + 2;
  const fade = leonaEAudioStates([r], flight.stopTick + 7.5).find((s) => s.kind === 'flight')!;
  expect(fade.envelope).toBeCloseTo(0.5);
  expect(fade.remaining).toBeCloseTo(0.125);
  expect(fade.stopAtTick).toBe(flight.stopTick + 15);
  const delayed = leonaEAudioStates([r], dash.stopTick + 7.5).find((s) => s.kind === 'dash')!;
  expect(delayed.envelope).toBe(1);
  expect(delayed.remaining).toBeCloseTo(0.125);
  expect(delayed.fadeOutSeconds).toBe(0);
  expect(leonaEAudioStates([r], dash.stopTick + 15).some((s) => s.kind === 'dash')).toBe(false);
  const contact = flight.contacts[0],
    pitched = leonaEAudioStates([r], contact.tick + 6).find((s) => s.kind === 'contact')!;
  expect(pitched.playbackRate).toBeCloseTo(2 ** 0.25);
  expect(pitched.offset).toBeCloseTo(0.1 * 2 ** 0.25);
  expect(pitched.remaining).toBeCloseTo(
    P.contact.variants[pitched.variant].durationSeconds / 2 ** 0.25 - 0.1
  );
});
test('multi-target generic contacts stay separate from champion-only layers and independent audiences', () => {
  const f = fixture();
  const minion = f.w.spawn('melee', 'red', { x: 400, y: 0 });
  minion.ai = false;
  minion.hp = minion.maxHp = 10000;
  f.w.step(80);
  const r = f.records()[0],
    contacts = r.flight!.contacts;
  expect(contacts.map((c) => c.targetKind)).toEqual(['melee', 'champion']);
  for (const c of contacts) {
    const states = leonaEAudioStates([r], c.tick + 0.1).filter((s) =>
      s.key.endsWith(':' + c.targetId)
    );
    expect(states.map((s) => s.kind).sort()).toEqual(
      c.targetKind === 'champion' ? ['championContact', 'contact'] : ['contact']
    );
  }
  r.castFrame.audience = ['red'];
  r.flight!.audience = ['red'];
  r.dash!.startFrame.audience = ['red'];
  const c = contacts[0];
  c.audience = ['red'];
  expect(leonaEAudioStates([r], c.tick + 1)).toEqual([]);
});
test('saved futures cover misses, interrupted windup/dash, surviving flight, terminal tails and retention without World changes', () => {
  for (const mode of [
    'hit',
    'miss',
    'windup-death',
    'flight-death',
    'dash-control',
    'terminal',
  ] as const) {
    const f = fixture(mode !== 'miss');
    f.w.step(
      mode === 'windup-death' ? 3 : mode === 'flight-death' ? 20 : mode === 'dash-control' ? 45 : 75
    );
    if (mode.endsWith('death')) f.w.damage(f.target, f.u, 1e9, 'true');
    if (mode === 'dash-control') {
      f.u.stunUntil = f.w.tick + 60;
      f.w.step();
    }
    if (mode === 'terminal') {
      const inhibitor = f.w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
      f.w.damage(f.w.hero, inhibitor, 1e9, 'true');
      const nexus = f.w.spawn('nexus', 'red', { x: 2500, y: 2500 });
      f.w.damage(f.w.hero, nexus, 1e9, 'true');
    }
    const saved = f.w.snapshot(),
      copy = World.fromSnapshot(saved, f.w.battlefield);
    for (let age = 0; age < 180; age += 3)
      expect(leonaEAudioStates(f.records(copy), f.w.tick + age)).toEqual(
        leonaEAudioStates(f.records(), f.w.tick + age)
      );
    for (const r of f.records())
      if (r.endTick !== null) expect(leonaEAudioStates([r], zenithExpiry(r) - 1)).toEqual([]);
    if (mode === 'windup-death') expect(f.records()[0].flight).toBeNull();
    if (mode === 'dash-control') expect(f.records()[0].arrival).toBeNull();
    expect(f.w.snapshot()).toBe(saved);
    f.w.step(40);
    copy.step(40);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
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
      const source: any = {
        onended: null,
        playbackRate: { value: 1 },
        connect: (t: any) => t,
        disconnect: () => calls.push(['disconnectSource']),
        start: (...v: number[]) => calls.push(['start', ...v]),
        stop: (...v: number[]) => calls.push(['stop', ...v]),
      };
      sources.push(source);
      return source;
    },
    createGain() {
      const gain: any = {
        connect: (t: any) => t,
        disconnect: () => calls.push(['disconnectGain']),
        gain: {
          value: 0,
          cancelScheduledValues: (...v: number[]) => calls.push(['cancel', ...v]),
          setValueAtTime: (...v: number[]) => calls.push(['value', ...v]),
          linearRampToValueAtTime: (...v: number[]) => calls.push(['ramp', ...v]),
          setTargetAtTime: () => {},
        },
      };
      gains.push(gain);
      return gain;
    },
  };
  const audio: any = new LeonaZenithAudio();
  audio.status = 'ready';
  audio.buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds }))])
  );
  return { audio, context, calls, sources, gains };
}
test('controller reschedules active flight fade from saved stop metadata and fresh controllers seek inside its tail', () => {
  const f = fixture();
  f.w.step(20);
  const c = controller(),
    point = { x: 0, y: 0 };
  c.audio.update(c.context, true, f.records(), f.w.tick, point);
  const flight = [...c.audio.voices].find(([, v]: any) => v.kind === 'flight') as any,
    original = flight[1].source;
  f.w.step(25);
  const r = f.records()[0],
    stop = r.flight!.stopTick!;
  expect(stop).not.toBeNull();
  c.audio.update(c.context, true, f.records(), stop + 7.5, point);
  expect(c.audio.voices.get(flight[0]).source).toBe(original);
  expect(c.calls).toContainEqual(['value', 0.5, 10]);
  expect(c.calls).toContainEqual(['ramp', 0, 10.125]);
  const fresh = controller();
  fresh.audio.update(fresh.context, true, f.records(), stop + 7.5, point);
  const state = leonaEAudioStates(f.records(), stop + 7.5).find((s) => s.kind === 'flight')!;
  expect(fresh.calls).toContainEqual(['start', 10, state.offset]);
  expect(fresh.calls).toContainEqual(['stop', 10.125]);
  expect(fresh.sources.every((s) => s.loop === false)).toBe(true);
  c.audio.stop();
  fresh.audio.stop();
  expect(c.audio.voices.size).toBe(0);
  expect(c.calls.filter((x) => x[0] === 'disconnectGain')).toHaveLength(c.sources.length * 2);
});
test('kill-newest contact cap rejects new voices while zero-cap dash remains locally unlimited', () => {
  const f = fixture();
  f.w.step(80);
  const r = f.records()[0],
    tick = r.flight!.contacts[0].tick + 1;
  const crowded = Array.from({ length: 8 }, (_, i) => ({ ...structuredClone(r), id: 100 + i }));
  const c = controller();
  c.audio.update(c.context, true, crowded, tick, { x: 0, y: 0 });
  c.audio.update(c.context, true, crowded, r.dash!.startTick + 1, { x: 0, y: 0 });
  const voices = [...c.audio.voices] as any[];
  expect(voices.filter(([, v]) => v.kind === 'contact').map(([k]) => k.split(':')[0])).toEqual([
    '100',
    '101',
    '102',
  ]);
  expect(voices.filter(([, v]) => v.kind === 'dash')).toHaveLength(8);
  expect(c.audio.finished.has(`107:${r.startTick}:contact:${r.flight!.contacts[0].targetId}`)).toBe(
    true
  );
  c.audio.update(c.context, true, [], tick, { x: 0, y: 0 });
  expect([c.audio.voices.size, c.audio.finished.size, c.audio.fallbackCasts.size]).toEqual([
    0, 0, 0,
  ]);
});
test('mute and current fog resume at rate-adjusted offsets without replaying completed or fallback cast cues', () => {
  const f = fixture();
  f.w.step(45);
  const tick = f.records()[0].flight!.contacts[0].tick + 1,
    c = controller(),
    p = { x: 0, y: 0 };
  c.audio.suppressCast(f.u.id, f.records()[0].startTick);
  c.audio.update(c.context, true, f.records(), tick, p, () => false);
  expect(c.sources).toHaveLength(0);
  c.audio.update(c.context, true, f.records(), tick, p);
  const contact = [...c.audio.voices].find(([, v]: any) => v.kind === 'contact') as any;
  contact[1].source.onended();
  c.audio.update(c.context, false, f.records(), tick, p);
  expect(c.audio.voices.size).toBe(0);
  c.audio.update(c.context, true, f.records(), tick + 1, p);
  expect(c.audio.voices.has(contact[0])).toBe(false);
  const resumed = leonaEAudioStates(f.records(), tick + 1).filter(
    (s) => s.kind !== 'contact' && s.kind !== 'cast'
  );
  for (const s of resumed) expect(c.calls).toContainEqual(['start', 10, s.offset]);
  c.audio.stop();
});
