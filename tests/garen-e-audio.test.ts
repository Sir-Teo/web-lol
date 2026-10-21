import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GAREN_E_AUDIO as P } from '../src/content/garen-e-audio';
import {
  garenEAudioStates,
  garenEVariant,
  type GarenEAudioRecord,
} from '../src/audio/garen-e-state';
import { GarenJudgmentAudio } from '../src/audio/garen-e';
import { GAREN_E_PRESENTATION_TAIL_TICKS } from '../src/simulation/garen-e';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

const record: GarenEAudioRecord = { id: 2, startTick: 0, stopTick: null, deadAt: null, x: 0, y: 0 };
const kinds = ['cast', 'active', 'end', 'hit'] as const;
test('Judgment recordings retain exact float masters, source graph and four separate event containers', () => {
  const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  const graphBytes = readFileSync('docs/reference/garen-e-audio.json'),
    graph = JSON.parse(graphBytes.toString());
  const decoded = JSON.parse(readFileSync('docs/reference/garen-e-audio-decoded.json', 'utf8'));
  expect(decoded.sourceGraphSha256).toBe(hash(graphBytes));
  expect(graph.extractionSha256).toBe(
    hash(readFileSync('docs/reference/garen-audio-extraction.json'))
  );
  expect(graph.referenceSha256).toBe(hash(readFileSync('docs/reference/garen-model.json')));
  expect(graph.events).toHaveLength(6);
  expect(kinds.map((k) => P[k].variants.length)).toEqual([3, 3, 3, 4]);
  expect(kinds.map((k) => P[k].gainDb)).toEqual([-14, -12, -19, -19]);
  expect(kinds.map((k) => P[k].policy.u16MaxNumInstance)).toEqual([2, 4, 4, 2]);
  for (const kind of kinds)
    for (const v of P[kind].variants) {
      const bytes = readFileSync(`public/${v.url}`),
        source = decoded.media.find((m: any) => m.id === v.id);
      expect(hash(bytes)).toBe(v.sha256);
      expect(v.sha256).toBe(source.wavSha256);
      expect(v.peak).toBeGreaterThan(1);
      let pcm: Buffer | undefined;
      for (let offset = 12; offset < bytes.length;) {
        const size = bytes.readUInt32LE(offset + 4),
          tag = bytes.toString('ascii', offset, offset + 4);
        if (tag === 'fmt ') {
          expect(bytes.readUInt16LE(offset + 8)).toBe(3);
          expect(bytes.readUInt16LE(offset + 22)).toBe(32);
        }
        if (tag === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + (size % 2);
      }
      expect(hash(pcm!)).toBe(v.pcmSha256);
      expect(pcm!.length).toBe(v.frames * 4);
      expect(source.decoderMetadata.loopingInfo).toBeNull();
    }
});
test('source cast and active phases play once, preserve indexed variants and resume at saved age', () => {
  const states = garenEAudioStates([record], 90);
  expect(states.map((s) => s.kind)).toEqual(['cast', 'active']);
  expect(states.every((s) => s.age === 1.5 && s.fade === 1 && s.remainingFade === null)).toBe(true);
  garenEAudioStates([record], 300);
  expect(garenEAudioStates([record], 90)).toEqual(states);
  for (const kind of kinds)
    expect(new Set(Array.from({ length: 100 }, (_, id) => garenEVariant(id, 200, kind))).size).toBe(
      P[kind].variants.length
    );
  expect(garenEAudioStates([record], 300)).toEqual([]);
});
test('stop actions retain 800ms active fade and a distinct 125ms ending fade after later death', () => {
  const stopped = { ...record, stopTick: 100 };
  const active = garenEAudioStates([stopped], 124).find((s) => s.kind === 'active')!;
  expect(active.fade).toBeCloseTo(0.5);
  expect(active.remainingFade).toBeCloseTo(0.4);
  expect(garenEAudioStates([stopped], 124).find((s) => s.kind === 'end')!.age).toBe(0.4);
  expect(garenEAudioStates([stopped], 148).some((s) => s.kind === 'active')).toBe(false);
  expect(garenEAudioStates([{ ...stopped, deadAt: 100 }], 100).some((s) => s.kind === 'end')).toBe(
    false
  );
  const dying = garenEAudioStates([{ ...stopped, deadAt: 110 }], 115).find(
    (s) => s.kind === 'end'
  )!;
  expect(dying.fade).toBeCloseTo(1 / 3);
  expect(dying.remainingFade).toBeCloseTo(1 / 24);
  expect(garenEAudioStates([{ ...stopped, deadAt: 110 }], 118).some((s) => s.kind === 'end')).toBe(
    false
  );
});
function world() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => true }, 'garen');
  w.nextWaveTick = Infinity;
  w.pendingSpawns = [];
  w.hero.x = w.hero.y = 0;
  w.learnSpell('e');
  return w;
}
test('contact cues fire once per eligible recipient and do not include structures or remote targets', () => {
  const w = world();
  const targets = [100, 200, 1000].map((x) => w.spawn('dummy', 'red', { x, y: 0 }));
  targets.forEach((t) => {
    t.hp = t.maxHp = 10000;
  });
  w.spawn('turret', 'red', { x: 100, y: 0 });
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
  w.step(27);
  const contacts = w.events.filter((e) => e.type === 'judgment-hit');
  expect(contacts.map((e) => e.unit)).toEqual(targets.slice(0, 2).map((t) => t.id));
  expect(
    contacts.every(
      (e) => e.champion === 'garen' && e.audience.includes('blue') && e.audience.includes('red')
    )
  ).toBe(true);
});
test('active and stopped checkpoint continuation covers sound tails after particles end', () => {
  const w = world();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
  w.step(80);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  const states = (x: World) =>
    garenEAudioStates(
      [
        {
          id: x.hero.id,
          x: x.hero.x,
          y: x.hero.y,
          deadAt: x.hero.deadAt,
          ...x.player.garenEVisual!,
        },
      ],
      x.tick
    );
  for (const x of [w, restored]) {
    x.enqueue({ type: 'cast', unit: x.hero.id, ability: 'e', point: x.hero });
    x.step();
  }
  expect(states(w)).toEqual(states(restored));
  w.step(60);
  restored.step(60);
  expect(w.player.garenEVisual).not.toBeNull();
  expect(states(w).some((s) => s.kind === 'end')).toBe(true);
  expect(states(w)).toEqual(states(restored));
  w.step(GAREN_E_PRESENTATION_TAIL_TICKS - 60);
  restored.step(GAREN_E_PRESENTATION_TAIL_TICKS - 60);
  expect(w.player.garenEVisual).toBeNull();
  expect(restored.snapshot()).toBe(w.snapshot());
});

