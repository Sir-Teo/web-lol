/** Verify the frozen dependency audit against current sources and recorded runs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { collectRulesetFiles, rulesetFingerprint } from '../ruleset-fingerprint.ts';

const audit = JSON.parse(readFileSync('docs/reference/ruleset-dependency-audit.json', 'utf8'));
assert.equal(audit.schema, 113);
assert.equal(audit.ruleset, rulesetFingerprint());
assert.deepEqual(
  audit.manifest.map((entry) => entry.file),
  collectRulesetFiles()
);
assert.equal(audit.manifest.length, 215);
assert.equal(audit.added.length, 12);
assert.deepEqual(audit.removed, []);
for (const entry of audit.manifest.concat(audit.evidence)) {
  const bytes = readFileSync(entry.file);
  assert.equal(bytes.length, entry.bytes, entry.file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
}
const units = readFileSync('.cache/ruleset-closure-unit-verified.log', 'utf8');
assert.match(units, /261 passed/);
assert.match(units, /1432 passed/);
const browser = readFileSync('.cache/ruleset-closure-browser.log', 'utf8');
assert.match(browser, /17 passed/);
const production = readFileSync('.cache/ruleset-closure-production.log', 'utf8')
  .trim()
  .split('\n')
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .find((line) => line?.result === 'passed');
assert(production);
assert.equal(production.developmentHook, false);
assert.equal(production.recordings, 32);
const watch = JSON.parse(readFileSync('artifacts/ruleset-closure-watch-verified2.json', 'utf8'));
assert.equal(watch.productionRuleset, audit.ruleset);
assert.equal(watch.stages.length, 6);
assert.equal(new Set(watch.stages.map((stage) => stage.ruleset)).size, 5);
assert.equal(watch.stages[4].ruleset, watch.stages[5].ruleset);
assert.deepEqual(
  watch.stages.map((stage) => stage.pose),
  [100, 200, 201, 300, 400, 400]
);
assert.equal(
  audit.prior.ruleset,
  '986b6995d2dcb0bd430f25d15d0b08f7261c50a3ff3dc19d64caffa6733bcaf1'
);
assert.equal(audit.prior.files, 203);
assert.notEqual(audit.ruleset, audit.prior.ruleset);
console.log(
  JSON.stringify({
    result: 'passed',
    schema: audit.schema,
    ruleset: audit.ruleset,
    manifestFiles: audit.manifest.length,
    newlyCoveredInputs: audit.added.length,
    unitChecks: 1432,
    browserCases: 17,
    isolatedWatchStages: 6,
    production: 'passed',
  })
);
