import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ORACLE_AUDIO as P } from '../src/content/oracle-audio';
import {
  oracleAudioStates,
  oraclePitchCents,
  oracleStopFade,
  type OracleAudioRecord,
} from '../src/audio/oracle-state';
import {
  oracleChildTick,
  oraclePresentationEndTick,
  oracleVisualEndTick,
  ORACLE_PRESENTATION_TAIL_TICKS,
} from '../src/content/oracle-presentation';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { swapTrinket } from '../src/simulation/trinkets';
import { requestOracle } from '../src/simulation/oracle-lens';
const hash = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');
const record: OracleAudioRecord = {
  id: 7,
  startTick: 0,
  origin: { x: 0, y: 0 },
  facing: 0,
  stopTick: null,
  endReason: null,
  childAnchor: null,
  x: 10,
  y: 20,
  visible: true,
  endVisible: true,
};
const kinds = ['intro', 'loop', 'end'] as const;
test('Oracle media preserve the pinned Lvl3→Lvl2 active binding, Lvl1 child ending, all samples and declared stop/loop policies', () => {
  const graphRaw = readFileSync('docs/reference/oracle-audio.json');
  const graph = JSON.parse(graphRaw.toString());
  const bindingRaw = readFileSync('docs/reference/oracle-audio-bindings.json');
  const binding = JSON.parse(bindingRaw.toString());
  const extractionRaw = readFileSync('docs/reference/oracle-audio-extraction.json');
  const extraction = JSON.parse(extractionRaw.toString());
  const decoded = JSON.parse(readFileSync('docs/reference/oracle-audio-decoded.json', 'utf8'));
  expect(graph.bindingsSha256).toBe(hash(bindingRaw));
  expect(graph.extractionSha256).toBe(hash(extractionRaw));
  for (const ref of [binding, extraction])
    expect(ref.referenceSha256).toBe(hash(readFileSync('docs/reference/oracle-lens-source.json')));
  expect(decoded.sourceGraphSha256).toBe(hash(graphRaw));
  expect(binding.activeEvent).toBe('Play_sfx_TrinketLensLvl2Audio_buffactivate');
  expect(binding.endingEvent).toBe('Play_sfx_TrinketLensLvl1Audio_buffdeactivate');
  expect(binding.preload).toContain('data/particles/trinketlenslvl3audio.troy');
  expect(
    graph.events[0].actions.map((a: any) => a.mediaId).sort((a: number, b: number) => a - b)
  ).toEqual([P.loop.id, P.intro.id]);
  expect(graph.events[2].actions.map((a: any) => a.mediaId)).toEqual([P.end.id]);
  expect(graph.unresolvedHierarchyIds).toEqual([2149849771]);
  expect(P.loopVolumeParameter).toMatchObject({
    id: 745018932,
    nativeValue: null,
    localValue: 0,
    localGainDb: 0,
  });
  expect(P.loop.stop).toMatchObject({ fadeSeconds: 0.75, curve: 6 });
  expect(P.intro.stop).toMatchObject({ fadeSeconds: 0.75, curve: 6 });
  expect(P.end.stop).toBeNull();
  expect(kinds.map((k) => P[k].gainDb)).toEqual([-10, -11, -8]);
  for (const kind of kinds) {
    const p = P[kind],
      m = decoded.media.find((m: any) => m.id === p.id),
      source = graph.media.find((m: any) => m.id === p.id);
    const raw = readFileSync('public/' + p.url);
    expect(hash(raw)).toBe(p.sha256);
    expect(m.wavSha256).toBe(p.sha256);
    expect(m.encodedSha256).toBe(source.sha256);
    expect(m.pcmSha256).toBe(p.pcmSha256);
    expect(m.frames).toBe(p.frames);
    expect(m.channels).toBe(1);
    expect(m.sampleRate).toBe(44100);
    expect(m.decoderMetadata.loopingInfo).toBeNull();
    let pcm: Buffer | undefined;
    for (let offset = 12; offset < raw.length;) {
      const size = raw.readUInt32LE(offset + 4);
      if (raw.toString('ascii', offset, offset + 4) === 'data')
        pcm = raw.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size + (size % 2);
    }
    expect(pcm?.length).toBe(p.frames * 4);
    expect(hash(pcm!)).toBe(p.pcmSha256);
  }
  expect(P.loop.loop).toEqual({ start: 0, end: P.loop.frames });
});
test('Oracle samples concurrent pitch-adjusted layers, whole-master loop offsets, nonlinear stop fades and the fixed child anchor', () => {
  expect(oracleAudioStates([record], NaN)).toEqual([]);
  expect(oracleAudioStates([record], -1)).toEqual([]);
  const initial = oracleAudioStates([record], 0);
  expect(initial.map((s) => s.kind)).toEqual(['intro', 'loop']);
  expect(initial.every((s) => s.offset === 0 && s.fadeProgress === 0)).toBe(true);
  const long = oracleAudioStates([record], 420);
  expect(long.map((s) => s.kind)).toEqual(['loop']);
  expect(long[0].offset).toBeCloseTo((7 * long[0].rate) % P.loop.durationSeconds);
  const stopped = {
    ...record,
    stopTick: 60,
    endReason: 'recast' as const,
    childAnchor: { point: { x: 100, y: 200 }, facing: 1 },
  };
  const fade = oracleAudioStates([stopped], 75);
  expect(fade.map((s) => s.kind)).toEqual(['intro', 'loop']);
  expect(fade[1].fadeProgress).toBeCloseTo(1 / 3);
  expect(oracleStopFade(fade[1].fadeProgress)).toBeCloseTo(7 / 9);
  expect(fade[1].remainingFade).toBeCloseTo(0.5);
  expect(oracleAudioStates([stopped], 90).map((s) => s.kind)).toContain('end');
  expect(oracleAudioStates([stopped], 105).map((s) => s.kind)).toEqual(['end']);
  expect(oracleAudioStates([{ ...stopped, x: 900, y: 800 }], 180)).toMatchObject([
    { kind: 'end', offset: 1.5, x: 100, y: 200, rate: 1 },
  ]);
  expect(oracleAudioStates([{ ...stopped, visible: false, endVisible: false }], 90)).toEqual([]);
  expect(oracleAudioStates([{ ...stopped, visible: false }], 90).map((s) => s.kind)).toEqual([
    'end',
  ]);
  expect(
    oracleAudioStates([{ ...stopped, endVisible: false }], 90).every((s) => s.kind !== 'end')
  ).toBe(true);
  expect(oracleAudioStates([stopped], 250)).toEqual([]);
  expect(oracleStopFade(-1)).toBe(1);
  expect(oracleStopFade(2)).toBe(0);
  for (const kind of kinds)
    for (let id = 0; id < 100; id++) {
      const cents = oraclePitchCents(id, 123, kind);
      expect(cents).toBe(oraclePitchCents(id, 123, kind));
      expect(cents).toBeGreaterThanOrEqual(kind === 'end' ? 0 : -199);
      expect(cents).toBeLessThanOrEqual(kind === 'end' ? 0 : 201);
    }
});
test('Oracle audio-only tails restore identically after every visual particle has retired, then prune at the final sample bound', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = 1e9;
  swapTrinket(w, 'oracle');
  requestOracle(w, w.hero);
  w.step(480);
  const visual = w.player.trinket.visuals[0];
  const end = oraclePresentationEndTick(visual.startTick, visual.stopTick!);
  expect(ORACLE_PRESENTATION_TAIL_TICKS).toBe(190);
  expect(end).toBe(670);
  expect(oracleChildTick(visual.startTick, visual.stopTick)).toBe(510);
  w.step(oracleVisualEndTick(0, 480) - w.tick + 1);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  const states = (world: World) =>
    oracleAudioStates(
      world.player.trinket.visuals.map((r) => ({
        ...r,
        id: world.hero.id,
        x: world.hero.x,
        y: world.hero.y,
        visible: true,
        endVisible: true,
      })),
      world.tick
    );
  expect(states(w).map((s) => s.kind)).toEqual(['end']);
  expect(states(copy)).toEqual(states(w));
  w.step(end - w.tick - 1);
  copy.step(end - copy.tick - 1);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(states(w).map((s) => s.kind)).toEqual(['end']);
  w.step();
  copy.step();
  expect(w.player.trinket.visuals).toEqual([]);
  expect(copy.snapshot()).toBe(w.snapshot());
});
