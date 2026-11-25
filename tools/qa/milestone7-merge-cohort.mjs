/**
 * Merge sharded Milestone 7 100-seed public-roster cohort outputs that ran against
 * the exact same commit, ruleset, Node runtime, and output root path, then run
 * both `verify-match-cohort.mjs --public-roster` and `verify-milestone7-cohort.mjs`.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const CANONICAL_HUNDRED_SEEDS = [
  26018,
  719,
  1,
  927,
  ...Array.from({ length: 93 }, (_, index) => index + 2),
  0x7fffffff,
  0x80000000,
  0xffffffff,
];

const root = resolve(process.argv[2] ?? '/tmp/m7-public-hundred');
const shardDir = resolve(process.argv[3] ?? '/tmp/m7-shards');
const ledgerOutput = resolve(process.argv[4] ?? '/tmp/m7-public-hundred-ledger.json');
const shardCount = Number(process.argv[5] ?? '10');

assert(existsSync(`${root}/plan.json`), `Missing base plan.json in ${root}`);
const basePlan = JSON.parse(readFileSync(`${root}/plan.json`, 'utf8'));

const allResults = [];
const seenSeeds = new Set();
let totalElapsed = 0;

for (let i = 0; i < shardCount; i++) {
  const shardPlanPath = resolve(shardDir, `shard-${i}`, 'plan.json');
  const shardSummaryPath = resolve(shardDir, `shard-${i}`, 'summary.json');
  assert(existsSync(shardPlanPath), `Missing shard ${i} plan.json: ${shardPlanPath}`);
  assert(existsSync(shardSummaryPath), `Missing shard ${i} summary.json: ${shardSummaryPath}`);
  const shardPlan = JSON.parse(readFileSync(shardPlanPath, 'utf8'));
  const shardSummary = JSON.parse(readFileSync(shardSummaryPath, 'utf8'));

  assert.equal(shardPlan.ruleset, basePlan.ruleset, `Shard ${i} ruleset mismatch`);
  assert.equal(shardPlan.sourceRevision, basePlan.sourceRevision, `Shard ${i} revision mismatch`);
  assert.equal(shardPlan.horizonTicks, basePlan.horizonTicks, `Shard ${i} horizon mismatch`);
  assert.equal(shardPlan.snapshotEncoding, basePlan.snapshotEncoding, `Shard ${i} encoding mismatch`);
  assert.equal(shardPlan.runtime.node, basePlan.runtime.node, `Shard ${i} node mismatch`);
  assert.equal(shardPlan.runtime.v8, basePlan.runtime.v8, `Shard ${i} v8 mismatch`);
  assert.equal(shardPlan.runtime.zlib, basePlan.runtime.zlib, `Shard ${i} zlib mismatch`);

  totalElapsed += shardSummary.elapsedSeconds ?? 0;
  for (const row of shardSummary.results ?? []) {
    assert(!seenSeeds.has(row.seed), `Duplicate seed ${row.seed} in shard ${i}`);
    seenSeeds.add(row.seed);
    assert(existsSync(`${root}/seeds/${row.seed}/report.json`), `Missing merged seed ${row.seed} report`);
    allResults.push(row);
  }
}

assert.equal(allResults.length, CANONICAL_HUNDRED_SEEDS.length, 'Expected all 100 canonical seeds');
assert.deepEqual(
  [...seenSeeds].sort((a, b) => a - b),
  [...CANONICAL_HUNDRED_SEEDS].sort((a, b) => a - b),
  'Merged seed set does not match canonical 100 seeds'
);

const mergedPlan = {
  ...basePlan,
  seeds: CANONICAL_HUNDRED_SEEDS,
};
writeFileSync(`${root}/plan.json`, JSON.stringify(mergedPlan, null, 2) + '\n');

const victories = allResults.filter((r) => r.outcome === 'victory');
const failed = allResults.filter((r) => r.outcome === 'failed');
const unfinished = allResults.filter((r) => r.outcome === 'unfinished');
const durations = victories.map((r) => r.finalTick / 60).sort((a, b) => a - b);
const percentile = (p) =>
  durations.length ? durations[Math.ceil(p * durations.length) - 1] : null;

const mergedSummary = {
  format: 1,
  ruleset: basePlan.ruleset,
  root,
  status: 'completed',
  completed: allResults.length,
  requested: CANONICAL_HUNDRED_SEEDS.length,
  queued: [],
  active: [],
  victories: victories.length,
  unfinished: unfinished.length,
  failures: failed.length,
  checkedTicks: allResults.reduce((s, r) => s + (r.checkedTicks ?? 0), 0),
  roundTrips: allResults.reduce((s, r) => s + (r.roundTrips ?? 0), 0),
  futureChecks: allResults.reduce((s, r) => s + (r.futureChecks ?? 0), 0),
  futureCheckedTicks: allResults.reduce((s, r) => s + (r.futureCheckedTicks ?? 0), 0),
  completionRate: allResults.length ? victories.length / allResults.length : null,
  victoryDurationSeconds: {
    p10: percentile(0.1),
    p50: percentile(0.5),
    p90: percentile(0.9),
  },
  allRequestedExecuted: allResults.length === CANONICAL_HUNDRED_SEEDS.length,
  hundredSeedInvariantGate:
    !basePlan.developmentLeona &&
    !basePlan.developmentRoster &&
    !basePlan.originalLineup &&
    basePlan.horizonTicks === 216000 &&
    allResults.length === 100 &&
    failed.length === 0,
  roadmapMilestone4Complete: false,
  elapsedSeconds: totalElapsed,
  hundredSeedDevelopmentLeonaInvariantGate: false,
  hundredSeedDevelopmentRosterInvariantGate: false,
  results: [...allResults].sort((a, b) => a.seed - b.seed),
};

writeFileSync(`${root}/summary.json`, JSON.stringify(mergedSummary, null, 2) + '\n');
writeFileSync(`${root}/status.json`, JSON.stringify(mergedSummary, null, 2) + '\n');

mkdirSync(resolve(ledgerOutput, '..'), { recursive: true });
const verifiedRaw = execFileSync(
  process.execPath,
  ['tools/qa/verify-match-cohort.mjs', root, '--public-roster', '--output', ledgerOutput],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);
const assessmentRaw = execFileSync(
  process.execPath,
  ['tools/qa/verify-milestone7-cohort.mjs', root],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);

console.log(
  JSON.stringify(
    {
      merged: true,
      verification: JSON.parse(verifiedRaw),
      milestone7Assessment: JSON.parse(assessmentRaw),
    },
    null,
    2
  )
);
