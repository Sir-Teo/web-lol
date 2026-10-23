import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LUX_E_AUDIO as P } from '../src/content/lux-e-audio';
import { LUX_E_AUDIO_TAIL_TICKS } from '../src/content/lux-e-audio-timing';
import { luxEAudioStates, LUX_E_AUDIO_KINDS } from '../src/audio/lux-e-state';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const cast = () => {
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step();
  };
  const states = () => luxEAudioStates(w.luxEAudio.records, w.tick);
  return { w, lux, cast, states };
}

test('all twelve finite float masters retain their verified PCM, peaks, source delays, gains and caps', () => {
  const decoded = JSON.parse(readFileSync('docs/reference/lux-e-audio-decoded.json', 'utf8'));
  let bytes = 0;
  for (const kind of LUX_E_AUDIO_KINDS) {
    expect(P[kind].policy).toMatchObject({
      bIsGlobal: 1,
      sLoopCount: 1,
      bIsContinuous: 0,
      bKillNewest: 0,
    });
    for (const clip of P[kind].variants) {
      const raw = readFileSync('public/' + clip.url);
      bytes += raw.length;
      const master = decoded.media.find((m: any) => m.id === clip.id);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(clip.sha256);
      expect(master.pcmSha256).toBe(clip.pcmSha256);
      expect(master.decoderMetadata.loopingInfo).toBeNull();
      expect(clip.sampleRate).toBe(44100);
      expect(clip.channels).toBe(1);
      expect(clip.frames / 44100).toBe(clip.durationSeconds);
    }
  }
  expect(bytes).toBe(5029948);
  expect(P.flight.delaySeconds).toBe(0.1);
  expect(P.zoneDelayed.delaySeconds).toBe(0.5);
  expect(P.flight.stop).toMatchObject({ fadeSeconds: 1.5, curve: 4 });
  expect(P.hit.variants.some((v) => v.peak > 1)).toBe(true);
  expect(Math.ceil((P.zoneDelayed.delaySeconds + P.zoneDelayed.maxDurationSeconds) * 60)).toBe(
    LUX_E_AUDIO_TAIL_TICKS - 1
  );
});

test('accepted cast, delayed flight, two finite zone layers and hit resume exactly from saved phases', () => {
  const { w, cast, states } = setup();
  cast();
  expect(states().map((s) => s.kind)).toEqual(['cast']);
  w.step(15);
  expect(w.luxEAudio.records[0].launch?.tick).toBe(16);
  expect(states().some((s) => s.kind === 'flight')).toBe(false);
  w.step(6);
  expect(states().find((s) => s.kind === 'flight')).toMatchObject({ offset: 0, x: 140, y: 0 });
  for (const tick of [45, 75, 120, 345, 375, 452]) {
    w.step(tick - w.tick);
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    expect(luxEAudioStates(saved.luxEAudio.records, saved.tick)).toEqual(states());
    expect(saved.snapshot()).toBe(w.snapshot());
    if (tick === 45) expect(states().map((s) => s.kind)).toEqual(['cast', 'flight', 'zone']);
    if (tick === 75) {
      expect(states().find((s) => s.kind === 'zoneDelayed')?.offset).toBe(0);
      expect(states().find((s) => s.kind === 'flight')?.fade).toBeCloseTo(2 / 3);
    }
    if (tick === 120) expect(states().find((s) => s.kind === 'flight')?.fade).toBeCloseTo(1 / 6);
    if (tick === 345) expect(states().map((s) => s.kind)).toEqual(['hit']);
  }
  expect(states()).toEqual([]);
  w.step(345 + LUX_E_AUDIO_TAIL_TICKS - w.tick);
  expect(w.luxEAudio.records).toEqual([]);
});

test('early recast never births a delayed zone action; short self flight never births after its stop', () => {
  const { w, lux, cast, states } = setup();
  cast();
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: lux });
  w.step(44);
  expect(states().map((s) => s.kind)).toEqual(['cast', 'flight', 'hit']);
  w.step(30);
  expect(states().some((s) => s.kind === 'zoneDelayed' || s.kind === 'zone')).toBe(false);
  const own = setup();
  own.w.enqueue({ type: 'cast', unit: own.lux.id, ability: 'e', point: own.lux });
  own.w.step(50);
  expect(own.states().some((s) => s.kind === 'flight')).toBe(false);
});

