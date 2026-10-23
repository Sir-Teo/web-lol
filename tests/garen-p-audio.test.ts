import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GAREN_P_AUDIO as P } from '../src/content/garen-p-audio';
import { garenPAudioStates, type GarenPAudioRecord } from '../src/audio/garen-p-state';
import { GarenPerseveranceAudio } from '../src/audio/garen-p';
import { GameAudio } from '../src/audio/audio';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { perseveranceVisualExpiry } from '../src/simulation/garen-passive-visuals';
const kinds = ['onset', 'active'] as const,
  hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const record: GarenPAudioRecord = {
  id: 1,
  startTick: 0,
  stopTick: null,
  point: null,
  x: 0,
  y: 0,
  visible: true,
};
test('recovery sound retains exact bank/media masters, distinct attenuation, play transitions and the reader-derived whole-file loop', () => {
  const graphRaw = readFileSync('docs/reference/garen-p-audio.json'),
    graph = JSON.parse(graphRaw.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/garen-p-audio-decoded.json', 'utf8')),
    reading = JSON.parse(readFileSync('docs/reference/garen-p-audio-reading.json', 'utf8'));
  expect(decoded.sourceGraphSha256).toBe(hash(graphRaw));
  expect(graph.events).toHaveLength(3);
  expect(graph.media).toHaveLength(2);
  expect(graph.nodes).toHaveLength(14);
  expect(graph.unresolvedHierarchyIds).toEqual([1259461568]);
  expect(hash(readFileSync(reading.path))).toBe(reading.sha256);
  expect(
    kinds.map((k) => [
      P[k].gainDb,
      P[k].clip.frames,
      P[k].attenuation.id,
      P[k].policy.u16MaxNumInstance,
    ])
  ).toEqual([
    [-18, 220494, 339248780, 4],
    [-40, 165832, 947191947, 4],
  ]);
  expect(P.active.clip.loop).toEqual({ start: 0, end: 165832 });
  expect(P.onset.clip.loop).toBeNull();
  expect(P.active.fadeInSeconds).toBe(0.5);
  expect(P.active.stop.fadeSeconds).toBe(1);
  for (const k of kinds) {
    const clip = P[k].clip,
      raw = readFileSync('public/' + clip.url),
      m = decoded.media.find((m: any) => m.id === clip.id);
    expect(hash(raw)).toBe(clip.sha256);
    expect(m.decoderMetadata.loopingInfo).toBeNull();
    expect(m.pcmSha256).toBe(clip.pcmSha256);
    expect(m.frames).toBe(clip.frames);
    expect(m.sampleRate).toBe(44100);
    expect(m.channels).toBe(1);
    const encoded = readFileSync(`.cache/garen-p-audio-media/${clip.id}.wem`);
    expect(hash(encoded)).toBe(m.encodedSha256);
  }
  expect(P.onset.clip.peak).toBeGreaterThan(1);
});
test('partial fade-in stops at the original reached level and seeks the full-file loop without replaying onset', () => {
  expect(garenPAudioStates([record], NaN)).toEqual([]);
  expect(garenPAudioStates([record], -1)).toEqual([]);
  expect(garenPAudioStates([{ ...record, visible: false }], 1)).toEqual([]);
  const starting = garenPAudioStates([record], 15).find((s) => s.kind === 'active')!;
  expect(starting.envelope).toBe(0.5);
  expect(starting.remainingIn).toBe(0.25);
  const stopped = { ...record, stopTick: 15, point: { x: 0, y: 0 } },
    fading = garenPAudioStates([stopped], 30).find((s) => s.kind === 'active')!;
  expect(fading.envelope).toBe(0.375);
  expect(fading.remainingIn).toBe(0);
  expect(fading.remainingOut).toBe(0.75);
  expect(garenPAudioStates([stopped], 75).map((s) => s.kind)).toEqual(['onset']);
  expect(garenPAudioStates([stopped], 300)).toEqual([]);
  const late = garenPAudioStates([record], 600);
  expect(late).toHaveLength(1);
  expect(late[0].kind).toBe('active');
  expect(late[0].offset).toBeCloseTo(10 % P.active.clip.durationSeconds);
  expect(late[0].envelope).toBe(1);
});
test('an immediately stopped recovery retains onset through its final sample and rejects truncated/expired save history', () => {
  const w = new World(
    false,
    { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true },
    'garen'
  );
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.hero.hp -= 100;
  w.step();
  w.hero.hp = w.hero.maxHp;
  w.step();
  const r = w.player.garenPassiveVisuals[0];
  expect(r).toEqual({ startTick: 1, stopTick: 2, point: { x: 0, y: 0 } });
  expect(perseveranceVisualExpiry(r)).toBe(301);
  w.step(185);
  expect(w.player.garenPassiveVisuals).toHaveLength(1);
  expect(
    garenPAudioStates([{ ...r, id: w.hero.id, x: 0, y: 0, visible: true }], w.tick).map(
      (s) => s.kind
    )
  ).toEqual(['onset']);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(113);
  copy.step(113);
  expect(w.tick).toBe(300);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.player.garenPassiveVisuals).toHaveLength(1);
  w.step();
  expect(w.player.garenPassiveVisuals).toEqual([]);
  const bad = JSON.parse(w.snapshot());
  bad.player.garenPassiveVisuals = [r];
  expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow(/Perseverance/);
});
class Param {
  value = 0;
  sets: number[][] = [];
  ramps: number[][] = [];
  targets: number[][] = [];
  cancelScheduledValues() {}
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
    if (!this.starts.length) throw new Error('stop before start');
    this.stops.push(t);
  }
}
function audio() {
  const nodes: Node[] = [],
    a = new GarenPerseveranceAudio(),
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
  (a as any).buffers = Object.fromEntries(
    kinds.map((k) => [k, { duration: P[k].clip.durationSeconds, id: P[k].clip.id }])
  );
  return { a, context: context as unknown as AudioContext, nodes };
}
test('controller keeps source fade ramps independent of moving-listener gain, resumes partial fades and releases ownership', () => {
  const { a, context, nodes } = audio();
  a.update(context, true, [record], 15, record);
  a.update(context, true, [record], 15, record);
  expect(nodes).toHaveLength(2);
  const active = [...(a as any).voices.values()].find((v) => v.kind === 'active');
  expect(active.source.loop).toBe(true);
  expect(active.source.loopStart).toBe(0);
  expect(active.source.loopEnd).toBe(P.active.clip.durationSeconds);
  expect(active.envelope.gain.ramps).toEqual([[1, 10.25]]);
  const stopped = { ...record, stopTick: 15, point: { x: 0, y: 0 } };
  a.update(context, true, [stopped], 30, { x: 1515, y: 0 });
  expect(active.envelope.gain.sets.at(-1)).toEqual([0.375, 10]);
  expect(active.envelope.gain.ramps.at(-1)).toEqual([0, 10.75]);
  expect(active.source.stops).toEqual([10.75]);
  expect(active.spatial.gain.targets.at(-1)[0]).toBeCloseTo(0.001);
  a.update(context, true, [stopped], 31, { x: 1600, y: 0 });
  expect(active.source.stops).toEqual([10.75]);
  a.stop();
  expect(nodes.every((n) => n.disconnected === 1)).toBe(true);
  a.update(context, true, [stopped], 45, record);
  const resumed = [...(a as any).voices.values()].find((v) => v.kind === 'active');
  expect(resumed.envelope.gain.sets.at(-1)[0]).toBe(0.25);
  expect(resumed.source.starts[0][1]).toBe(0.75);
  expect(resumed.source.stops).toEqual([10.5]);
});
test('four-per-action caps retire the oldest and finished voices cannot restart under frozen or hidden histories', () => {
  const { a, context, nodes } = audio(),
    records = Array.from({ length: 6 }, (_, i) => ({ ...record, id: i + 1 }));
  a.update(context, true, records, 1, record);
  expect((a as any).voices.size).toBe(8);
  const current = [...(a as any).voices.values()];
  for (const v of current) v.source.onended();
  const count = nodes.length;
  a.update(context, true, records, 1, record);
  a.update(
    context,
    true,
    records.map((r) => ({ ...r, visible: false })),
    1,
    record
  );
  a.update(context, true, records, 1, record);
  expect(nodes).toHaveLength(count);
  a.update(context, true, [], 2, record);
  expect((a as any).finished.size).toBe(0);
});
test('passive terminal clock drains after victory and never alters the frozen saved world', () => {
  const { a, context, nodes } = audio(),
    game = new GameAudio(),
    w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.hero.hp -= 100;
  w.step(100);
  (game as any).garenP.controller = a;
  for (const k of ['garenAA', 'garenQ', 'garenW', 'garenE', 'garenR'])
    (game as any)[k] = { status: 'ready', update() {}, stop() {} };
  game.context = context;
  const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  w.damage(w.hero, nexus, 1e6, 'true');
  const saved = w.snapshot();
  game.updateGaren(w);
  expect(nodes).toHaveLength(2);
  Object.defineProperty(context, 'currentTime', { value: 20, writable: true });
  game.updateGaren(w);
  expect((a as any).voices.size).toBe(0);
  game.enabled = false;
  game.enabled = true;
  game.updateGaren(w);
  expect(nodes).toHaveLength(2);
  expect(w.snapshot()).toBe(saved);
});
test('missing audio stays bounded and an explicit retry reuses the successful decoded master', async () => {
  const a = new GarenPerseveranceAudio();
  let requests = 0;
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      async decodeAudioData() {
        return {};
      }
    }
  );
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    requests++;
    urls.push(url);
    return {
      ok: !url.endsWith('433054605.wav') || requests > 2,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(1),
    };
  });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const first = a.load();
    expect(a.load()).toBe(first);
    await first;
    expect(a.status).toBe('failed');
    for (let i = 0; i < 20; i++) a.update(null, true, [record], 1, record);
    expect(requests).toBe(2);
    await a.load();
    expect(a.status).toBe('ready');
    expect(requests).toBe(3);
    expect(urls.filter((u) => u.endsWith('111098527.wav'))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith('433054605.wav'))).toHaveLength(2);
    expect(warning).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
    warning.mockRestore();
  }
});
