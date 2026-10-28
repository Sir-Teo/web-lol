/** Read-only verification of a completed, frozen cohort. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
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
if (plan.sourceArchive) {
  const archive = resolve(plan.sourceArchive),
    delta = relative(root, archive);
  assert(delta && !delta.startsWith('..') && !isAbsolute(delta), 'Archive escapes cohort');
  for (const pin of plan.sources) {
    const file = resolve(archive, pin.file),
      inside = relative(archive, file);
    assert(inside && !inside.startsWith('..') && !isAbsolute(inside), 'Source escapes archive');
    const bytes = readFileSync(file);
    assert.equal(bytes.length, pin.bytes, pin.file);
    assert.equal(hash(bytes), pin.sha256, pin.file);
  }
}
if (!historical) assert.equal(rulesetFingerprint(), plan.ruleset);
assert.equal(summary.ruleset, plan.ruleset);
const developmentLeona = plan.developmentLeona === undefined ? false : plan.developmentLeona;
const developmentRoster = plan.developmentRoster === undefined ? false : plan.developmentRoster;
assert.equal(typeof developmentLeona, 'boolean');
assert.equal(typeof developmentRoster, 'boolean');
assert(!(developmentLeona && developmentRoster), 'Development profiles are exclusive');
if (developmentLeona) {
  assert.equal(plan.qaAutomatedHumanCarry, false);
  assert.equal(plan.qaAutomatedHumanRole, 'support');
  assert.equal(plan.roster, 'six Ashe/three Lux/one Leona; five roles per team');
  assert.equal(summary.hundredSeedInvariantGate, false);
}
if (developmentRoster) {
  assert.equal(plan.qaAutomatedHumanCarry, false);
  assert.equal(plan.qaAutomatedHumanRole, 'mid');
  assert.equal(
    plan.roster,
    'two Garen/two Master Yi/two Ashe/two Leona/one Ahri/one Lux; five roles per team'
  );
  assert.equal(summary.hundredSeedInvariantGate, false);
}
function verifyComposition(state) {
  if (!developmentRoster) return;
  const owners = new Map([state.player, ...state.otherChampions].map((p) => [p.id, p]));
  const champions = state.units.filter((u) => u.kind === 'champion');
  assert.equal(state.player.role, 'mid');
  assert.equal(champions.find((u) => u.id === state.player.id).champion, 'lux');
  for (const team of ['blue', 'red']) {
    const members = champions.filter((u) => u.team === team);
    assert.equal(members.length, 5);
    assert.deepEqual(members.map((u) => owners.get(u.id).role).sort(), [
      'carry',
      'jungle',
      'mid',
      'support',
      'top',
    ]);
    for (const [role, identity] of Object.entries({
      top: 'garen',
      jungle: 'masteryi',
      mid: team === 'blue' ? 'lux' : 'ahri',
      carry: 'ashe',
      support: 'leona',
    }))
      assert.equal(members.find((u) => owners.get(u.id).role === role).champion, identity);
  }
}
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
  assert.equal(report.developmentLeona ?? false, developmentLeona);
  assert.equal(report.developmentRoster ?? false, developmentRoster);
  assert.equal(report.automatedHumanCarry, !developmentLeona && !developmentRoster);
  if (report.automatedHumanRole !== undefined)
    assert.equal(
      report.automatedHumanRole,
      developmentRoster ? 'mid' : developmentLeona ? 'support' : 'carry'
    );
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
    verifyComposition(state);
    assert.equal(state.tick, checkpoint.tick);
    assert.equal(state.ruleset, plan.ruleset);
    if (developmentLeona) {
      assert.equal(state.player.role, 'support');
      assert.equal(state.units.find((u) => u.id === state.player.id).champion, 'leona');
      assert.equal(state.units.filter((u) => u.champion === 'leona').length, 1);
      assert.equal(state.units.filter((u) => u.champion === 'ashe').length, 6);
      assert.equal(state.units.filter((u) => u.champion === 'lux').length, 3);
    }
    const states = new Map([state.player, ...state.otherChampions].map((r) => [r.id, r]));
    assertMatchResources({ ...state, championState: (id) => states.get(id) });
    assertMatchVictory(state);
  }
  const final = readFileSync(report.finalPath);
  assert.equal(hash(final.subarray(0, -1)), report.finalStateSha256);
  const state = JSON.parse(final);
  verifyComposition(state);
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
const fullInvariantGate = plan.horizonTicks === 60 * 3600 && plan.seeds.length >= 100;
assert.equal(
  summary.hundredSeedInvariantGate,
  !developmentLeona && !developmentRoster && fullInvariantGate
);
assert.equal(
  summary.hundredSeedDevelopmentLeonaInvariantGate ?? false,
  developmentLeona && fullInvariantGate
);
assert.equal(
  summary.hundredSeedDevelopmentRosterInvariantGate ?? false,
  developmentRoster && fullInvariantGate
);
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
    developmentLeona,
    developmentRoster,
    hundredSeedInvariantGate: summary.hundredSeedInvariantGate,
    hundredSeedDevelopmentLeonaInvariantGate:
      summary.hundredSeedDevelopmentLeonaInvariantGate ?? false,
    hundredSeedDevelopmentRosterInvariantGate:
      summary.hundredSeedDevelopmentRosterInvariantGate ?? false,
    roadmapMilestone4Complete: false,
  })
);
