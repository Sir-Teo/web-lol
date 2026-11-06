/** Compare complete archived gameplay states; never restore or bridge rulesets. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const BASELINE = '29c2a12a505226c8ff21841d99e1d07ac50cb32239f4f191978b46d5a901712d';
const inside = (root, name) => {
  const file = resolve(root, name),
    delta = relative(root, file);
  assert(delta && !delta.startsWith('..') && !isAbsolute(delta), 'Archived path escapes its root');
  return file;
};
export function attackGameplayProjection(raw, schema) {
  const state = JSON.parse(raw);
  assert.equal(state.version, schema, 'Unexpected snapshot schema');
  if (schema === 173)
    assert(
      !('ahriAttackAudio' in state) ||
        (Array.isArray(state.ahriAttackAudio) && state.ahriAttackAudio.length > 0),
      'Invalid optional attack history'
    );
  else assert(!('ahriAttackAudio' in state), 'Baseline contains new attack history');
  delete state.version;
  delete state.ruleset;
  delete state.ahriAttackAudio;
  return JSON.stringify(state);
}
function readArchive(directory, seed) {
  const root = resolve(directory),
    planRaw = readFileSync(resolve(root, 'plan.json'));
  const plan = JSON.parse(planRaw);
  assert(
    plan.developmentRoster &&
      !plan.developmentLeona &&
      plan.qaAutomatedHumanRole === 'mid' &&
      plan.qaAutomatedHumanCarry === false,
    'Wrong roster profile'
  );
  assert(plan.seeds.includes(seed), 'Seed absent from plan');
  const archive = inside(root, plan.sourceArchive);
  for (const row of plan.sources) {
    const raw = readFileSync(inside(archive, row.file));
    assert.equal(raw.length, row.bytes, 'Frozen source extent differs');
    assert.equal(hash(raw), row.sha256, 'Frozen source hash differs');
  }
  for (const row of plan.inputs) {
    const raw = readFileSync(inside(root, relative(root, resolve(row.file))));
    assert.equal(raw.length, row.bytes, 'Battlefield input extent differs');
    assert.equal(hash(raw), row.sha256, 'Battlefield input hash differs');
  }
  const runner = readFileSync(inside(root, relative(root, resolve(plan.runner.file))));
  assert.equal(runner.length, plan.runner.bytes, 'Runner extent differs');
  assert.equal(hash(runner), plan.runner.sha256, 'Runner hash differs');
  const seedRoot = inside(root, `seeds/${seed}`),
    reportRaw = readFileSync(resolve(seedRoot, 'report.json'));
  const report = JSON.parse(reportRaw);
  assert.equal(report.seed, seed);
  assert.equal(report.ruleset, plan.ruleset);
  assert.equal(report.outcome, 'victory');
  assert.equal(report.failure, null);
  assert(
    report.finalTick > 0 && report.finalTick <= plan.horizonTicks,
    'Final tick outside horizon'
  );
  assert.equal(report.checkedTicks, report.finalTick, 'Checked gameplay ticks differ');
  assert(report.roundTrips > 0 && report.futureChecks > 0, 'Missing restoration checks');
  const rows = [
    ...report.checkpoints,
    { tick: report.finalTick, path: report.finalPath, stateSha256: report.finalStateSha256 },
  ];
  const states = rows.map((row, index) => {
    const terminalCopy =
      index === rows.length - 1 && index > 0 && row.tick === rows[index - 1].tick;
    assert(
      index === 0 || row.tick > rows[index - 1].tick || terminalCopy,
      'Non-increasing checkpoint ticks'
    );
    if (terminalCopy)
      assert.equal(
        row.stateSha256,
        rows[index - 1].stateSha256,
        'Final copy differs from terminal checkpoint'
      );
    const path = resolve(seedRoot, basename(row.path)),
      raw = readFileSync(path);
    assert.equal(raw.at(-1), 10, 'Archived newline differs');
    assert.equal(hash(raw.subarray(0, -1)), row.stateSha256, 'Saved state hash differs');
    if (row.fileSha256) assert.equal(hash(raw), row.fileSha256, 'Checkpoint file hash differs');
    const state = JSON.parse(raw);
    assert.equal(state.ruleset, plan.ruleset);
    assert.equal(state.tick, row.tick);
    assert.equal(
      state.winner,
      row.tick === report.finalTick ? report.winner : null,
      'Checkpoint victory differs'
    );
    return { tick: row.tick, file: basename(path), raw, state, fileSha256: hash(raw) };
  });
  return { root, plan, report, states, planSha256: hash(planRaw), reportSha256: hash(reportRaw) };
}
export function compareAttackGameplay(referenceDirectory, candidateDirectory, seed) {
  assert(Number.isSafeInteger(seed) && seed >= 0, 'Invalid seed');
  const reference = readArchive(referenceDirectory, seed),
    candidate = readArchive(candidateDirectory, seed);
  assert.equal(reference.plan.ruleset, BASELINE, 'Wrong frozen gameplay baseline');
  assert(/^[a-f0-9]{64}$/.test(candidate.plan.ruleset) && candidate.plan.ruleset !== BASELINE);
  for (const key of ['horizonTicks', 'roster', 'runtime'])
    assert.deepEqual(candidate.plan[key], reference.plan[key], `Plan ${key} differs`);
  const mapPins = (plan) => plan.inputs.map((row) => ({ ...row, file: basename(row.file) }));
  assert.deepEqual(mapPins(candidate.plan), mapPins(reference.plan), 'Battlefield inputs differ');
  assert.equal(candidate.report.winner, reference.report.winner);
  assert.equal(candidate.report.finalTick, reference.report.finalTick);
  assert.deepEqual(
    candidate.states.map((s) => s.tick),
    reference.states.map((s) => s.tick)
  );
  const samples = candidate.states.map((state, index) => {
    const a = attackGameplayProjection(reference.states[index].raw, 172),
      b = attackGameplayProjection(state.raw, 173);
    assert.equal(hash(b), hash(a), `Gameplay differs at tick ${state.tick}`);
    return {
      tick: state.tick,
      file: state.file,
      gameplaySha256: hash(a),
      referenceFileSha256: reference.states[index].fileSha256,
      candidateFileSha256: state.fileSha256,
      attackRecords: state.state.ahriAttackAudio?.length ?? 0,
    };
  });
  const describe = (r) => ({
    root: r.root,
    ruleset: r.plan.ruleset,
    sourceRevision: r.plan.sourceRevision,
    sourceFiles: r.plan.sources.length,
    planSha256: r.planSha256,
    reportSha256: r.reportSha256,
  });
  return {
    format: 1,
    result: 'passed',
    seed,
    winner: candidate.report.winner,
    finalTick: candidate.report.finalTick,
    reference: describe(reference),
    candidate: describe(candidate),
    samples,
    excludedRootFields: ['version', 'ruleset', 'ahriAttackAudio'],
    limitation:
      'One seed and archived checkpoints only; no native behavior certification or 100-seed milestone claim.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [reference, candidate, seed, output] = process.argv.slice(2);
  assert(
    reference && candidate && seed && output,
    'Pass reference root, candidate root, seed and fresh output path'
  );
  const result = compareAttackGameplay(reference, candidate, Number(seed));
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: result.result,
      seed: result.seed,
      samples: result.samples.length,
      finalTick: result.finalTick,
    })
  );
}
