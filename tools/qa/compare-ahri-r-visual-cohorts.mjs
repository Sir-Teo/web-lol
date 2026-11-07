/** Compare complete archived states while excluding only the new R observation field. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [before, after, output] = process.argv.slice(2);
assert(
  before && after && output && process.argv.length === 5 && !existsSync(output),
  'Pass pre-observer cohort, R observer cohort and fresh output'
);
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const read = (path) => JSON.parse(readFileSync(path));
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])])
        )
      : value;
const project = (state) => {
  const copy = structuredClone(state);
  delete copy.version;
  delete copy.ruleset;
  delete copy.ahriRVisuals;
  return JSON.stringify(canonical(copy));
};
const cohorts = [before, after].map((directory) => {
  const root = resolve(directory);
  execFileSync(process.execPath, ['tools/qa/verify-match-cohort.mjs', root, '--historical'], {
    stdio: 'pipe',
  });
  const plan = read(resolve(root, 'plan.json'));
  assert.equal(plan.runtime.node, process.version);
  assert.equal(plan.runtime.v8, process.versions.v8);
  assert.equal(plan.developmentRoster, true);
  assert.deepEqual(plan.seeds, [1]);
  return { root, plan, report: read(resolve(root, 'seeds/1/report.json')) };
});
assert.equal(
  cohorts[0].plan.ruleset,
  'd625c0ee280a60649bf4516454b529fc1da780ed163f7bf4989c2dd21515a1f4'
);
assert.notEqual(cohorts[0].plan.ruleset, cohorts[1].plan.ruleset);
for (const field of [
  'winner',
  'outcome',
  'finalTick',
  'checkedTicks',
  'roundTrips',
  'futureChecks',
  'futureCheckedTicks',
])
  assert.equal(cohorts[0].report[field], cohorts[1].report[field], field);
const states = cohorts.map(({ root, plan, report }, index) => {
  const rows = [...report.checkpoints, { tick: report.finalTick, path: report.finalPath }];
  return rows.map((row) => {
    const path = resolve(row.path),
      inside = relative(root, path);
    assert(inside && !inside.startsWith('..') && !isAbsolute(inside), 'Snapshot escapes archive');
    const raw = readFileSync(path);
    if (row.fileSha256) assert.equal(hash(raw), row.fileSha256);
    const state = JSON.parse(raw);
    assert.equal(state.tick, row.tick);
    assert.equal(state.version, index === 0 ? 180 : 181);
    assert.equal(state.ruleset, plan.ruleset);
    return { tick: row.tick, sha256: hash(project(state)), fileSha256: hash(raw) };
  });
});
assert.deepEqual(
  states[0].map(({ tick, sha256 }) => ({ tick, sha256 })),
  states[1].map(({ tick, sha256 }) => ({ tick, sha256 }))
);
const record = {
  format: 1,
  result: 'passed',
  producerSha256: hash(readFileSync(import.meta.filename)),
  runtime: { node: process.version, v8: process.versions.v8 },
  excludedFields: ['version', 'ruleset', 'ahriRVisuals'],
  cohorts: cohorts.map(({ root, plan, report }, index) => ({
    path: root,
    sourceRevision: plan.sourceRevision,
    ruleset: plan.ruleset,
    sourceFiles: plan.sources.length,
    planSha256: hash(readFileSync(resolve(root, 'plan.json'))),
    runner: plan.runner,
    finalTick: report.finalTick,
    projections: states[index],
  })),
  completeProjectionMatches: states[0].length,
  limits: [
    'One development-roster seed; no native-client or hundred-seed claim.',
    'All existing E/W/Q observations, every audio history and all gameplay fields remain in each complete projection.',
  ],
};
writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ result: 'passed', completeProjectionMatches: states[0].length }));
