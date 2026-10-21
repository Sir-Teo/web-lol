import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GAREN_W_AUDIO as P } from '../src/content/garen-w-audio';
import { GAREN_W_AUDIO_TAIL_TICKS } from '../src/content/garen-w-audio-timing';
import {
  garenWAudioStates,
  garenWVariant,
  type GarenWAudioRecord,
} from '../src/audio/garen-w-state';
import { GarenCourageAudio } from '../src/audio/garen-w';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

const kinds = ['cast', 'active', 'end'] as const;
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const record: GarenWAudioRecord = {
  id: 1,
  startTick: 0,
  stopTick: null,
  endReason: null,
  x: 0,
  y: 0,
  visible: true,
};
test('Courage keeps all four source events, eight untouched mono masters, sound-level gain and exclusive loop bounds', () => {
  const graphBytes = readFileSync('docs/reference/garen-w-audio.json'),
    graph = JSON.parse(graphBytes.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/garen-w-audio-decoded.json', 'utf8'));
  expect(decoded.sourceGraphSha256).toBe(hash(graphBytes));
  expect(graph.extractionSha256).toBe(
    hash(readFileSync('docs/reference/garen-audio-extraction.json'))
  );
  expect(graph.referenceSha256).toBe(hash(readFileSync('docs/reference/garen-model.json')));
  expect(graph.events).toHaveLength(4);
  expect(graph.media).toHaveLength(8);
  expect(graph.unresolvedHierarchyIds).toEqual([1259461568]);
  expect(
    kinds.map((k) => [P[k].gainDb, P[k].variants.length, P[k].policy.u16MaxNumInstance])
  ).toEqual([
    [-15, 3, 2],
    [-16, 2, 4],
    [-17, 3, 4],
  ]);
  expect(P.active.stop).toMatchObject({ fadeSeconds: 0.25, curve: 4 });
  expect(P.cast.variants.filter((v) => v.gainDb !== 0).map((v) => v.gainDb)).toEqual([
    -0.20000000298023224,
  ]);
  expect(P.active.variants.map((v) => v.loop)).toEqual([
    { start: 26742, end: 219583 },
    { start: 28276, end: 220402 },
  ]);
  for (const kind of kinds)
    for (const v of P[kind].variants) {
      const raw = readFileSync('public/' + v.url);
      expect(hash(raw)).toBe(v.sha256);
      const m = decoded.media.find((m: any) => m.id === v.id);
      expect(m.pcmSha256).toBe(v.pcmSha256);
      expect(m.channels).toBe(1);
      expect(m.frames).toBe(v.frames);
      expect(m.decoderMetadata.loopingInfo).toEqual(v.loop);
      const source = graph.media.find((m: any) => m.id === v.id);
      expect(m.encodedSha256).toBe(source.sha256);
      expect(v.peak).toBeGreaterThan(kind === 'active' ? 0 : 1);
    }
});
test('Courage phases preserve loops, fade clocks, visibility and indexed variants without inventing an end cue on death', () => {
  expect(garenWAudioStates([record], -1)).toEqual([]);
  expect(garenWAudioStates([record], NaN)).toEqual([]);
  expect(garenWAudioStates([{ ...record, visible: false }], 90)).toEqual([]);
  expect(garenWAudioStates([record], 90).map((s) => [s.kind, s.offset, s.fade])).toEqual([
    ['cast', 1.5, 1],
    ['active', 1.5, 1],
  ]);
  const ended = { ...record, stopTick: 240, endReason: 'expired' as const };
  const states = garenWAudioStates([ended], 246);
  expect(states.map((s) => s.kind)).toEqual(['active', 'end']);
  expect(states[0].fade).toBeCloseTo(0.6);
  expect(states[0].remainingFade).toBeCloseTo(0.15);
  expect(states[1].offset).toBeCloseTo(0.1);
  expect(garenWAudioStates([ended], 255).map((s) => s.kind)).toEqual(['end']);
  expect(garenWAudioStates([ended], 340)).toEqual([]);
  for (const endReason of ['death', 'match-end'] as const)
    expect(
      garenWAudioStates([{ ...record, stopTick: 10, endReason }], 12).map((s) => s.kind)
    ).toEqual(['cast', 'active']);
  for (const k of kinds)
    expect(new Set(Array.from({ length: 100 }, (_, id) => garenWVariant(id, 25, k))).size).toBe(
      P[k].variants.length
    );
  // The loop sampler also supports a long held phase without replaying its intro.
  const active = garenWAudioStates([record], 600).find((s) => s.kind === 'active')!,
    clip = P.active.variants[active.variant];
  expect(active.offset).toBeCloseTo(
    clip.loop.start / 44100 +
      ((10 - clip.loop.start / 44100) % ((clip.loop.end - clip.loop.start) / 44100))
  );
});
function world() {
  const w = new World(
    false,
    { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true },
    'garen'
  );
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.learnSpell('w');
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
  w.step();
  return w;
}
test('Courage history outlives shield loss, natural expiry and death and restores every sound phase', () => {
  for (const death of [false, true]) {
    const w = world();
    w.damage(w.hero, w.hero, 70, 'true');
    expect(w.shieldAmount(w.hero)).toBe(0);
    expect(w.player.garenWVisual?.stopTick).toBeNull();
    if (death) w.damage(w.hero, w.hero, 1e6, 'true');
    else w.step(240);
    expect(w.player.garenW).toBeNull();
    expect(w.player.garenWVisual).toMatchObject({
      startTick: 1,
      stopTick: death ? 1 : 241,
      endReason: death ? 'death' : 'expired',
    });
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    const phases = (x: World) =>
      garenWAudioStates(
        [{ ...x.player.garenWVisual!, id: x.hero.id, x: x.hero.x, y: x.hero.y, visible: true }],
        x.tick
      );
    expect(phases(restored)).toEqual(phases(w));
    w.step(100);
    restored.step(100);
    expect(restored.snapshot()).toBe(w.snapshot());
    if (death) expect(phases(w).map((s) => s.kind)).toEqual(['cast']);
    expect(w.player.garenWVisual).not.toBeNull();
    w.step(GAREN_W_AUDIO_TAIL_TICKS - 100);
    restored.step(GAREN_W_AUDIO_TAIL_TICKS - 100);
    expect(w.player.garenWVisual).toBeNull();
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});
test('match end stops Courage loops without manufacturing the natural-expiry ending', () => {
  const w = world(),
    nexus = w.spawn('nexus', 'red', { x: 0, y: 0 });
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  expect(w.player.garenWVisual).toMatchObject({ stopTick: 1, endReason: 'match-end' });
  expect(w.player.garenW).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
test('Courage checkpoints reject absent, foreign, future, mismatched, contradictory and expired presentation history', () => {
  const w = world(),
    base = JSON.parse(w.snapshot());
  const mutations = [
    (s: any) => (s.winner = 'blue'),
    (s: any) => delete s.player.garenWVisual,
    (s: any) => (s.player.garenWVisual = null),
    (s: any) => s.player.garenWVisual.startTick++,
    (s: any) => (s.player.garenWVisual.endReason = 'death'),
    (s: any) => (s.player.garenWVisual.stopTick = s.tick),
    (s: any) => {
      s.player.garenW = null;
      s.player.garenWVisual.stopTick = s.tick;
      s.player.garenWVisual.endReason = 'expired';
    },
    (s: any) => {
      s.player.garenW = null;
      s.player.garenWVisual.stopTick = s.tick;
      s.player.garenWVisual.endReason = 'death';
    },
    (s: any) => {
      s.player.garenW = null;
      s.player.garenWVisual.stopTick = s.tick;
      s.player.garenWVisual.endReason = 'match-end';
    },
    (s: any) => (s.player.spellRanks.w = 0),
  ];
  for (const change of mutations) {
    const s = structuredClone(base);
    change(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(240);
  const expired = JSON.parse(w.snapshot());
  expired.tick += GAREN_W_AUDIO_TAIL_TICKS;
  expect(() => World.fromSnapshot(JSON.stringify(expired), w.battlefield)).toThrow();
  const foreign = new World(false);
  const s = JSON.parse(foreign.snapshot());
  s.player.garenWVisual = { startTick: 0, stopTick: null, endReason: null };
  expect(() => World.fromSnapshot(JSON.stringify(s), foreign.battlefield)).toThrow();
  const dead = world();
  dead.damage(dead.hero, dead.hero, 1e6, 'true');
  dead.step(240);
  const contradiction = JSON.parse(dead.snapshot());
  contradiction.player.garenWVisual = { startTick: 1, stopTick: 241, endReason: 'expired' };
  expect(() => World.fromSnapshot(JSON.stringify(contradiction), dead.battlefield)).toThrow(
    /Courage presentation/
  );
});
class Param {
  value = 0;
  sets: number[][] = [];
  ramps: number[][] = [];
  targets: number[][] = [];
  cancelScheduledValues() {
    return this;
  }
  setValueAtTime(v: number, t: number) {
    this.sets.push([v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.ramps.push([v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.targets.push([v, t]);
    return this;
  }
}
class Node {
  gain = new Param();
  buffer: any;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  starts: number[][] = [];
  stops: number[] = [];
  disconnected = 0;
  connect(n: any) {
    return n;
  }
  disconnect() {
    this.disconnected++;
  }
  start(t: number, o: number) {
    this.starts.push([t, o]);
  }
  stop(t = 0) {
    this.stops.push(t);
  }
}
function audio() {
  const nodes: Node[] = [],
    context = {
      state: 'running',
      currentTime: 10,
      destination: {},
      createBufferSource: () => {
        const n = new Node();
        nodes.push(n);
        return n;
      },
      createGain: () => new Node(),
    };
  const a = new GarenCourageAudio();
  a.status = 'ready';
  (a as any).buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds, id: v.id }))])
  );
  return { a, context: context as unknown as AudioContext, nodes };
}
test('Courage controller seeks source loop bounds and preserves a scheduled fade independently of camera gain', () => {
  const { a, context, nodes } = audio();
  a.update(context, true, [record], 90, record);
  a.update(context, true, [record], 90, record);
  expect(nodes).toHaveLength(2);
  const loop = nodes.find((n) => n.loop)!;
  const v = P.active.variants.find((v) => v.id === loop.buffer.id)!;
  expect(loop.loopStart).toBe(v.loop.start / 44100);
  expect(loop.loopEnd).toBe(v.loop.end / 44100);
  expect(loop.starts).toEqual([[10, 1.5]]);
  const ended = { ...record, stopTick: 240, endReason: 'expired' as const };
  a.update(context, true, [ended], 246, record);
  const active = [...(a as any).voices.values()].find((v: any) => v.kind === 'active');
  expect(active.envelope.gain.sets.at(-1)[0]).toBeCloseTo(0.6);
  expect(active.envelope.gain.ramps.at(-1)).toEqual([0, 10.15]);
  expect(loop.stops).toEqual([10.15]);
  a.update(context, true, [ended], 246, { x: 4000, y: 0 });
  expect(loop.stops).toEqual([10.15]);
  expect(active.envelope.gain.ramps).toHaveLength(1);
  a.stop();
  expect((a as any).voices.size).toBe(0);
  expect(nodes.every((n) => n.disconnected === 1)).toBe(true);
});
test('Courage respects per-container voice caps and never replays finished/stolen voices across hidden histories', () => {
  const { a, context, nodes } = audio(),
    records = Array.from({ length: 6 }, (_, i) => ({ ...record, id: i + 1 }));
  a.update(context, true, records, 1, record);
  expect([...(a as any).voices.values()].filter((v: any) => v.kind === 'cast')).toHaveLength(2);
  expect([...(a as any).voices.values()].filter((v: any) => v.kind === 'active')).toHaveLength(4);
  const count = nodes.length;
  a.update(
    context,
    true,
    records.map((r) => ({ ...r, visible: false })),
    1,
    record
  );
  a.update(context, true, records, 1, record);
  expect(nodes.length - count).toBe(6);
  const current = [...(a as any).voices.values()];
  for (const v of current) v.source.onended();
  const completed = nodes.length;
  a.update(context, true, records, 1, record);
  expect(nodes).toHaveLength(completed);
  a.update(
    context,
    true,
    records.map((r) => ({ ...r, visible: false })),
    1,
    record
  );
  a.update(context, true, records, 1, record);
  expect(nodes).toHaveLength(completed);
});
test('a synthesized Courage cast stays suppressed through late load and visibility changes while its loop remains eligible', () => {
  const { a, context, nodes } = audio();
  a.suppressCast(1, 0);
  a.update(context, true, [{ ...record, visible: false }], 1, record);
  a.update(context, true, [record], 2, record);
  expect(nodes).toHaveLength(1);
  expect(nodes[0].loop).toBe(true);
});
