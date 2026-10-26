import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  MASTER_YI_W_AUDIO as P,
  MASTER_YI_W_ATTENUATION as A,
} from '../src/content/masteryi-w-audio';
import { masterYiWStates, type MasterYiWAudioRecord } from '../src/audio/masteryi-w-state';
import { MasterYiMeditateAudio } from '../src/audio/masteryi-w';
import { floatSourceChannels } from '../src/audio/float-source-wav';
const raw = (url: string) => {
  const b = readFileSync('public/' + url.replace(/^\//, ''));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const record = (): MasterYiWAudioRecord => ({
  id: 7,
  startTick: 100,
  rank: 1,
  endTick: 340,
  origin: { x: 0, y: 0 },
  castAudience: ['blue'],
  stop: null,
  x: 20,
  y: 30,
  castVisible: true,
  stopVisible: true,
});
const expire = (r: MasterYiWAudioRecord) => {
  r.stop = {
    tick: 340,
    reason: 'complete',
    point: { x: 40, y: 50 },
    audience: ['blue'],
  };
  return r;
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('explicit source suffixes retain both float masters, gains, finite caps and their own six-point attenuation/bus', () => {
  const reading = JSON.parse(readFileSync('docs/reference/masteryi/w-audio-reading.json', 'utf8'));
  const character = JSON.parse(
    readFileSync('docs/reference/masteryi/character.json', 'utf8')
  ).records;
  const suffixes =
    character['Characters/MasterYi/Spells/MeditateAbility/Meditate'].mSpell
      .SpellEventToAudioEventSuffix;
  expect([reading.rawSpellSuffixes['12'], reading.rawSpellSuffixes['19']]).toEqual([
    suffixes['12'],
    suffixes['19'],
  ]);
  expect(
    P.map((p) => [
      p.kind,
      p.gainDb,
      p.policy.u16MaxNumInstance,
      p.policy.sLoopCount,
      p.variants[0].id,
    ])
  ).toEqual([
    ['cast', -9, 2, 1, 637673445],
    ['deactivate', -13, 4, 1, 584858889],
  ]);
  expect(A.id).toBe(339248780);
  expect(A.unresolvedOutputBusId).toBe(1259461568);
  expect(A.points).toHaveLength(6);
  for (const p of P) {
    const clip = p.variants[0],
      bytes = raw(clip.url),
      channels = floatSourceChannels(bytes, clip);
    expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(clip.sha256);
    expect(createHash('sha256').update(new Uint8Array(channels[0].buffer)).digest('hex')).toBe(
      clip.pcmSha256
    );
    expect(clip.peak).toBeGreaterThan(1);
  }
});
test('activation follows its owner and expires without any future ending or synthetic loop', () => {
  const r = record();
  expect(masterYiWStates([r], 99)).toEqual([]);
  expect(masterYiWStates([r], 100)).toMatchObject([
    { profileIndex: 0, offset: 0, playbackRate: 1, x: 20, y: 30 },
  ]);
  expect(masterYiWStates([r], 160)[0].offset).toBe(1);
  expect(masterYiWStates([r], 251)).toEqual([]);
  expect(masterYiWStates([{ ...r, castVisible: false }], 100)).toEqual([]);
});
test('natural expiry creates only its captured ending point, independently of activation visibility', () => {
  const r = expire(record());
  r.castVisible = false;
  expect(masterYiWStates([r], 339)).toEqual([]);
  expect(masterYiWStates([r], 340)).toMatchObject([{ profileIndex: 1, offset: 0, x: 40, y: 50 }]);
  expect(masterYiWStates([r], 400)[0].offset).toBe(1);
  expect(masterYiWStates([r], 495)).toEqual([]);
  expect(masterYiWStates([{ ...r, stopVisible: false }], 340)).toEqual([]);
});
test.each(['death', 'victory'] as const)(
  '%s retains its finite activation without manufacturing a deactivation',
  (reason) => {
    const r = expire(record());
    r.stop!.tick = 110;
    r.stop!.reason = reason;
    expect(masterYiWStates([r], 110).map((s) => P[s.profileIndex].kind)).toEqual(['cast']);
    expect(masterYiWStates([r], 340)).toEqual([]);
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
  const audio: any = new MasterYiMeditateAudio();
  audio.status = 'ready';
  audio.buffers = new Map(
    P.map((p) => [p.variants[0].id, { duration: p.variants[0].durationSeconds }])
  );
  const update = (records: MasterYiWAudioRecord[], tick: number, audible = true) =>
    audio.update(context, audible, records, tick, { x: 0, y: 0 });
  return { audio, context, made, update };
}
test('pause/mute stops the onset, resume seeks, and finished one-shots never restart', () => {
  const f = controller(),
    r = record();
  f.update([r], 100);
  expect(f.made[0].start).toHaveBeenCalledWith(10, 0);
  expect(f.made[0].loop).toBe(false);
  f.update([r], 130, false);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  f.update([r], 160);
  expect(f.made[1].start).toHaveBeenCalledWith(10, 1);
  f.made[1].onended();
  f.update([r], 161);
  expect(f.made).toHaveLength(2);
});
test('a fallback suppresses activation only; a later natural ending still plays after recovery', () => {
  const f = controller(),
    r = record();
  f.audio.suppressCast(r.id, r.startTick);
  f.update([r], 100);
  expect(f.made).toEqual([]);
  expire(r);
  f.update([r], 340);
  expect(f.made).toHaveLength(1);
  expect(f.made[0].buffer).toBe(f.audio.buffers.get(P[1].variants[0].id));
});
test('five casters share the declared cast cap of two and discard the oldest onsets', () => {
  const f = controller(),
    records = Array.from({ length: 5 }, (_, i) => ({ ...record(), id: i + 1 }));
  f.update(records, 100);
  expect(f.made).toHaveLength(5);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
  expect(f.audio.voices.size).toBe(2);
  expect(f.made.slice(0, 3).every((n) => n.stop.mock.calls.length === 1)).toBe(true);
  f.update(records, 101);
  expect(f.made).toHaveLength(5);
});
test('partial loading retains its verified master and retries only the failed file explicitly', async () => {
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
  const audio = new MasterYiMeditateAudio(),
    first = audio.load();
  expect(audio.load()).toBe(first);
  await first;
  expect(audio.status).toBe('failed');
  expect(fetch).toHaveBeenCalledTimes(2);
  fail = false;
  await audio.load();
  expect(audio.status).toBe('ready');
  expect(fetch).toHaveBeenCalledTimes(3);
});

test('initial voice admission follows event chronology even when actor records arrive reversed', () => {
  const f = controller(),
    records = [
      { ...record(), id: 7, startTick: 100 },
      { ...record(), id: 8, startTick: 90 },
      { ...record(), id: 9, startTick: 95 },
    ];
  f.update(records, 110);
  expect([...f.audio.voices.keys()]).toEqual(['9:95:0', '7:100:0']);
  expect(f.made[0].stop).toHaveBeenCalledOnce();
});
test.each(['order', 'control', 'mana'] as const)(
  'a living %s ending overlaps its still-finite cast with an independent voice pool',
  (reason) => {
    const f = controller(),
      r = expire(record());
    r.stop!.reason = reason;
    r.stop!.tick = 110;
    f.update([r], 110);
    expect(f.made).toHaveLength(2);
    expect(f.made.map((n) => n.buffer)).toEqual(
      P.map((p) => f.audio.buffers.get(p.variants[0].id))
    );
    expect(f.made.map((n) => n.loop)).toEqual([false, false]);
  }
);
