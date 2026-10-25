/** Frozen QA tooling, development support corpus and passive diagnosis. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, relative } from 'node:path';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/rift-cohort-verification.json');
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(digest(row.archived), row.sha256, row.archived);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(row.file), row.sha256, row.file);
  byFile.set(row.file, row);
}
const key = (p) => (isAbsolute(p) ? relative(process.cwd(), p) : p);
const frozen = (p) => {
  const row = byFile.get(key(p));
  assert(row, p);
  return row.archived;
};
const data = (p) => json(frozen(p)),
  text = (p) => readFileSync(frozen(p), 'utf8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(ledger.schema, 129);
assert.equal(ledger.shippedChange, false);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.previousAccepted), /"result":"passed"/);
assert.match(text(ledger.checks.previousAccepted), /"historical":true/);
const base = data('docs/reference/leona/rift-trial-verification.json');
assert.equal(ledger.ruleset, base.ruleset);
assert.equal(ledger.pack, base.pack);
assert.deepEqual(ledger.generated, base.generated);
const contract = (state, development) => {
  assert.equal(state.version, 129);
  assert.equal(state.ruleset, ledger.ruleset);
  assert.equal(state.battlefield, 'rift');
  assert.equal(state.matchMode, 'lanes');
  const champions = state.units.filter((u) => u.kind === 'champion');
  assert.equal(champions.length, 10);
  assert.equal(new Set(champions.map((u) => u.id)).size, 10);
  const owners = [state.player, ...state.otherChampions];
  for (const team of ['blue', 'red'])
    assert.deepEqual(
      champions
        .filter((u) => u.team === team)
        .map((u) => owners.find((o) => o.id === u.id).role)
        .sort(),
      ['carry', 'jungle', 'mid', 'support', 'top']
    );
  const hero = champions.find((u) => u.id === state.player.id);
  assert.equal(hero.champion, development ? 'leona' : 'ashe');
  assert.equal(hero.ai, true);
  assert.equal(state.player.role, development ? 'support' : 'carry');
  assert.equal(champions.filter((u) => u.champion === 'ashe').length, 6);
  assert.equal(champions.filter((u) => u.champion === 'lux').length, development ? 3 : 4);
  assert.equal(champions.filter((u) => u.champion === 'leona').length, development ? 1 : 0);
  for (const u of state.units) {
    assert([u.x, u.y, u.hp, u.maxHp, u.mana, u.maxMana].every(Number.isFinite));
    assert(u.hp >= 0 && u.hp <= u.maxHp && u.mana >= 0 && u.mana <= u.maxMana);
  }
  const dead = state.units.filter((u) => u.kind === 'nexus' && u.hp === 0);
  if (state.winner) {
    const loser = state.winner === 'blue' ? 'red' : 'blue';
    assert.equal(dead.length, 1);
    assert.equal(dead[0].team, loser);
    const structures = state.units.filter((u) => u.team === loser && u.structure);
    assert.equal(
      structures.filter((u) => u.structure.role === 'nexus-turret' && u.hp === 0).length,
      2
    );
    assert(structures.some((u) => u.kind === 'inhibitor' && u.hp === 0));
  } else assert.equal(dead.length, 0);
};
const expected = {
  smoke: {
    development: true,
    seeds: 2,
    horizon: 36000,
    ticks: 72000,
    roundTrips: 20,
    futures: 18,
    futureTicks: 1080,
    victories: 0,
  },
  ordinary: {
    development: false,
    seeds: 1,
    horizon: 7200,
    ticks: 7200,
    roundTrips: 2,
    futures: 1,
    futureTicks: 60,
    victories: 0,
  },
  baseline60: {
    development: true,
    seeds: 2,
    horizon: 216000,
    ticks: 263858,
    roundTrips: 75,
    futures: 73,
    futureTicks: 4380,
    victories: 2,
  },
};
let ticks = 0,
  roundTrips = 0,
  futures = 0;
for (const [name, expectedRun] of Object.entries(expected)) {
  const run = ledger.checks.corpora[name],
    plan = data(run.root + '/plan.json'),
    summary = data(run.root + '/summary.json');
  assert.match(text(run.verification), /"result":"passed"/);
  assert.equal(plan.ruleset, ledger.ruleset);
  assert.equal(plan.developmentLeona, expectedRun.development);
  assert.equal(plan.qaAutomatedHumanCarry, !expectedRun.development);
  assert.equal(plan.qaAutomatedHumanRole, expectedRun.development ? 'support' : 'carry');
  assert.equal(plan.seeds.length, expectedRun.seeds);
  assert.equal(plan.horizonTicks, expectedRun.horizon);
  for (const pin of [...plan.sources, ...plan.inputs, plan.runner]) {
    const row = byFile.get(key(pin.file));
    assert(row, pin.file);
    assert.equal(row.bytes, pin.bytes);
    assert.equal(row.sha256, pin.sha256);
  }
  assert.equal(summary.status, 'completed');
  assert.equal(summary.active.length, 0);
  assert.equal(summary.completed, plan.seeds.length);
  assert.equal(summary.failures, 0);
  assert.equal(summary.victories, expectedRun.victories);
  assert.equal(summary.hundredSeedInvariantGate, false);
  assert.equal(summary.hundredSeedDevelopmentLeonaInvariantGate, false);
  assert.equal(summary.checkedTicks, expectedRun.ticks);
  assert.equal(summary.roundTrips, expectedRun.roundTrips);
  assert.equal(summary.futureChecks, expectedRun.futures);
  assert.equal(summary.futureCheckedTicks, expectedRun.futureTicks);
  for (const seed of plan.seeds) {
    const report = data(run.root + `/seeds/${seed}/report.json`);
    assert.equal(report.seed, seed);
    assert.equal(report.ruleset, ledger.ruleset);
    assert.equal(report.failure, null);
    assert.equal(report.developmentLeona, expectedRun.development);
    assert.equal(report.automatedHumanCarry, !expectedRun.development);
    assert.equal(report.automatedHumanRole, expectedRun.development ? 'support' : 'carry');
    assert.equal(report.checkedTicks, report.finalTick);
    assert.equal(report.checkpoints.length, report.roundTrips);
    for (const checkpoint of report.checkpoints) {
      const file = frozen(checkpoint.path),
        bytes = readFileSync(file);
      assert.equal(digest(file), checkpoint.fileSha256);
      assert.equal(
        createHash('sha256').update(bytes.subarray(0, -1)).digest('hex'),
        checkpoint.stateSha256
      );
      assert(!bytes.includes(Buffer.from('developmentLeona')));
      const state = JSON.parse(bytes);
      assert.equal(state.tick, checkpoint.tick);
      contract(state, expectedRun.development);
    }
    const finalBytes = readFileSync(frozen(report.finalPath)),
      final = JSON.parse(finalBytes);
    assert.equal(
      createHash('sha256').update(finalBytes.subarray(0, -1)).digest('hex'),
      report.finalStateSha256
    );
    contract(final, expectedRun.development);
    assert.equal(final.tick, report.finalTick);
    assert.equal(final.winner, report.winner);
    if (name === 'baseline60') {
      assert.equal(report.outcome, 'victory');
      assert.equal(report.winner, 'red');
      assert.equal(report.finalTick, seed === 26018 ? 115729 : 148129);
      assert.equal(final.player.deaths, seed === 26018 ? 12 : 16);
      assert.equal(final.player.kills, 0);
    } else {
      assert.equal(report.outcome, 'unfinished');
      assert.equal(report.finalTick, plan.horizonTicks);
    }
    ticks += report.checkedTicks;
    roundTrips += report.roundTrips;
    futures += report.futureChecks;
  }
}
assert.equal(ticks, 343058);
assert.equal(roundTrips, 97);
assert.equal(futures, 92);
const diagnostic = data(ledger.checks.diagnostic);
assert.equal(diagnostic.observationallyIdentical, true);
assert.equal(diagnostic.tick, 6944);
assert.equal(diagnostic.damage.length, 59);
assert.equal(diagnostic.damage.at(-1).hpAfter, 0);
assert(diagnostic.damage.every((d) => ['champion', 'caster'].includes(d.source.kind)));
assert.equal(JSON.parse(diagnostic.snapshot).ruleset, ledger.ruleset);
assert(ledger.acceptance.toolingIntegrated && ledger.acceptance.developmentTwoSeedBaselineVerified);
for (const field of [
  'hundredSeedGate',
  'supportPolicyAccepted',
  'nativeComparisonVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[field], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    shippedChange: false,
    corpora: 3,
    checkedTicks: ticks,
    roundTrips,
    futureChecks: futures,
    hundredSeedGate: false,
    supportPolicyAccepted: false,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