test('death in windup retains only the cast; a released orb persists after death and stops at victory', () => {
  for (const released of [false, true]) {
    const { w, lux, cast, states } = setup();
    const foe = w.spawn('champion', 'red', { x: 1000, y: 0 });
    cast();
    if (released) w.step(24);
    w.damage(foe, lux, 10000, 'true');
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    expect(copy.luxEAudio).toEqual(w.luxEAudio);
    if (!released) expect(states().map((s) => s.kind)).toEqual(['cast']);
    else {
      const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
      w.damage(lux, nexus, 1e9, 'true');
      expect(w.luxEAudio.records[0].stopTick).toBe(w.tick);
      expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
      const fading = states().find((s) => s.kind === 'flight')!;
      expect(fading.remainingFade).toBe(1.5);
      expect(luxEAudioStates(w.luxEAudio.records, w.tick + 90)).toEqual([]);
    }
  }
});

test('global variant cycles cross Lux owners and survive reload without changing gameplay RNG or IDs', () => {
  const { w, lux } = setup();
  const other = w.spawn('champion', 'red', { x: 8000, y: 8000 }, 'lux');
  const rng = w.random.state;
  const variants: number[] = [];
  for (let i = 0; i < 12; i++) {
    const source = i % 2 ? lux : other;
    w.championState(source.id)!.cooldowns.e = 0;
    source.mana = source.maxMana;
    w.enqueue({ type: 'cast', unit: source.id, ability: 'e', point: source });
    w.step();
    variants.push(luxEAudioStates(w.luxEAudio.records, w.tick).at(-1)!.variant);
    w.step(315);
    expect(World.fromSnapshot(w.snapshot(), w.battlefield).luxEAudio.counts).toEqual(
      w.luxEAudio.counts
    );
  }
  for (let i = 3; i < variants.length; i++)
    expect(new Set(variants.slice(i - 3, i + 1)).size).toBe(4);
  expect(w.random.state).toBe(rng);
});

test('strict restore rejects crossed, missing, future, duplicate, expired and contradictory audio phases', () => {
  const { w, cast } = setup();
  cast();
  w.step(74);
  const original = w.snapshot();
  const mutations = [
    (s: any) => s.luxEAudio.records.splice(0),
    (s: any) => s.luxEAudio.records[0].sourceId++,
    (s: any) => s.luxEAudio.records[0].launch.tick++,
    (s: any) => s.luxEAudio.records[0].launch.zoneId++,
    (s: any) => s.luxEAudio.records[0].arrival.tick++,
    (s: any) => s.luxEAudio.records[0].launch.ordinal++,
    (s: any) => s.luxEAudio.records.push(s.luxEAudio.records[0]),
    (s: any) => (s.luxEAudio.records[0].stopTick = s.tick),
    (s: any) => (s.luxEAudio.counts.flight = 0),
  ];
  for (const mutate of mutations) {
    const s = JSON.parse(original);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow(
      /Lucent|snapshot|match/i
    );
  }
});

test('an early-return victory freezes the actual flight endpoint rather than advancing an extra step', () => {
  const { w, cast, states } = setup();
  cast();
  w.step(24);
  const endpoint = { x: w.singularities[0].x, y: w.singularities[0].y };
  const finisher = w.spawn('melee', 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = w.tick + 1;
  finisher.attackTarget = nexus.id;
  w.step();
  expect(w.winner).toBe('blue');
  expect(w.luxEAudio.records[0].flightStopPoint).toEqual(endpoint);
  expect(states().find((s) => s.kind === 'flight')).toMatchObject(endpoint);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('a saved pending E cannot omit its accepted audio dispatch history', () => {
  const { w, cast } = setup();
  cast();
  const saved = JSON.parse(w.snapshot());
  saved.luxEAudio.records = [];
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow(
    'Lucent audio history'
  );
});
