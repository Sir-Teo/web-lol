import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MASTER_YI_AA_AUDIO as P } from '../src/content/masteryi-aa-audio';
import { masterYiAAStates, type MasterYiAARecord } from '../src/audio/masteryi-aa-state';
import { MasterYiAttackAudio } from '../src/audio/masteryi-aa';
import { floatSourceChannels, verifySourceWave } from '../src/audio/float-source-wav';
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const raw = (path: string) => {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const record = (kind: 'attack1' | 'crit' = 'attack1'): MasterYiAARecord => ({
  id: 7,
  trailFrames: [],
  startTick: 100,
  releaseTick: 122,
  endTick: 188,
  kind,
  targetId: 8,
  targetTeam: 'red',
  targetRig: null,
  origin: { x: 0, y: 0 },
  castAudience: ['blue', 'red'],
  cancelTick: null,
  impact: null,
  x: 10,
  y: 20,
  castVisible: true,
  hitVisible: true,
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('all 24 published float masters retain exact source bytes, PCM and headroom', async () => {
  const decoded = JSON.parse(readFileSync('docs/reference/masteryi/audio-decoded.json', 'utf8'));
  const clips = new Map(P.flatMap((p) => p.variants.map((v) => [v.id, v] as const)));
  expect(clips.size).toBe(24);
  let headroom = false;
  for (const clip of clips.values()) {
    const data = raw('public/' + clip.url),
      master = decoded.media.find((m: any) => m.id === clip.id);
    expect(hash(new Uint8Array(data))).toBe(master.wavSha256);
    await verifySourceWave(data, clip.sha256);
    const channels = floatSourceChannels(data, clip);
    expect(channels).toHaveLength(1);
    expect(hash(new Uint8Array(channels[0].buffer))).toBe(clip.pcmSha256);
    let peak = 0;
    for (const v of channels[0]) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBe(clip.peak);
    headroom ||= peak > 1;
  }
  expect(headroom).toBe(true);
});

test.each(['extent', 'format', 'channels', 'rate', 'frames', 'nan', 'hash'])(
  'float reader rejects %s corruption instead of normalizing it',
  async (kind) => {
    const clip = P[0].variants[0],
      data = raw('public/' + clip.url),
      v = new DataView(data);
    if (kind === 'extent') v.setUint32(4, 1, true);
    if (kind === 'format') v.setUint16(20, 1, true);
    if (kind === 'channels') v.setUint16(22, 0, true);
    if (kind === 'rate') v.setUint32(24, 48000, true);
    if (kind === 'nan') {
      const at = new TextDecoder().decode(data).indexOf('data');
      v.setFloat32(at + 8, NaN, true);
    }
    if (kind === 'hash')
      await expect(verifySourceWave(data, '0'.repeat(64))).rejects.toThrow('SHA-256');
    else
      expect(() =>
        floatSourceChannels(data, { ...clip, frames: clip.frames + (kind === 'frames' ? 1 : 0) })
      ).toThrow();
  }
);

test.each(['attack1', 'crit'] as const)(
  '%s samples independent pitch and authored delay without changing contact time',
  (kind) => {
    const r = record(kind),
      initial = masterYiAAStates([r], 100);
    expect(initial).toHaveLength(1);
    expect(initial[0].leadSeconds).toBe(kind === 'crit' ? 0.2 : 0.05);
    expect(initial[0].offset).toBe(0);
    expect(masterYiAAStates([r], 99)).toEqual([]);
    expect(masterYiAAStates([r], 100)).toEqual(initial);
    const range = kind === 'crit' ? 200 : 100;
    for (let id = 1; id <= 100; id++) {
      const s = masterYiAAStates([{ ...r, id }], 110)[0];
      expect(s.pitchCents).toBeGreaterThanOrEqual(-range);
      expect(s.pitchCents).toBeLessThan(range);
      expect(s.offset).toBeCloseTo(s.age * 2 ** (s.pitchCents / 1200));
    }
    const cancelled = { ...r, cancelTick: 101 };
    expect(masterYiAAStates([cancelled], 105)).toHaveLength(1);
    expect(masterYiAAStates([r], 1000)).toEqual([]);
  }
);

test.each(['attack1', 'crit'] as const)(
  '%s resumes in source seconds at the exact AudioParam float32 rate',
  (kind) => {
    for (let id = 1; id <= 100; id++) {
      const state = masterYiAAStates([{ ...record(kind), id }], kind === 'crit' ? 125 : 110)[0];
      expect(state).toBeDefined();
      const appliedRate = Math.fround(2 ** (state.pitchCents / 1200));
      expect(state.playbackRate).toBe(appliedRate);
      expect(state.offset).toBe(state.age * appliedRate);
    }
  }
);

test.each(['Flesh', 'Metal', 'Stone', 'Wood'] as const)(
  'contact selects only the %s branch at its captured point',
  (material) => {
    const r = record();
    r.impact = { tick: 122, point: { x: 40, y: 50 }, material, audience: ['blue', 'red'] };
    const states = masterYiAAStates([r], 122),
      hit = states.find((s) => P[s.profileIndex].phase === 'hit')!;
    expect(states).toHaveLength(2);
    expect(P[hit.profileIndex].material).toBe(material);
    expect(hit).toMatchObject({ x: 40, y: 50, offset: 0, leadSeconds: 0 });
    expect(masterYiAAStates([{ ...r, castVisible: false, hitVisible: false }], 122)).toEqual([]);
    expect(masterYiAAStates([r], 121).every((s) => P[s.profileIndex].phase === 'cast')).toBe(true);
  }
);

function controller() {
  const made: any[] = [];
  const context: any = {
    state: 'running',
    currentTime: 10,
    destination: {},
    createBufferSource() {
      const n: any = {
        playbackRate: { value: 1 },
        connect: (v: any) => v,
        disconnect: vi.fn(),
        stop: vi.fn(),
        start: vi.fn(),
      };
      made.push(n);
      return n;
    },
    createGain: () => ({
      gain: { value: 0, setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
  const audio: any = new MasterYiAttackAudio();
  audio.status = 'ready';
  audio.buffers = new Map(
    P.flatMap((p) => p.variants.map((v) => [v.id, { duration: v.durationSeconds }]))
  );
  const update = (records: MasterYiAARecord[], tick: number, audible = true) =>
    audio.update(context, audible, records, tick, { x: 0, y: 0 });
  return { audio, made, context, update };
}
test('playback seeks after pause, stops when muted, and completes each finite cue once', () => {
  const f = controller(),
    r = record();
  f.update([r], 100);
  expect(f.made[0].start).toHaveBeenCalledWith(10.05, 0);
  f.update([r], 102);
  expect(f.made).toHaveLength(1);
  f.update([r], 105, false);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  f.update([r], 110);
  expect(f.made[1].start.mock.calls[0][1]).toBeGreaterThan(0);
  f.made[1].onended();
  f.update([r], 111);
  expect(f.made).toHaveLength(2);
  f.update([], 112);
  expect(f.audio.finished.size).toBe(0);
});
test('global source cap kills the oldest same-container cue, and fallback suppresses the complete swing', () => {
  const f = controller(),
    r = record();
  f.update([r, { ...r, id: 9 }, { ...r, id: 10 }], 100);
  expect(f.made).toHaveLength(3);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  expect(f.audio.voices.size).toBe(2);
  f.audio.stop();
  f.audio.suppressSwing(r.id, r.startTick);
  r.impact = { tick: 122, point: r.origin, material: 'Flesh', audience: ['blue'] };
  f.update([r], 122);
  expect(f.audio.voices.size).toBe(0);
});
test('resource loading deduplicates all 24 files and retries only the failed master explicitly', async () => {
  const copied: Float32Array[] = [];
  vi.stubGlobal(
    'AudioBuffer',
    class {
      copyToChannel(data: Float32Array) {
        copied.push(data);
      }
    }
  );
  let fail = true;
  const fetcher = vi.fn(async (url: string) => {
    if (fail && url.endsWith(P[0].variants[0].url)) return { ok: false, status: 503 };
    return { ok: true, arrayBuffer: async () => raw('public/' + url.replace(/^\//, '')) };
  });
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const audio = new MasterYiAttackAudio(),
    first = audio.load();
  expect(audio.load()).toBe(first);
  await first;
  expect(audio.status).toBe('failed');
  expect(fetcher).toHaveBeenCalledTimes(24);
  fail = false;
  await audio.load();
  expect(audio.status).toBe('ready');
  expect(fetcher).toHaveBeenCalledTimes(25);
  expect(copied).toHaveLength(24);
  await audio.load();
  expect(fetcher).toHaveBeenCalledTimes(25);
});
