import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LEONA_AA_AUDIO as P } from '../src/content/leona-aa-audio';
import { LEONA_Q_AUDIO } from '../src/content/leona-q-audio';
const sha = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex');
const shared = [65890581, 99858069, 124210504, 149881516, 180033450, 256570934, 271147565];

test('ten source attack events retain their aliases, distinct cast delays and complete graph provenance', () => {
  const raw = readFileSync('docs/reference/leona-aa-audio.json'),
    graph = JSON.parse(raw.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/leona-aa-audio-decoded.json', 'utf8'));
  expect(graph.events).toHaveLength(10);
  expect(graph.nodes).toHaveLength(65);
  expect(graph.media).toHaveLength(28);
  expect(graph.extractionSha256).toBe(
    sha(readFileSync('docs/reference/leona-audio-extraction.json'))
  );
  expect(graph.referenceSha256).toBe(sha(readFileSync('docs/reference/leona-model.json')));
  expect(decoded.sourceGraphSha256).toBe(sha(raw));
  expect(graph.unresolvedHierarchyIds).toEqual([211064428]);
  expect(
    P.events.map((e) => [e.name.replace('Play_sfx_Leona_', ''), e.targetId, e.delaySeconds])
  ).toEqual([
    ['LeonaBasicAttack2_OnCast', 2419, 0],
    ['LeonaBasicAttack2_OnHit', 474813184, 0],
    ['LeonaBasicAttack3_OnCast', 2419, 0],
    ['LeonaBasicAttack3_OnHit', 483073156, 0],
    ['LeonaBasicAttack4_OnCast', 2419, 0.04],
    ['LeonaBasicAttack4_OnHit', 474813184, 0],
    ['LeonaBasicAttack_OnCast', 2419, 0.04],
    ['LeonaBasicAttack_OnHit', 474813184, 0],
    ['LeonaCritAttack_OnCast', 2425, 0],
    ['LeonaCritAttack_OnHit', 2426, 0],
  ]);
});

test('eight random containers preserve distinct gains, child priorities, LPF and avoid-repeat policies', () => {
  expect(
    P.containers.map((c) => [
      c.id,
      c.policy.u16MaxNumInstance,
      c.policy.bKillNewest,
      c.policy.eRandomMode,
      c.policy.wAvoidRepeatCount,
    ])
  ).toEqual([
    [2419, 2, 0, 1, 0],
    [2425, 2, 0, 1, 0],
    [2426, 2, 0, 1, 0],
    [6307, 4, 0, 1, 0],
    [6308, 4, 0, 1, 0],
    [6309, 4, 0, 1, 0],
    [6310, 4, 0, 1, 0],
    [483073156, 0, 0, 0, 3],
  ]);
  for (const c of P.containers) {
    expect(c.policy).toMatchObject({
      eMode: 0,
      bResetPlayListAtEachPlay: 1,
      bIsGlobal: 1,
      bIsContinuous: 0,
      _bIsUsingWeight: 0,
      sLoopCount: 1,
      sLoopModMin: 0,
      sLoopModMax: 0,
      eTransitionMode: 0,
    });
    expect(c.variants).toHaveLength(4);
    for (const v of c.variants)
      expect(v.authoredProperties).toEqual({
        values: c.id === 483073156 ? {} : { Priority: c.id === 2426 ? 60 : 56 },
        ranges: {},
      });
  }
  expect(P.containers.find((c) => c.id === 483073156)!.authoredProperties).toEqual({
    values: { LPF: 20, MakeUpGain: -9, Priority: 56 },
    ranges: {},
  });
  expect(P.containers.slice(0, 3).map((c) => c.authoredProperties.values)).toEqual([
    { MakeUpGain: -11 },
    { MakeUpGain: -9 },
    { MakeUpGain: -12 },
  ]);
  expect(P.containers[0].variants.map((v) => v.id)).toEqual([
    39329717, 180033450, 65890581, 271147565,
  ]);
  expect(P.containers[1].variants.map((v) => v.id)).toEqual(
    P.containers[0].variants.map((v) => v.id)
  );
  expect(P.containers[2].variants.map((v) => v.id)).toEqual(
    LEONA_Q_AUDIO.hit.variants.map((v) => v.id)
  );
  expect(P.containers[2].authoredProperties.values.MakeUpGain).not.toBe(LEONA_Q_AUDIO.hit.gainDb);
});

test('hit switch keeps numeric branches, ranged pitch and separate three-point attack attenuation', () => {
  expect(P.hitSwitch).toMatchObject({
    id: 474813184,
    groupId: 1559186049,
    defaultValueId: 1153642577,
    authoredProperties: { values: { MakeUpGain: -14 }, ranges: { Pitch: { min: -300, max: 300 } } },
  });
  expect(P.hitSwitch.branches.map((b) => [b.valueId, b.containerId])).toEqual([
    [1153642577, 6307],
    [2473969246, 6308],
    [1216965916, 6309],
    [2058049674, 6310],
  ]);
  expect(
    P.hitSwitch.branches.every(
      (b) =>
        b.parameters.eOnSwitchMode === 1 &&
        b.parameters.FadeInTime === 0 &&
        b.parameters.FadeOutTime === 0
    )
  ).toBe(true);
  expect(P.attenuation).toEqual({
    id: 134343538,
    scaling: 2,
    points: [
      { distance: 0, storedValue: 0, interpolation: 9 },
      { distance: 1350, storedValue: 0, interpolation: 4 },
      { distance: 2412, storedValue: -1, interpolation: 4 },
    ],
    unresolvedOutputBusId: 211064428,
  });
  expect(P.attenuation.id).not.toBe(LEONA_Q_AUDIO.attenuation.id);
  expect(P.stopAudit.actions).toHaveLength(5);
  expect(P.stopAudit.matchingTargets).toEqual([]);
});

test('twenty-eight float masters preserve every PCM hash and headroom while seven share existing Q bytes', () => {
  const decoded = JSON.parse(readFileSync('docs/reference/leona-aa-audio-decoded.json', 'utf8'));
  const masters = new Map<number, (typeof P.containers)[number]['variants'][number]>();
  for (const c of P.containers) for (const v of c.variants) masters.set(v.id, v);
  expect(masters.size).toBe(28);
  expect(
    [...masters.values()]
      .filter((v) => v.reusedQ)
      .map((v) => v.id)
      .sort((a, b) => a - b)
  ).toEqual(shared);
  let bytes = 0,
    headroom = 0;
  for (const v of masters.values()) {
    expect(v.url).toBe(`assets/audio/${v.reusedQ ? 'leona-q' : 'leona-aa'}-${v.id}.wav`);
    const raw = readFileSync('public/' + v.url);
    expect(sha(raw)).toBe(v.sha256);
    bytes += raw.length;
    let data: Buffer | undefined;
    for (let i = 12; i < raw.length;) {
      const n = raw.readUInt32LE(i + 4);
      if (raw.toString('ascii', i, i + 4) === 'data') data = raw.subarray(i + 8, i + 8 + n);
      i += 8 + n + (n % 2);
    }
    expect(data!.length).toBe(v.frames * 4);
    expect(sha(data!)).toBe(v.pcmSha256);
    const m = decoded.media.find((m: any) => m.id === v.id);
    expect(m.decoderMetadata.loopingInfo).toBeNull();
    expect(m.wavSha256).toBe(v.sha256);
    headroom += m.samplesOutsideUnitRange;
  }
  expect(bytes).toBe(3130340);
  expect(headroom).toBe(82);
  expect(Math.max(...[...masters.values()].map((v) => v.peak))).toBe(1.182897686958313);
});
