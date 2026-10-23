/** Verify the retained local Lux E audio evidence and every referenced byte.
 * Run from the repository root after producing the documented QA artifacts. */
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const evidence = read('docs/reference/lux-e-audio-verification.json');
const audit = read('docs/reference/lux-e-audio-match-audit.json');
const refs = [
  ...evidence.files,
  ...evidence.assets,
  evidence.initialFinding.log,
  evidence.strictGuard.regressionLog,
  evidence.strictGuard.oldFrozenBundle,
  ...evidence.strictGuard.partialLogs,
  audit.runner.source,
  audit.runner.frozenBundle,
  ...audit.runs.flatMap((r) => [r.report, r.checkpoint, r.baselineReport, r.baselineCheckpoint]),
];
for (const ref of refs) assert.equal(hash(ref.path), ref.sha256, ref.path);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(evidence.ruleset, audit.ruleset);
assert.equal(evidence.schema, 109);
assert.equal(evidence.checks.chrome.exactMasterPCM, true);
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(audit.roadmap100SeedGateMet, false);
assert.equal(audit.runs.length, 4);
const decoded = read('docs/reference/lux-e-audio-decoded.json');
const graph = read('docs/reference/lux-e-audio.json');
assert.equal(decoded.sourceGraphSha256, hash('docs/reference/lux-e-audio.json'));
assert.equal(graph.extractionSha256, hash('docs/reference/lux-audio-extraction.json'));
assert.equal(graph.referenceSha256, hash('docs/reference/lux-model.json'));
assert.equal(decoded.media.length, 12);
for (const m of decoded.media) {
  const path = `public/assets/audio/lux-e-${m.id}.wav`;
  assert.equal(hash(path), m.wavSha256);
  assert.equal(statSync(path).size, m.wavBytes);
  assert.equal(m.encodedSha256, graph.media.find((v) => v.id === m.id).sha256);
  assert.equal(m.decoderMetadata.loopingInfo, null);
}
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    references: refs.length,
    sourceClips: decoded.media.length,
    checkedTicks: audit.summary.checkedTicks,
    exactRoundTrips: audit.summary.exactRoundTrips,
  })
);
