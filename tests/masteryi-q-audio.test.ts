import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  MASTER_YI_Q_AUDIO as P,
  MASTER_YI_Q_ATTENUATION as A,
} from '../src/content/masteryi-q-audio';
import { masterYiQStates, type MasterYiQRecord } from '../src/audio/masteryi-q-state';
import { MasterYiAlphaAudio } from '../src/audio/masteryi-q';
import { floatSourceChannels } from '../src/audio/float-source-wav';

function record(id = 7): MasterYiQRecord {
  return {
    id,
    startTick: 100,
    rank: 1,
    primaryTargetId: 90,
    primaryTargetTeam: 'red',
    origin: { x: 10, y: 20 },
    castAudience: ['blue'],
    castVisible: true,
    contacts: [],
  };
}
function contact(r: MasterYiQRecord, index = 1, tick = 128) {
  r.contacts.push({
    tick,
    markTick: r.startTick + (index + 1) * 14,
    markIndex: index,
    repeatIndex: index,
    targetId: 90,
    targetTeam: 'red',
    point: { x: 40, y: 50 },
    audience: ['blue', 'red'],
    visible: true,
  });
  return r;
}
function raw(url: string): ArrayBuffer {
  const b = readFileSync('public/' + url.replace(/^\//, ''));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('all seven source float masters retain exact samples/headroom and the three declared gain/cap policies', () => {
  expect(
    P.map((p) => [p.containerId, p.gainDb, p.policy.u16MaxNumInstance, p.policy.bKillNewest])
  ).toEqual([
    [8847, -12, 3, 1],
    [8848, -10, 3, 0],
    [8846, -11, 2, 0],
  ]);
  expect(P.map((p) => p.variants.length)).toEqual([1, 1, 5]);
  expect(P[2].variants.map((v) => v.id)).toEqual([
    142077803, 48797763, 108844688, 555085050, 924931329,
  ]);
  expect(P[0].pitchModifiers).toMatchObject([{ minimum: -100, maximum: 100 }]);
  expect(P[1].pitchModifiers).toMatchObject([{ minimum: -100, maximum: 100 }]);
  expect(P[2].pitchModifiers).toEqual([]);
  expect(A.id).toBe(339248780);
  expect(A.unresolvedOutputBusId).toBe(1259461568);
  expect(A.points).toHaveLength(6);
  const clips = P.flatMap<(typeof P)[number]['variants'][number]>((p) => p.variants);
  expect(clips.reduce((n, v) => n + v.bytes, 0)).toBe(1300172);
  expect(clips.filter((v) => v.peak > 1)).toHaveLength(3);
  for (const clip of clips) {
    const bytes = raw(clip.url),
      channels = floatSourceChannels(bytes, clip);
    expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(clip.sha256);
    expect(createHash('sha256').update(new Uint8Array(channels[0].buffer)).digest('hex')).toBe(
      clip.pcmSha256
    );
    expect(channels[0]).toHaveLength(clip.frames);
  }
});
test('accepted creation plays two finite pitched cast layers from the captured point and seeks in source samples', () => {
  const r = record(),
    states = masterYiQStates([r], 100);
  expect(states.map((s) => s.profileIndex)).toEqual([0, 1]);
  expect(states.map((s) => [s.offset, s.x, s.y])).toEqual([
    [0, 10, 20],
    [0, 10, 20],
  ]);
  for (const s of masterYiQStates([r], 160)) {
    expect(s.playbackRate).toBe(Math.fround(s.playbackRate));
    expect(s.playbackRate).toBeGreaterThanOrEqual(2 ** (-100 / 1200));
    expect(s.playbackRate).toBeLessThanOrEqual(2 ** (100 / 1200));
    expect(s.offset).toBe(s.playbackRate);
  }
  expect(masterYiQStates([r], 99.9)).toEqual([]);
  expect(masterYiQStates([r], 244)).toEqual([]);
});
test('ordinary contact creates one independent non-pitched hit cue; unseen creation cannot return later', () => {
  const r = contact(record());
  r.castVisible = false;
  expect(masterYiQStates([r], 127)).toEqual([]);
  expect(masterYiQStates([r], 128)).toMatchObject([
    { profileIndex: 2, playbackRate: 1, offset: 0, x: 40, y: 50 },
  ]);
  expect(masterYiQStates([r], 140)[0].offset).toBe(0.2);
  r.contacts[0].visible = false;
  expect(masterYiQStates([r], 140)).toEqual([]);
});
test('seek order and record order cannot change indexed variants, pitch, captured coordinates or chronological admission', () => {
  const r = contact(record()),
    other = record(3);
  other.startTick = 101;
  const before = JSON.stringify(r),
    a = masterYiQStates([r, other], 130);
  masterYiQStates([r], 500);
  masterYiQStates([r], 102);
  expect(masterYiQStates([other, r], 130)).toEqual(a);
  expect(JSON.stringify(r)).toBe(before);
  expect(a.map((s) => s.startTick)).toEqual([100, 100, 101, 101, 128]);
  expect(masterYiQStates([r], NaN)).toEqual([]);
});
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
  const audio: any = new MasterYiAlphaAudio();
  audio.status = 'ready';
  audio.buffers = new Map(
    P.flatMap((p) => p.variants.map((v) => [v.id, { duration: v.durationSeconds }]))
  );
  const update = (records: MasterYiQRecord[], tick: number, audible = true) =>
    audio.update(context, audible, records, tick, { x: 0, y: 0 });
  return { audio, context, made, update };
}
test('the two cast containers independently reject newest versus evict oldest across four casters without resurrection', () => {
  const f = controller(),
    records = [1, 2, 3, 4].map(record);
  f.update(records, 100);
  expect(f.made).toHaveLength(7);
  expect(f.audio.voices.size).toBe(6);
  expect([...f.audio.voices.keys()].filter((key: string) => key.endsWith(':-1:0'))).toEqual([
    '1:100:-1:0',
    '2:100:-1:0',
    '3:100:-1:0',
  ]);
  expect([...f.audio.voices.keys()].filter((key: string) => key.endsWith(':-1:1'))).toEqual([
    '2:100:-1:1',
    '3:100:-1:1',
    '4:100:-1:1',
  ]);
  expect(f.audio.finished.has('4:100:-1:0')).toBe(true);
  expect(f.audio.finished.has('1:100:-1:1')).toBe(true);
  f.update(records, 101);
  expect(f.made).toHaveLength(7);
});
test('four ordinary target cues share the hit cap of two and preserve only the last admitted contacts', () => {
  const f = controller(),
    r = record();
  r.castVisible = false;
  for (let i = 0; i < 4; i++) {
    contact(r, i, 156);
    r.contacts[i].repeatIndex = 0;
  }
  f.update([r], 156);
  expect(f.made).toHaveLength(4);
  expect(f.audio.voices.size).toBe(2);
  expect([...f.audio.voices.keys()]).toEqual(['7:100:2:2', '7:100:3:2']);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  expect(f.made[1].stop).toHaveBeenCalledOnce();
  f.update([r], 157);
  expect(f.made).toHaveLength(4);
});
test('pause/mute stops nodes, resume seeks both pitched layers, and completed one-shots never restart', () => {
  const f = controller(),
    r = record();
  f.update([r], 100);
  expect(f.made).toHaveLength(2);
  expect(f.made.every((n) => n.loop === false)).toBe(true);
  f.update([r], 130, false);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  expect(f.made[1].stop).toHaveBeenCalledOnce();
  f.update([r], 160);
  expect(f.made).toHaveLength(4);
  for (const s of masterYiQStates([r], 160)) {
    const voice = f.audio.voices.get(s.key);
    expect(voice.source.start).toHaveBeenCalledWith(10, s.offset);
  }
  f.made[2].onended();
  f.update([r], 161);
  expect(f.made).toHaveLength(4);
  f.context.state = 'suspended';
  f.update([r], 162);
  expect(f.audio.voices.size).toBe(0);
});
test('a single generic fallback suppresses both cast layers and permits a later declared ordinary hit', () => {
  const f = controller(),
    r = record();
  f.audio.suppressCast(r.id, r.startTick);
  f.update([r], 100);
  expect(f.made).toEqual([]);
  contact(r);
  f.update([r], 128);
  expect(f.made).toHaveLength(1);
  const voice = [...f.audio.voices.values()][0] as any;
  expect(voice.containerId).toBe(8846);
  expect(voice.gain.gain.value).toBeCloseTo(0.2 * 10 ** (-11 / 20), 12);
});
test('both zero-delay cast actions share one audio-clock admission instant', () => {
  const f = controller();
  let reads = 0;
  Object.defineProperty(f.context, 'currentTime', { get: () => 10 + reads++ * 0.25 });
  f.update([record()], 100);
  expect(f.made.map((n) => n.start.mock.calls[0][0])).toEqual([10, 10]);
  expect(reads).toBe(1);
});
test('finished/fallback bookkeeping clears with expired history and leaves no live nodes', () => {
  const f = controller(),
    r = record();
  f.update([r], 100);
  f.made[0].onended();
  f.audio.suppressCast(r.id, r.startTick);
  f.update([], 300);
  expect(f.audio.voices.size).toBe(0);
  expect(f.audio.finished.size).toBe(0);
  expect(f.audio.fallback.size).toBe(0);
});
test('partial loading keeps six verified masters and explicitly retries just the failed source', async () => {
  let fail = true;
  const missing = P[0].variants[0].url;
  vi.stubGlobal(
    'AudioBuffer',
    class {
      copyToChannel() {}
    }
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      fail && url.endsWith(missing)
        ? { ok: false, status: 503 }
        : { ok: true, arrayBuffer: async () => raw(url) }
    )
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const audio: any = new MasterYiAlphaAudio(),
    first = audio.load();
  expect(audio.load()).toBe(first);
  await first;
  expect(audio.status).toBe('failed');
  expect(audio.buffers.size).toBe(6);
  expect(fetch).toHaveBeenCalledTimes(7);
  audio.update(null, false, [], 100, { x: 0, y: 0 });
  expect(fetch).toHaveBeenCalledTimes(7);
  fail = false;
  await audio.load();
  expect(audio.status).toBe('ready');
  expect(audio.buffers.size).toBe(7);
  expect(fetch).toHaveBeenCalledTimes(8);
});
