/** Diagnostic replay: bridge only a pinned checkpoint's ruleset identity. No migration. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { World } from '../../src/simulation/world';
import { NavGrid } from '../../src/simulation/navgrid';
import { createRift } from '../../src/content/rift';
declare const __SIMULATION_HASH__: string;
const [sourceDirectory, outputFile] = process.argv.slice(2);
if (!sourceDirectory || !outputFile || existsSync(outputFile))
  throw new Error('Pass a frozen cohort and fresh report path.');
const root = resolve(sourceDirectory),
  plan = JSON.parse(readFileSync(`${root}/plan.json`, 'utf8'));
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const pin of [plan.runner, ...plan.inputs])
  assert.equal(sha(readFileSync(pin.file)), pin.sha256);
const nav = readFileSync(`${root}/maps/rift-nav.bin`);
const battlefield = () =>
  createRift(
    new NavGrid(
      JSON.parse(readFileSync(`${root}/maps/rift-nav.json`, 'utf8')),
      nav.buffer.slice(nav.byteOffset, nav.byteOffset + nav.byteLength)
    ),
    JSON.parse(readFileSync(`${root}/maps/rift-layout.json`, 'utf8'))
  );
const cases = [];
for (const seed of [3, 5]) {
  const failed = JSON.parse(readFileSync(`${root}/seeds/${seed}/report.json`, 'utf8'));
  assert.equal(failed.outcome, 'failed');
  const checkpoint = failed.checkpoints.at(-1);
  const bytes = readFileSync(checkpoint.path);
  assert.equal(sha(bytes), checkpoint.fileSha256);
  const input = JSON.parse(bytes.toString());
  assert.equal(input.ruleset, plan.ruleset);
  // Explicit test-only compatibility bridge; source bytes remain untouched.
  input.ruleset = __SIMULATION_HASH__;
  const world = World.fromSnapshot(JSON.stringify(input), battlefield());
  const original = JSON.parse(readFileSync(failed.finalPath, 'utf8'));
  assert.equal(original.ruleset, plan.ruleset);
  original.ruleset = __SIMULATION_HASH__;
  assert.throws(() => World.fromSnapshot(JSON.stringify(original), battlefield()), {
    message: failed.failure.message,
  });
  world.step(failed.finalTick - world.tick);
  assert.equal(world.tick, failed.finalTick);
  assert.equal(world.winner, failed.winner);
  const saved = world.snapshot(),
    restored = World.fromSnapshot(saved, battlefield());
  assert.equal(restored.snapshot(), saved);
  const boundarySnapshotPath = `${outputFile}.seed-${seed}.match.json`;
  assert(!existsSync(boundarySnapshotPath));
  writeFileSync(boundarySnapshotPath, saved + '\n');
  const actual = JSON.parse(saved),
    changes: { path: string; before: unknown; after: unknown }[] = [];
  function compare(before: unknown, after: unknown, path = '') {
    if (path === 'ruleset' || before === after) return;
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      const a = before as Record<string, unknown>,
        b = after as Record<string, unknown>;
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        compare(a[key], b[key], path ? `${path}.${key}` : key);
    } else changes.push({ path, before, after });
  }
  compare(original, actual);
  if (seed === 3) {
    assert.equal(changes.length, 1);
    assert.match(changes[0].path, /\.redBuff\.nextRegenTick$/);
    assert.equal(changes[0].before, world.tick);
    assert.equal(changes[0].after, world.tick + 30);
  } else {
    assert.equal(changes.length, 1);
    assert.match(changes[0].path, /^units\.\d+\.slowUntil$/);
    assert.equal(changes[0].after, 0);
  }
  world.step(120);
  restored.step(120);
  assert.equal(restored.snapshot(), world.snapshot());
  cases.push({
    seed,
    input: checkpoint,
    oldFailure: failed.failure.message,
    originalTick: failed.finalTick,
    originalWinner: failed.winner,
    newTickAtBoundary: actual.tick,
    newWinnerAtBoundary: actual.winner,
    canonicalChanges: changes,
    roundTripExact: true,
    futureTicks: world.tick - actual.tick,
    futureExact: true,
    boundarySnapshotSha256: sha(saved),
    boundarySnapshotPath,
  });
}
const report = {
  sourceRuleset: plan.ruleset,
  targetRuleset: __SIMULATION_HASH__,
  scope:
    'Only the pinned last valid checkpoints of seeds 3 and 5; ruleset identity bridged for diagnostics, no production migration or decoder relaxation.',
  cases,
};
writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
