import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GAREN_R_AUDIO as P } from '../src/content/garen-r-audio';
import {
  garenRAudioStates,
  garenRVariant,
  type GarenRAudioRecord,
} from '../src/audio/garen-r-state';
import { GarenJusticeAudio } from '../src/audio/garen-r';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_R_PRESENTATION_TAIL_TICKS } from '../src/simulation/garen-r';

const kinds = ['cast', 'hit', 'kill'] as const;
const record: GarenRAudioRecord = {
  id: 2,
  startTick: 0,
  targetId: 3,
  facing: 0,
  point: { x: 250, y: 0 },
  releaseTick: 27,
  stopTick: null,
  killed: true,
  x: 0,
  y: 0,
  castVisible: true,
  impactVisible: true,
};
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
test('R maps all three frozen events, the verified Champ_Kill link and seven unnormalized masters including stereo', () => {
  const graphBytes = readFileSync('docs/reference/garen-r-audio.json'),
    graph = JSON.parse(graphBytes.toString());
  const decoded = JSON.parse(readFileSync('docs/reference/garen-r-audio-decoded.json', 'utf8'));
  const linkBytes = readFileSync('docs/reference/garen-r-kill-audio-link.json'),
    link = JSON.parse(linkBytes.toString());
  expect(decoded.sourceGraphSha256).toBe(hash(graphBytes));
  expect(graph.extractionSha256).toBe(
    hash(readFileSync('docs/reference/garen-audio-extraction.json'))
  );
  expect(graph.referenceSha256).toBe(hash(readFileSync('docs/reference/garen-model.json')));
  expect(P.killParticleLinkSha256).toBe(hash(linkBytes));
  const particleBytes = readFileSync('docs/reference/garen-r-particles.json');
  expect(link.particlePinSha256).toBe(hash(particleBytes));
  expect(JSON.parse(particleBytes.toString()).extraction.files).toContainEqual(link.sourceFile);
  expect(link.definition.soundOnCreateDefault).toBe('Play_sfx_Garen_GarenR_buffactivate');
  expect(graph.events).toHaveLength(3);
  expect(
    graph.events.every((e: any) => e.actions.every((a: any) => a.type === 'CAkActionPlay'))
  ).toBe(true);
  expect(kinds.map((k) => P[k].variants.length)).toEqual([3, 3, 1]);
  expect(kinds.map((k) => P[k].gainDb)).toEqual([-11, -12, -13.5]);
  expect(kinds.map((k) => P[k].policy.u16MaxNumInstance)).toEqual([2, 2, 4]);
  for (const k of kinds)
    for (const v of P[k].variants) {
      const raw = readFileSync('public/' + v.url),
        m = decoded.media.find((m: any) => m.id === v.id);
      expect(hash(raw)).toBe(v.sha256);
      expect(v.sha256).toBe(m.wavSha256);
      let pcm: Buffer | undefined;
      for (let off = 12; off < raw.length;) {
        const tag = raw.toString('ascii', off, off + 4),
          size = raw.readUInt32LE(off + 4);
        if (tag === 'fmt ') {
          expect(raw.readUInt16LE(off + 8)).toBe(3);
          expect(raw.readUInt16LE(off + 10)).toBe(k === 'kill' ? 2 : 1);
          expect(raw.readUInt16LE(off + 22)).toBe(32);
        }
        if (tag === 'data') pcm = raw.subarray(off + 8, off + 8 + size);
        off += 8 + size + (size % 2);
      }
      expect(hash(pcm!)).toBe(v.pcmSha256);
      expect(pcm!.length).toBe(v.frames * v.channels * 4);
      expect(v.peak).toBeGreaterThan(1);
      expect(m.decoderMetadata.loopingInfo).toBeNull();
    }
});
test('R phases use acceptance and actual release clocks, frozen impact position and independent visibility', () => {
  expect(garenRAudioStates([record], 0).map((s) => s.kind)).toEqual(['cast']);
  const states = garenRAudioStates([{ ...record, x: 50 }], 57);
  expect(states.map((s) => s.kind)).toEqual(kinds);
  expect(states.map((s) => s.age)).toEqual([0.95, 0.5, 0.5]);
  expect(states.map((s) => s.x)).toEqual([50, 250, 250]);
  expect(garenRAudioStates([{ ...record, castVisible: false }], 57).map((s) => s.kind)).toEqual([
    'hit',
    'kill',
  ]);
  expect(garenRAudioStates([{ ...record, impactVisible: false }], 57).map((s) => s.kind)).toEqual([
    'cast',
  ]);
  for (const k of kinds)
    expect(new Set(Array.from({ length: 100 }, (_, id) => garenRVariant(id, 20, k))).size).toBe(
      P[k].variants.length
    );
  expect(garenRAudioStates([record], 57)).toEqual(garenRAudioStates([record], 57));
});
test('cancelled/pending/nonfatal R never invent kill cues and declared one-shots finish without an invented stop fade', () => {
  expect(
    garenRAudioStates([{ ...record, releaseTick: null, killed: false }], 57).map((s) => s.kind)
  ).toEqual(['cast']);
  expect(
    garenRAudioStates([{ ...record, releaseTick: null, stopTick: 10, killed: false }], 57).map(
      (s) => s.kind
    )
  ).toEqual(['cast']);
  expect(garenRAudioStates([{ ...record, killed: false }], 57).map((s) => s.kind)).toEqual([
    'cast',
    'hit',
  ]);
  expect(garenRAudioStates([record], 330)).toEqual([]);
});
function world(lethal: boolean) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  w.pendingSpawns = [];
  w.hero.x = w.hero.y = 0;
  w.gainExperience(1e6);
  w.learnSpell('r');
  const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
  target.maxHp = 2000;
  target.hp = lethal ? 1 : 2000;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
  w.step(28);
  return { w, target };
}
test('simulation captures a lethal R result, never promotes a later death, and rejects foreign pending kill flags', () => {
  for (const lethal of [false, true]) {
    const { w, target } = world(lethal);
    expect(w.player.garenRVisual?.killed).toBe(lethal);
    if (!lethal) w.damage(w.hero, target, 1e6, 'true');
    expect(w.player.garenRVisual?.killed).toBe(lethal);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    expect(restored.player.garenRVisual?.killed).toBe(lethal);
  }
  const { w } = world(false);
  const s = JSON.parse(w.snapshot());
  s.player.garenRVisual.releaseTick = null;
  s.player.garenRVisual.stopTick = s.tick;
  s.player.garenRVisual.killed = true;
  expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  delete s.player.garenRVisual.killed;
  expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
});
test('R history retains the entire stereo kill tail after particles end and restores its original phase', () => {
  const { w } = world(true),
    release = w.player.garenRVisual!.releaseTick!;
  w.step(240);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  const states = (x: World) =>
    garenRAudioStates(
      [
        {
          ...x.player.garenRVisual!,
          id: x.hero.id,
          x: x.hero.x,
          y: x.hero.y,
          castVisible: true,
          impactVisible: true,
        },
      ],
      x.tick
    );
  expect(states(w)).toEqual(states(restored));
  expect(states(w).find((s) => s.kind === 'kill')?.age).toBe(4);
  expect(GAREN_R_PRESENTATION_TAIL_TICKS).toBe(303);
  expect(GAREN_R_PRESENTATION_TAIL_TICKS / 60).toBeGreaterThan(P.kill.maxDurationSeconds);
  w.step(release + GAREN_R_PRESENTATION_TAIL_TICKS - w.tick);
  restored.step(release + GAREN_R_PRESENTATION_TAIL_TICKS - restored.tick);
  expect(w.player.garenRVisual).toBeNull();
  expect(restored.snapshot()).toBe(w.snapshot());
});
class Node {
  buffer: any;
  onended: (() => void) | null = null;
  loop = false;
  starts: number[][] = [];
  stops = 0;
  disconnects = 0;
  gain = {
    value: 0,
    targets: [] as number[][],
    setTargetAtTime(v: number, t: number, c: number) {
      this.targets.push([v, t, c]);
      return this;
    },
  };
  connect(n: any) {
    return n;
  }
  disconnect() {
    this.disconnects++;
  }
  stop() {
    this.stops++;
  }
  start(t: number, age: number) {
    this.starts.push([t, age]);
  }
}
function audio() {
  const nodes: Node[] = [],
    gains: Node[] = [],
    context = {
      state: 'running',
      currentTime: 10,
      destination: {},
      createBufferSource() {
        const n = new Node();
        nodes.push(n);
        return n;
      },
      createGain() {
        const n = new Node();
        gains.push(n);
        return n;
      },
    };
  const a = new GarenJusticeAudio();
  a.status = 'ready';
  (a as any).buffers = Object.fromEntries(
    kinds.map((k) => [
      k,
      P[k].variants.map((v) => ({ duration: v.durationSeconds, channels: v.channels })),
    ])
  );
  return { a, context: context as unknown as AudioContext, nodes, gains };
}
test('R controller seeks each phase once, preserves stereo, changes camera gain and releases all owned nodes', () => {
  const { a, context, nodes, gains } = audio();
  a.update(context, true, [record], 57, record);
  a.update(context, true, [record], 57, record);
  expect(nodes).toHaveLength(3);
  expect(nodes.map((n) => n.starts[0][1])).toEqual([0.95, 0.5, 0.5]);
  expect(nodes.map((n) => n.buffer.channels)).toEqual([1, 1, 2]);
  expect(nodes.every((n) => !n.loop)).toBe(true);
  a.update(context, true, [record], 57, { x: 4000, y: 0 });
  for (const g of gains)
    expect(g.gain.targets.at(-1)![0]).toBeCloseTo(g.gain.value * 10 ** (-96.3 / 20), 12);
  a.stop();
  expect(nodes.every((n) => n.stops === 1 && n.disconnects === 1)).toBe(true);
  expect(gains.every((n) => n.disconnects === 1)).toBe(true);
});
test('source caps steal oldest peers without recreation, and natural completion never replays a live key', () => {
  const { a, context, nodes } = audio();
  const records = Array.from({ length: 6 }, (_, i) => ({ ...record, id: i + 1 }));
  a.update(context, true, records, 28, record);
  const voices = [...(a as any).voices.values()];
  expect(kinds.map((k) => voices.filter((v: any) => v.kind === k).length)).toEqual([2, 2, 4]);
  const created = nodes.length;
  a.update(context, true, records, 29, record);
  expect(nodes).toHaveLength(created);
  const live = [...(a as any).voices.values()][0] as any;
  live.source.onended();
  a.update(context, true, records, 30, record);
  expect(nodes).toHaveLength(created);
  a.stop();
  expect((a as any).voices.size).toBe(0);
});
test('a synthesized loading fallback suppresses only that cast while the released hit and kill still use source audio', () => {
  const { a, context, nodes } = audio();
  a.suppressCast(record.id, record.startTick);
  a.update(context, true, [record], 57, record);
  expect(nodes).toHaveLength(2);
  expect([...(a as any).voices.values()].map((v: any) => v.kind)).toEqual(['hit', 'kill']);
  a.update(context, true, [], 400, record);
  expect((a as any).fallbackCasts.size).toBe(0);
});
test('visibility changes independently retire cast/impact nodes and mute permits a seek without replaying completed phases', () => {
  const { a, context, nodes } = audio();
  a.update(context, true, [record], 57, record);
  a.update(context, true, [{ ...record, castVisible: false }], 58, record);
  expect(nodes[0].stops).toBe(1);
  expect((a as any).voices.size).toBe(2);
  a.stop();
  a.update(context, true, [record], 100, record);
  expect(nodes.slice(-3).map((n) => n.starts[0][1])).toEqual([100 / 60, 73 / 60, 73 / 60]);
  a.update(context, true, [{ ...record, castVisible: false, impactVisible: false }], 101, record);
  expect((a as any).voices.size).toBe(0);
});
