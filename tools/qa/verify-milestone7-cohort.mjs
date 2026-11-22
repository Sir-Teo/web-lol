/** Evaluate the Milestone 7 victory gate after independent cohort verification. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function assessVerifiedCohort(verification) {
  const { seeds, victories, unfinished } = verification;
  assert.equal(verification.result, 'passed', 'Cohort invariants did not pass');
  assert.equal(verification.publicRosterVerified, true, 'Public roster was not verified');
  assert.equal(verification.hundredSeedInvariantGate, true, 'Hundred-seed invariants did not pass');
  assert.equal(verification.horizonTicks, 216000, 'Expected a 60-minute horizon');
  assert(Number.isSafeInteger(seeds) && seeds >= 100, 'Expected at least 100 seeds');
  assert(Number.isSafeInteger(victories) && victories >= 0, 'Invalid victory count');
  assert(Number.isSafeInteger(unfinished) && unfinished >= 0, 'Invalid unfinished count');
  assert.equal(victories + unfinished, seeds, 'Cohort outcomes do not account for every seed');
  const naturalVictoryRate = victories / seeds;
  const meetsVictoryThreshold = naturalVictoryRate >= 0.99 && unfinished <= 1;
  return {
    result: !meetsVictoryThreshold
      ? 'failed'
      : unfinished === 1
        ? 'awaiting-stalemate-review'
        : 'passed',
    ruleset: verification.ruleset,
    seeds,
    victories,
    unfinished,
    naturalVictoryRate,
    meetsVictoryThreshold,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 3, 'Pass one completed public cohort directory');
  const verifier = fileURLToPath(new URL('./verify-match-cohort.mjs', import.meta.url));
  const verified = execFileSync(
    process.execPath,
    [verifier, resolve(process.argv[2]), '--public-roster'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const assessment = assessVerifiedCohort(JSON.parse(verified));
  console.log(JSON.stringify(assessment));
  if (assessment.result !== 'passed') process.exitCode = 1;
}
