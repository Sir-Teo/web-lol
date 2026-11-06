import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  lifecycleGameplayProjection,
  compareLifecycleGameplay,
} from './compare-lifecycle-gameplay.mjs';
const baseline = '2ba54634799e9f6ddc6a5ab81f4a494cf9a46fdfd3a4aab5a5d4a3cbb5cdfdc1';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
function fixture(root, candidate) {
  const file = (name, raw) => {
    const path = resolve(root, name);
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, raw);
    return { file: path, bytes: Buffer.byteLength(raw), sha256: sha(raw) };
  };
  const source = file('frozen-source/src/example.ts', 'frozen source');
  const runner = file('runner/match-seed.js', 'frozen runner');
  const input = file('maps/rift-nav.bin', 'frozen map');
  const ruleset = candidate ? 'b'.repeat(64) : baseline;
  const plan = {
    ruleset,
    sourceRevision: candidate ? 'new' : 'old',
    sourceArchive: resolve(root, 'frozen-source'),
    seeds: [1],
    developmentRoster: true,
    developmentLeona: false,
    qaAutomatedHumanRole: 'mid',
    qaAutomatedHumanCarry: false,
    horizonTicks: 216000,
    roster: 'same roster',
    runtime: { node: 'v24.22.1' },
    inputs: [input],
    runner,
    sources: [{ ...source, file: 'src/example.ts' }],
  };
  const checkpoint = (tick, final) => {
    const state = {
      version: candidate ? 174 : 173,
      ruleset,
      tick,
      winner: final ? 'blue' : null,
      random: { state: 123 },
      nextId: 40,
      ahriOrbAudio: [{ retained: true }],
      ahriCharmAudio: [],
      ahriFoxFireAudio: [{ retained: true }],
      ahriSpiritRushAudio: [{ retained: true }],
      ahriPassiveAudio: [{ retained: true }],
      ahriAttackAudio: [{ retained: true }],
      units: [{ id: 1, hp: 90 }],
    };
    if (candidate) state.ahriLifecycleAudio = [{ cosmetic: true }];
    const raw = JSON.stringify(state),
      pin = file(`seeds/1/${final ? 'final' : '003600'}.match.json`, raw + '\n');
    return { tick, path: pin.file, fileSha256: pin.sha256, stateSha256: sha(raw) };
  };
  const cp = checkpoint(3600, false),
    final = checkpoint(7201, true);
  const terminal = {
    ...final,
    path: file('seeds/1/007201.match.json', readFileSync(final.path)).file,
  };
  file(
    'seeds/1/report.json',
    JSON.stringify({
      seed: 1,
      ruleset,
      outcome: 'victory',
      failure: null,
      winner: 'blue',
      finalTick: final.tick,
      checkedTicks: final.tick,
      finalPath: final.path,
      finalStateSha256: final.stateSha256,
      checkpoints: [cp, terminal],
      roundTrips: 1,
      futureChecks: 1,
    })
  );
  file('plan.json', JSON.stringify(plan));
}
function withFixtures(run) {
  const root = mkdtempSync(resolve(tmpdir(), 'lifecycle-compare-'));
  try {
    const a = resolve(root, 'baseline'),
      b = resolve(root, 'candidate');
    fixture(a, false);
    fixture(b, true);
    run(a, b);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('compares pinned checkpoint and final projections while retaining distinct save identities', () =>
  withFixtures((a, b) => {
    const result = compareLifecycleGameplay(a, b, 1);
    assert.equal(result.result, 'passed');
    assert.equal(result.samples.length, 3);
    assert.notEqual(result.samples[0].referenceFileSha256, result.samples[0].candidateFileSha256);
    assert.equal(result.samples[0].lifecycleRecords, 1);
  }));
for (const [name, path] of [
  ['source', 'frozen-source/src/example.ts'],
  ['runner', 'runner/match-seed.js'],
  ['map', 'maps/rift-nav.bin'],
  ['checkpoint', 'seeds/1/003600.match.json'],
  ['final', 'seeds/1/final.match.json'],
])
  test(`rejects changed ${name} bytes before comparison`, () =>
    withFixtures((a, b) => {
      writeFileSync(resolve(b, path), 'changed');
      assert.throws(() => compareLifecycleGameplay(a, b, 1));
    }));
test('gameplay projection retains RNG, entity IDs, HP and every unrelated root field', () => {
  const a = {
    version: 174,
    ruleset: 'new',
    ahriLifecycleAudio: [{ cosmetic: true }],
    tick: 30,
    random: 123,
    nextId: 40,
    unit: { hp: 90 },
    extra: 'retained',
  };
  const base = lifecycleGameplayProjection(JSON.stringify(a), 174);
  for (const mutation of [
    { random: 124 },
    { nextId: 41 },
    { unit: { hp: 89 } },
    { extra: 'changed' },
  ])
    assert.notEqual(lifecycleGameplayProjection(JSON.stringify({ ...a, ...mutation }), 174), base);
  assert.equal(
    lifecycleGameplayProjection(
      JSON.stringify({ ...a, ruleset: 'other', ahriLifecycleAudio: [{ changed: true }] }),
      174
    ),
    base
  );
  assert.throws(() => lifecycleGameplayProjection(JSON.stringify({ ...a, version: 173 }), 174));
  assert.throws(() =>
    lifecycleGameplayProjection(JSON.stringify({ ...a, ahriLifecycleAudio: null }), 174)
  );
});
test('rejects changed roster policy and escaping archived source paths', () =>
  withFixtures((a, b) => {
    const path = resolve(b, 'plan.json'),
      original = JSON.parse(readFileSync(path));
    writeFileSync(path, JSON.stringify({ ...original, qaAutomatedHumanRole: 'carry' }));
    assert.throws(() => compareLifecycleGameplay(a, b, 1), /roster/);
    writeFileSync(
      path,
      JSON.stringify({ ...original, sources: [{ ...original.sources[0], file: '../escape' }] })
    );
    assert.throws(() => compareLifecycleGameplay(a, b, 1), /escapes/);
  }));

test('empty lifecycle histories may be omitted and existing Q/Charm history remains part of gameplay projection', () => {
  const baseline = {
    version: 173,
    ruleset: 'old',
    tick: 40,
    ahriCharmAudio: [],
    ahriOrbAudio: [{ retained: true }],
  };
  const candidate = { ...baseline, version: 174, ruleset: 'new' };
  assert.equal(
    lifecycleGameplayProjection(JSON.stringify(candidate), 174),
    lifecycleGameplayProjection(JSON.stringify(baseline), 173)
  );
  assert.notEqual(
    lifecycleGameplayProjection(
      JSON.stringify({ ...candidate, ahriCharmAudio: [{ changed: true }] }),
      174
    ),
    lifecycleGameplayProjection(JSON.stringify(baseline), 173)
  );
  assert.throws(() =>
    lifecycleGameplayProjection(JSON.stringify({ ...candidate, ahriLifecycleAudio: [] }), 174)
  );
});

test('existing Orb history remains in the complete gameplay projection', () => {
  const a = {
    version: 174,
    ruleset: 'new',
    ahriOrbAudio: [{ id: 40 }],
    ahriLifecycleAudio: [{ cosmetic: true }],
  };
  assert.notEqual(
    lifecycleGameplayProjection(JSON.stringify(a), 174),
    lifecycleGameplayProjection(JSON.stringify({ ...a, ahriOrbAudio: [{ id: 41 }] }), 174)
  );
});

test('existing Fox-Fire history remains in the complete gameplay projection', () => {
  const a = {
    version: 174,
    ruleset: 'new',
    ahriFoxFireAudio: [{ id: 40 }],
    ahriLifecycleAudio: [{ cosmetic: true }],
  };
  assert.notEqual(
    lifecycleGameplayProjection(JSON.stringify(a), 174),
    lifecycleGameplayProjection(JSON.stringify({ ...a, ahriFoxFireAudio: [{ id: 41 }] }), 174)
  );
});

test('existing Spirit Rush history remains in the complete gameplay projection', () => {
  const a = {
    version: 174,
    ruleset: 'new',
    ahriSpiritRushAudio: [{ id: 40 }],
    ahriLifecycleAudio: [{ cosmetic: true }],
  };
  assert.notEqual(
    lifecycleGameplayProjection(JSON.stringify(a), 174),
    lifecycleGameplayProjection(JSON.stringify({ ...a, ahriSpiritRushAudio: [{ id: 41 }] }), 174)
  );
});

test('existing passive history remains in the complete gameplay projection', () => {
  const a = {
    version: 174,
    ruleset: 'new',
    ahriPassiveAudio: [{ id: 40 }],
    ahriLifecycleAudio: [{ cosmetic: true }],
  };
  assert.notEqual(
    lifecycleGameplayProjection(JSON.stringify(a), 174),
    lifecycleGameplayProjection(JSON.stringify({ ...a, ahriPassiveAudio: [{ id: 41 }] }), 174)
  );
});

test('existing attack history remains in the complete gameplay projection', () => {
  const a = {
    version: 174,
    ruleset: 'new',
    ahriAttackAudio: [{ id: 40 }],
    ahriLifecycleAudio: [{ cosmetic: true }],
  };
  assert.notEqual(
    lifecycleGameplayProjection(JSON.stringify(a), 174),
    lifecycleGameplayProjection(JSON.stringify({ ...a, ahriAttackAudio: [{ id: 41 }] }), 174)
  );
});
