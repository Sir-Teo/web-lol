import type { Unit } from '../src/simulation/types';
import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { garenAttackAnimation } from '../src/content/garen-attack-animation';
import { attackSoundMaterial } from '../src/content/attack-sound-material';
import { garenAttackExpiry } from '../src/simulation/garen-aa-presentation';
import { mobilePose } from '../src/render/mobile-pose';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { GAREN_AA_AUDIO as P } from '../src/content/garen-aa-audio';
import { garenAAAudioStates, type GarenAAAudioRecord } from '../src/audio/garen-aa-state';
import { GarenBasicAttackAudio } from '../src/audio/garen-aa';
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
function setup() {
  const w = new World(
    false,
    { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true },
    'garen'
  );
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const target = w.spawn('dummy', 'red', { x: 90, y: 0 });
  target.hp = target.maxHp = 1e6;
  return { w, u: w.hero, target };
}
function start(f: ReturnType<typeof setup>) {
  f.w.setOrder(f.u, { type: 'attack', target: f.target.id });
  f.w.step();
  return f.w.player.garenAAVisuals.at(-1)!;
}
const record: GarenAAAudioRecord = {
  id: 1,
  startTick: 0,
  releaseTick: 1,
  endTick: 60,
  kind: 'crit',
  targetId: 2,
  targetTeam: 'red',
  targetRig: 'sru-red-base',
  origin: { x: 0, y: 0 },
  castAudience: ['blue'],
  cancelTick: null,
  impact: { tick: 1, point: { x: 90, y: 0 }, material: 'Wood', audience: ['blue', 'red'] },
  x: 0,
  y: 0,
  castVisible: true,
  hitVisible: true,
};
test('all eight source play actions retain seventeen routed profiles, thirty-four exact masters and all four material hashes', () => {
  const graph = JSON.parse(readFileSync('docs/reference/garen-aa-audio.json', 'utf8')),
    decoded = JSON.parse(readFileSync('docs/reference/garen-aa-audio-decoded.json', 'utf8')),
    reading = JSON.parse(readFileSync('docs/reference/garen-aa-source-reading.json', 'utf8'));
  expect(graph.events).toHaveLength(6);
  expect(graph.events.flatMap((e: any) => e.actions)).toHaveLength(8);
  expect(graph.nodes).toHaveLength(105);
  expect(graph.media).toHaveLength(34);
  expect(graph.unresolvedHierarchyIds).toEqual([211064428]);
  expect(P).toHaveLength(17);
  expect(decoded.sourceGraphSha256).toBe(hash('docs/reference/garen-aa-audio.json'));
  expect(reading.normalWeights).toEqual([0.5, 0.5]);
  expect(reading.materialValueHashes).toEqual({
    Flesh: 1153642577,
    Metal: 2473969246,
    Stone: 1216965916,
    Wood: 2058049674,
  });
  for (const r of reading.skinMaterials) {
    expect(hash(r.path)).toBe(r.sha256);
    let data = JSON.parse(readFileSync(r.path, 'utf8'));
    for (const key of r.recordPath) data = data[key];
    expect(data.armorMaterial).toBe(r.material);
  }
  const clips = new Map(P.flatMap((p) => p.variants.map((v) => [v.id, v] as const)));
  expect(clips.size).toBe(34);
  for (const c of clips.values()) {
    expect(hash('public/' + c.url)).toBe(c.sha256);
    const m = decoded.media.find((m: any) => m.id === c.id);
    expect(m.frames).toBe(c.frames);
    expect(m.pcmSha256).toBe(c.pcmSha256);
    expect(m.decoderMetadata.loopingInfo).toBeNull();
    expect(hash(`.cache/garen-aa-audio-media/${c.id}.wem`)).toBe(m.encodedSha256);
  }
  expect(P.filter((p) => p.pitchCents !== 0).map((p) => p.pitchCents)).toEqual([-500, -100]);
});
test('ordinary selection follows both equal source slots and consumes no RNG or extra gameplay IDs', () => {
  expect(new Set(Array.from({ length: 64 }, (_, i) => garenAttackAnimation(1, i)))).toEqual(
    new Set(['attack1', 'attack2'])
  );
  const f = setup(),
    rng = f.w.random.state,
    id = f.w.nextId,
    r = start(f);
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id);
  expect(r.kind).toBe(garenAttackAnimation(f.u.id, r.startTick));
  const pose = mobilePose(f.u, f.w.player, f.w.tick, 1, MOBILE_CLIP_DURATIONS['garen-base']);
  expect(pose.clip).toBe(r.kind);
  f.w.step(r.releaseTick - f.w.tick);
  expect(r.impact?.tick).toBe(r.releaseTick);
  expect(f.w.nextId - id).toBe(2);
  expect(f.w.random.state).toBe(rng);
  expect(f.target.hp).toBe(1e6 - f.u.damage);
  expect(r.impact?.material).toBe('Flesh');
  f.w.setOrder(f.u, { type: 'idle' });
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.step(150);
  copy.step(150);
  expect(f.w.snapshot()).toBe(copy.snapshot());
  expect(f.w.player.garenAAVisuals).toEqual([]);
});
test('accepted siege, monster and champion contacts resolve pinned Stone/Metal/Wood/Flesh skins, not one generic hit', () => {
  for (const material of ['Flesh', 'Metal', 'Stone', 'Wood']) {
    const f = setup();
    let u = f.u;
    let target: Unit = f.target;
    if (material === 'Metal') target = f.w.spawn('siege', 'red', { x: 90, y: 0 });
    if (material === 'Stone') {
      u = f.w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
      u.ai = false;
      f.u.x = f.u.y = -3000;
      target = f.w.spawn('siege', 'blue', { x: 90, y: 0 });
    }
    if (material === 'Wood') target = f.w.spawnMonster({ x: 90, y: 0 }, null, 'red');
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    expect(attackSoundMaterial(target)).toBe(material);
    f.w.setOrder(u, { type: 'attack', target: target.id });
    f.w.step();
    const r = f.w.championState(u.id)!.garenAAVisuals[0];
    f.w.step(r.releaseTick - f.w.tick);
    expect(r.impact?.material).toBe(material);
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  }
});
test('cancellation, target loss, death and terminal victory retain casts without forging a hit', () => {
  for (const mode of ['order', 'target-loss', 'death', 'winner']) {
    const f = setup(),
      r = start(f);
    if (mode === 'order') f.w.setOrder(f.u, { type: 'idle' });
    if (mode === 'target-loss') {
      f.target.hp = 0;
      f.target.deadAt = f.w.tick;
      f.w.step();
    }
    if (mode === 'death') f.w.damage(f.target, f.u, 1e6, 'true');
    if (mode === 'winner') {
      const nexus = f.w.spawn('nexus', 'blue', { x: 1000, y: 1000 });
      f.w.damage(f.target, nexus, 1e6, 'true');
    }
    expect(r.cancelTick).not.toBeNull();
    expect(r.impact).toBeNull();
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
    const states = garenAAAudioStates(
      [{ ...r, id: f.u.id, x: 0, y: 0, castVisible: true, hitVisible: true }],
      f.w.tick
    );
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((s) => P[s.profileIndex].phase === 'cast')).toBe(true);
  }
  const f = setup();
  f.w.learnSpell('q');
  f.w.enqueue({ type: 'cast', unit: f.u.id, ability: 'q', point: f.u });
  f.w.step();
  start(f);
  expect(f.w.player.garenAAVisuals).toEqual([]);
  expect(f.w.player.garenQVisuals.at(-1)?.attacks.length).toBe(1);
});
test('strict continuation rejects crossed kind/rig/audience/material/contact clocks and missing active swings', () => {
  const f = setup(),
    r = start(f);
  f.w.step(r.releaseTick - f.w.tick);
  const good = JSON.parse(f.w.snapshot());
  const mutations = [
    (_s: any, r: any) => r.startTick++,
    (_s: any, r: any) => r.releaseTick++,
    (_s: any, r: any) => (r.endTick = 0),
    (_s: any, r: any) => (r.kind = r.kind === 'attack1' ? 'attack2' : 'attack1'),
    (_s: any, r: any) => (r.targetTeam = 'blue'),
    (_s: any, r: any) => (r.targetRig = 'red-siege'),
    (_s: any, r: any) => (r.castAudience = ['red']),
    (_s: any, r: any) => (r.impact.material = 'Wood'),
    (_s: any, r: any) => (r.impact.audience = ['red']),
    (_s: any, r: any) => r.impact.tick++,
    (_s: any, r: any) => (r.cancelTick = r.startTick),
    (s: any, r: any) => s.player.garenAAVisuals.push({ ...r }),
    (s: any) => (s.player.garenAAVisuals = []),
    (s: any) => (s.version = 112),
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(good);
    mutate(bad, bad.player.garenAAVisuals[0]);
    expect(() => World.fromSnapshot(JSON.stringify(bad), f.w.battlefield)).toThrow();
  }
  const pending = setup();
  start(pending);
  const broken = JSON.parse(pending.w.snapshot());
  broken.player.garenAAVisuals = [];
  expect(() => World.fromSnapshot(JSON.stringify(broken), pending.w.battlefield)).toThrow(
    /presentation/
  );
  f.w.setOrder(f.u, { type: 'idle' });
  f.w.step(garenAttackExpiry(r) - f.w.tick);
  expect(f.w.player.garenAAVisuals).toEqual([]);
  const expired = JSON.parse(f.w.snapshot());
  expired.player.garenAAVisuals = [r];
  expect(() => World.fromSnapshot(JSON.stringify(expired), f.w.battlefield)).toThrow();
});
test('critical layers use independent material branches and pitch-adjusted offsets/duration, with privacy per phase', () => {
  const states = garenAAAudioStates([record], 1);
  expect(states).toHaveLength(4);
  expect(states.filter((s) => P[s.profileIndex].phase === 'hit')).toHaveLength(2);
  expect(
    states.filter((s) => P[s.profileIndex].material !== null).map((s) => P[s.profileIndex].material)
  ).toEqual(['Wood']);
  const slowed = states.find((s) => P[s.profileIndex].pitchCents === -500)!;
  expect(slowed.offset).toBeCloseTo((1 / 60) * 2 ** (-500 / 1200));
  const hidden = garenAAAudioStates([{ ...record, castVisible: false }], 1);
  expect(hidden).toHaveLength(2);
  expect(hidden.every((s) => P[s.profileIndex].phase === 'hit')).toBe(true);
  expect(
    garenAAAudioStates([{ ...record, impact: null }], 1).every(
      (s) => P[s.profileIndex].phase === 'cast'
    )
  ).toBe(true);
  expect(garenAAAudioStates([record], 1e6)).toEqual([]);
});
class Param {
  value = 0;
  setTargetAtTime(v: number) {
    this.value = v;
  }
}
class Node {
  gain = new Param();
  playbackRate = { value: 1 };
  loop = false;
  buffer: any;
  onended: (() => void) | null = null;
  starts: number[][] = [];
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
  stop() {
    if (!this.starts.length) throw Error('stop before start');
  }
}
function audio() {
  const nodes: Node[] = [],
    a = new GarenBasicAttackAudio(),
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
  a.status = 'ready';
  (a as any).buffers = new Map(
    P.flatMap((p) => p.variants.map((v) => [v.id, { id: v.id, duration: v.durationSeconds }]))
  );
  return { a, nodes, context: context as unknown as AudioContext };
}
test('container caps, pitch and fallback suppression preserve complete critical actions without repeated finite tails', () => {
  const { a, nodes, context } = audio();
  a.update(context, true, [record], 1, record);
  expect(nodes).toHaveLength(4);
  expect(nodes.filter((n) => n.playbackRate.value !== 1).map((n) => n.playbackRate.value)).toEqual([
    2 ** (-500 / 1200),
    2 ** (-100 / 1200),
  ]);
  const voices = [...(a as any).voices.values()];
  for (const v of voices) v.source.onended();
  a.update(context, true, [record], 1, record);
  expect(nodes).toHaveLength(4);
  a.update(context, true, [], 2, record);
  expect((a as any).finished.size).toBe(0);
  const f = audio(),
    records = Array.from({ length: 6 }, (_, i) => ({
      ...record,
      id: i + 1,
      kind: 'attack1' as const,
    }));
  f.a.update(f.context, true, records, 1, record);
  expect((f.a as any).voices.size).toBe(6);
  f.a.stop();
  expect(f.nodes.every((n) => n.disconnected === 1)).toBe(true);
  const c = audio();
  c.a.suppressSwing(1, 0);
  c.a.update(c.context, true, [record], 1, record);
  expect(c.nodes).toHaveLength(0);
});
test('duplicate material media load once and explicit failure retry requests only the failed master', async () => {
  const a = new GarenBasicAttackAudio(),
    urls: string[] = [];
  let fail = true;
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      async decodeAudioData() {
        return {};
      }
    }
  );
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    const failed = fail && url.endsWith('1246050.wav');
    return { ok: !failed, status: 404, arrayBuffer: async () => new ArrayBuffer(1) };
  });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const first = a.load();
    expect(a.load()).toBe(first);
    await first;
    expect(a.status).toBe('failed');
    expect(urls).toHaveLength(34);
    for (let i = 0; i < 30; i++) a.update(null, true, [record], 1, record);
    expect(urls).toHaveLength(34);
    fail = false;
    await a.load();
    expect(a.status).toBe('ready');
    expect(urls).toHaveLength(35);
    expect(new Set(urls).size).toBe(34);
  } finally {
    vi.unstubAllGlobals();
    warn.mockRestore();
  }
});