class Param {
  value = 0;
  ramps: number[][] = [];
  sets: number[][] = [];
  targets: number[][] = [];
  cancelScheduledValues() {
    return this;
  }
  setValueAtTime(v: number, t: number) {
    this.value = v;
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
  onended: (() => void) | null = null;
  buffer: any;
  loop = false;
  starts: number[][] = [];
  stops = 0;
  disconnected = 0;
  connect(n: any) {
    return n;
  }
  disconnect() {
    this.disconnected++;
  }
  start(t: number, age: number) {
    this.starts.push([t, age]);
  }
  stop() {
    this.stops++;
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
  const a = new GarenJudgmentAudio();
  a.status = 'ready';
  (a as any).buffers = Object.fromEntries(
    kinds.map((k) => [k, P[k].variants.map((v) => ({ duration: v.durationSeconds, id: v.id }))])
  );
  return { a, context: context as unknown as AudioContext, nodes };
}
test('controller owns each node, seeks saved phase once and separates camera gain from stop fades', () => {
  const { a, context, nodes } = audio();
  a.update(context, true, [record], 90, record);
  a.update(context, true, [record], 90, record);
  expect(nodes).toHaveLength(2);
  expect(nodes.every((n) => n.starts[0][1] === 1.5 && !n.loop)).toBe(true);
  a.update(context, true, [{ ...record, stopTick: 100 }], 124, record);
  const active = [...(a as any).voices.values()].find((v: any) => v.kind === 'active');
  expect(active.envelope.gain.sets.at(-1)[0]).toBeCloseTo(0.5);
  expect(active.envelope.gain.ramps.at(-1)[1]).toBeCloseTo(10.4);
  const ramps = active.envelope.gain.ramps.length;
  a.update(context, true, [{ ...record, stopTick: 100 }], 124, { x: 4000, y: 0 });
  expect(active.envelope.gain.ramps).toHaveLength(ramps);
  a.stop();
  expect((a as any).voices.size).toBe(0);
  expect(nodes.every((n) => n.stops === 1 && n.disconnected === 1)).toBe(true);
});
test('global source caps kill oldest peers without recreating stolen voices on subsequent frames', () => {
  const { a, context, nodes } = audio(),
    records = Array.from({ length: 6 }, (_, id) => ({ ...record, id: id + 1 }));
  a.update(context, true, records, 1, record);
  const voices = [...(a as any).voices.values()];
  expect(voices.filter((v: any) => v.kind === 'cast')).toHaveLength(2);
  expect(voices.filter((v: any) => v.kind === 'active')).toHaveLength(4);
  const created = nodes.length;
  a.update(context, true, records, 2, record);
  expect(nodes).toHaveLength(created);
  a.update(context, true, [], 3, record);
  expect((a as any).voices.size).toBe(0);
});
test('hit playback deduplicates live event identity, skips expired cues and applies its separate two-voice cap', () => {
  const { a, context, nodes } = audio();
  const event = {
    id: 100,
    tick: 1,
    type: 'judgment-hit' as const,
    x: 0,
    y: 0,
    audience: ['blue' as const],
  };
  a.hit(context, event, 10, record);
  a.hit(context, event, 10, record);
  expect(nodes).toHaveLength(1);
  a.hit(context, { ...event, id: 101 }, 10, record);
  a.hit(context, { ...event, id: 102 }, 10, record);
  expect((a as any).voices.size).toBe(2);
  expect(nodes[0].stops).toBe(1);
  a.hit(context, { ...event, id: 103 }, 200, record);
  expect(nodes).toHaveLength(3);
  a.stop();
  expect(nodes.every((n) => n.stops === 1 && n.disconnected === 1)).toBe(true);
});
