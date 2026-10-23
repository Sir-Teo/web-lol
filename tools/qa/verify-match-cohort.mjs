/** Read-only verification of a completed, frozen cohort. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertMatchResources, assertMatchVictory } from './match-contract.ts';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const root = resolve(process.argv[2] ?? '');
if (!process.argv[2])
  throw Error(
    'Pass the completed cohort directory; use --historical only for older source revisions.'
  );
const historical = process.argv.includes('--historical');
const plan = JSON.parse(readFileSync(`${root}/plan.json`, 'utf8'));
const summary = JSON.parse(readFileSync(`${root}/summary.json`, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const pin of plan.inputs.concat(plan.runner, historical ? [] : plan.sources)) {
  const bytes = readFileSync(pin.file);
  assert.equal(bytes.length, pin.bytes, pin.file);
  assert.equal(hash(bytes), pin.sha256, pin.file);
}
if (!historical) assert.equal(rulesetFingerprint(), plan.ruleset);
assert.equal(summary.ruleset, plan.ruleset);
assert.equal(summary.completed, plan.seeds.length, 'Not every requested seed has completed');
assert.equal(summary.active.length, 0);
assert.equal(new Set(summary.results.map((r) => r.seed)).size, plan.seeds.length);
assert.deepEqual(
  summary.results.map((r) => r.seed).sort((a, b) => a - b),
  [...plan.seeds].sort((a, b) => a - b)
);
let ticks = 0,
  roundTrips = 0,
  futures = 0;
for (const seed of plan.seeds) {
  const report = JSON.parse(readFileSync(`${root}/seeds/${seed}/report.json`, 'utf8'));
  assert.equal(report.ruleset, plan.ruleset);
  assert.equal(report.seed, seed);
  assert.equal(report.failure, null, `Seed ${seed} failed`);
  assert.equal(report.horizonTicks, plan.horizonTicks);
  assert.equal(report.finalTick, report.checkedTicks);
  assert.equal(report.checkpoints.length, report.roundTrips);
  assert.equal(report.runtime.node, plan.runtime.node);
  assert.equal(report.runtime.v8, plan.runtime.v8);
  assert(report.futureChecks >= Math.max(0, report.roundTrips - 1));
  for (const checkpoint of report.checkpoints) {
    const bytes = readFileSync(checkpoint.path);
    assert.equal(hash(bytes), checkpoint.fileSha256);
    assert.equal(hash(bytes.subarray(0, -1)), checkpoint.stateSha256);
    const state = JSON.parse(bytes);
    assert.equal(state.tick, checkpoint.tick);
    assert.equal(state.ruleset, plan.ruleset);
    const states = new Map([state.player, ...state.otherChampions].map((r) => [r.id, r]));
    assertMatchResources({ ...state, championState: (id) => states.get(id) });
    assertMatchVictory(state);
  }
  const final = readFileSync(report.finalPath);
  assert.equal(hash(final.subarray(0, -1)), report.finalStateSha256);
  const state = JSON.parse(final);
  assert.equal(state.tick, report.finalTick);
  assert.equal(state.winner, report.winner);
  assertMatchVictory(state);
  if (report.outcome === 'unfinished') {
    assert.equal(report.finalTick, plan.horizonTicks);
    assert.equal(report.winner, null);
  } else {
    assert.equal(report.outcome, 'victory');
    assert(report.winner);
  }
  ticks += report.checkedTicks;
  roundTrips += report.roundTrips;
  futures += report.futureChecks;
}
assert.equal(ticks, summary.checkedTicks);
assert.equal(roundTrips, summary.roundTrips);
assert.equal(futures, summary.futureChecks);
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: plan.ruleset,
    seeds: plan.seeds.length,
    horizonTicks: plan.horizonTicks,
    victories: summary.victories,
    unfinished: summary.unfinished,
    checkedTicks: ticks,
    roundTrips,
    futureChecks: futures,
    hundredSeedInvariantGate: summary.hundredSeedInvariantGate,
    roadmapMilestone4Complete: false,
  })
);
