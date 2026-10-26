import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  MASTER_YI_E_AUDIO as P,
  MASTER_YI_E_ATTENUATION as A,
} from '../src/content/masteryi-e-audio';
import { masterYiEStates, type MasterYiEAudioRecord } from '../src/audio/masteryi-e-state';
import { MasterYiWujuStyleAudio } from '../src/audio/masteryi-e';
import { floatSourceChannels } from '../src/audio/float-source-wav';
const raw = (url: string) => {
  const b = readFileSync('public/' + url.replace(/^\//, ''));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const record = (): MasterYiEAudioRecord => ({
  id: 7,
  startTick: 100,
  rank: 1,
  origin: { x: 0, y: 0 },
  castAudience: ['blue'],
  stop: null,
  x: 20,
  y: 30,
  castVisible: true,
  stopVisible: true,
});
const expire = (r: MasterYiEAudioRecord) => {
  r.stop = {
    tick: 400,
    reason: 'expired',
    endTick: 400,
    pausedTicks: 0,
    point: { x: 40, y: 50 },
    audience: ['blue'],
  };
  return r;
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test('all six delivered masters retain source WAV/PCM, original playlists, gains and priority', () => {
  const reading = JSON.parse(readFileSync('docs/reference/masteryi/e-audio-reading.json', 'utf8'));
  expect(P.map((p) => p.kind)).toEqual(['cast', 'activate', 'deactivate']);
  expect(P.map((p) => p.variants.map((v) => v.id))).toEqual([
    [289182248, 975357315],
    [418795702, 209385861],
    [418782952, 63363042],
  ]);
  expect(P.map((p) => [p.gainDb, p.policy.u16MaxNumInstance, p.policy.bKillNewest])).toEqual([
    [-11, 4, 0],
    [-9, 4, 0],
    [-14, 4, 0],
  ]);
  expect(P[0].sourceProperties.Priority).toBe(60);
  expect(A.id).toBe(339248780);
  expect(A.points).toHaveLength(6);
  expect(P.map((p) => p.eventName + '\n')).toEqual(
    ['12', '18', '19'].map((slot) => reading.rawSpellSuffixes[slot])
  );
  let headroom = 0;
  for (const p of P)
    for (const clip of p.variants) {
      const bytes = raw(clip.url),
        channels = floatSourceChannels(bytes, clip);
      expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(clip.sha256);
      expect(createHash('sha256').update(new Uint8Array(channels[0].buffer)).digest('hex')).toBe(
        clip.pcmSha256
      );
      if (clip.peak > 1) headroom++;
    }
  expect(headroom).toBe(1);
});
test('both onset cues follow the actor and expire independently of the buff', () => {
  const r = record();
  expect(masterYiEStates([r], 99)).toEqual([]);
  expect(masterYiEStates([r], 100)).toMatchObject([
    { profileIndex: 0, offset: 0, x: 20, y: 30 },
    { profileIndex: 1, offset: 0, x: 20, y: 30 },
  ]);
  expect(masterYiEStates([r], 228)).toEqual([]);
  expect(masterYiEStates([{ ...r, castVisible: false }], 100)).toEqual([]);
});
test('indexed choices cover both original entries per phase and remain seek-stable without random draws', () => {
  const before = JSON.stringify(P);
  vi.spyOn(Math, 'random').mockImplementation(() => {
    throw Error('Unexpected random draw');
  });
  for (let profile = 0; profile < 3; profile++) {
    const variants = new Set<number>();
    for (let id = 1; id < 80; id++) {
      const r = expire({ ...record(), id });
      const state = masterYiEStates([r], profile === 2 ? 400 : 100).find(
        (s) => s.profileIndex === profile
      )!;
      variants.add(state.variant);
    }
    expect([...variants].sort()).toEqual([0, 1]);
  }
  const r = expire(record()),
    saved = masterYiEStates([r], 120.5);
  for (const tick of [400, 90, 227, 130]) masterYiEStates([r], tick);
  expect(masterYiEStates([r], 120.5)).toEqual(saved);
  expect(JSON.stringify(P)).toBe(before);
});
test('natural expiry uses its captured point and independent audience', () => {
  const r = expire(record());
  r.castVisible = false;
  expect(masterYiEStates([r], 399)).toEqual([]);
  expect(masterYiEStates([r], 400)).toMatchObject([{ profileIndex: 2, offset: 0, x: 40, y: 50 }]);
  expect(masterYiEStates([r], 460)[0].offset).toBe(1);
  expect(masterYiEStates([r], 467)).toEqual([]);
  expect(masterYiEStates([{ ...r, stopVisible: false }], 400)).toEqual([]);
});
test.each(['death', 'victory', 'recast'] as const)(
  '%s preserves finite onsets without a new ending',
  (reason) => {
    const r = expire(record());
    r.stop!.tick = 110;
    r.stop!.reason = reason;
    expect(masterYiEStates([r], 110).map((s) => s.profileIndex)).toEqual([0, 1]);
    expect(masterYiEStates([r], 400)).toEqual([]);
  }
);
function controller() {
  const made: any[] = [],
    context: any = {
      state: 'running',
      currentTime: 10,
      destination: {},
      createBufferSource() {
        const n: any = {
          playbackRate: { value: 1 },
          connect: (v: any) => v,
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
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
  const audio: any = new MasterYiWujuStyleAudio();
  audio.status = 'ready';
  audio.buffers = new Map(
    P.flatMap((p) => p.variants.map((v) => [v.id, { duration: v.durationSeconds }]))
  );
  const update = (records: MasterYiEAudioRecord[], tick: number, audible = true) =>
    audio.update(context, audible, records, tick, { x: 0, y: 0 });
  return { made, context, audio, update };
}
test('pause/mute releases both onsets and resume seeks them without restarting finished cues', () => {
  const f = controller(),
    r = record();
  f.update([r], 100);
  expect(f.made).toHaveLength(2);
  expect(f.made.every((n) => !n.loop)).toBe(true);
  f.update([r], 110, false);
  expect(f.made.every((n) => n.stop.mock.calls.length === 1)).toBe(true);
  f.update([r], 130);
  expect(f.made).toHaveLength(4);
  for (const n of f.made.slice(2)) {
    expect(n.start).toHaveBeenCalledWith(10, 0.5);
    n.onended();
  }
  f.update([r], 131);
  expect(f.made).toHaveLength(4);
});
test('five actors share independent caps of four per onset container and do not resurrect evicted voices', () => {
  const f = controller(),
    records = Array.from({ length: 5 }, (_, i) => ({ ...record(), id: i + 1 }));
  f.update(records, 100);
  expect(f.made).toHaveLength(10);
  expect(f.audio.voices.size).toBe(8);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  expect(f.made[1].stop).toHaveBeenCalledOnce();
  f.update(records, 101);
  expect(f.made).toHaveLength(10);
});
test('generic fallback suppresses only cast while activation and later ending remain independent', () => {
  const f = controller(),
    r = record();
  f.audio.suppressCast(r.id, r.startTick);
  f.update([r], 100);
  expect(f.made).toHaveLength(1);
  expect([...f.audio.voices.keys()]).toEqual(['7:100:1']);
  expire(r);
  f.update([r], 400);
  expect(f.made).toHaveLength(2);
  expect([...f.audio.voices.keys()]).toEqual(['7:100:2']);
});
test('partial failure keeps five verified buffers and retries only one of six files explicitly', async () => {
  let fail = true;
  vi.stubGlobal(
    'AudioBuffer',
    class {
      copyToChannel() {}
    }
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      fail && url.endsWith(P[0].variants[0].url)
        ? { ok: false, status: 503 }
        : { ok: true, arrayBuffer: async () => raw(url) }
    )
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const audio: any = new MasterYiWujuStyleAudio(),
    first = audio.load();
  expect(audio.load()).toBe(first);
  await first;
  expect(audio.status).toBe('failed');
  expect(audio.buffers.size).toBe(5);
  expect(fetch).toHaveBeenCalledTimes(6);
  fail = false;
  await audio.load();
  expect(audio.status).toBe('ready');
  expect(fetch).toHaveBeenCalledTimes(7);
  expect(audio.buffers.size).toBe(6);
});
