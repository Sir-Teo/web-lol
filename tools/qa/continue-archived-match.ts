/** Compiled only against an explicitly verified archived source tree. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
// @ts-expect-error Resolved by the archive-only controller plugin.
import { World } from 'archived-world';
// @ts-expect-error Resolved by the archive-only controller plugin.
import { NavGrid } from 'archived-navgrid';
// @ts-expect-error Resolved by the archive-only controller plugin.
import { createRift } from 'archived-rift';
// @ts-expect-error Resolved by the archive-only controller plugin.
import {
  assertMatchResources,
  assertMatchVictory,
  observeStructureDamage,
} from 'archived-contract';
declare const __SIMULATION_HASH__: string;
const job = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
const raw = readFileSync(job.snapshot);
if (sha(raw) !== job.snapshotSha256 || raw.at(-1) !== 10) throw Error('Archived snapshot changed');
const nav = readFileSync(resolve(job.data, 'rift-nav.bin'));
function battlefield() {
  return createRift(
    new NavGrid(
      JSON.parse(readFileSync(resolve(job.data, 'rift-nav.json'), 'utf8')),
      nav.buffer.slice(nav.byteOffset, nav.byteOffset + nav.byteLength)
    ),
    JSON.parse(readFileSync(resolve(job.data, 'rift-layout.json'), 'utf8'))
  );
}
const initial = raw.subarray(0, -1).toString(),
  world = World.fromSnapshot(initial, battlefield());
if (
  world.snapshot() !== initial ||
  world.winner ||
  world.tick !== job.startTick ||
  JSON.parse(initial).ruleset !== __SIMULATION_HASH__
)
  throw Error('Archive continuation did not restore exactly');
observeStructureDamage(world, () => {});
assertMatchResources(world);
assertMatchVictory(world);
const checkpoints: object[] = [];
let checkedTicks = 0,
  roundTrips = 0,
  futureChecks = 0,
  futureCheckedTicks = 0;
let probe: any = null,
  probeUntil = 0;
function checkpoint() {
  const saved = world.snapshot(),
    restored = World.fromSnapshot(saved, battlefield());
  if (restored.snapshot() !== saved) throw Error('Archived continuation round-trip differs');
  roundTrips++;
  const path = resolve(job.output, `${world.tick}.match.json`),
    body = saved + '\n';
  writeFileSync(path, body, { flag: 'wx' });
  checkpoints.push({ tick: world.tick, path, sha256: sha(body), stateSha256: sha(saved) });
  probe = restored;
  probeUntil = world.tick + 60;
}
checkpoint();
while (world.tick < job.stopTick && !world.winner) {
  world.step();
  checkedTicks++;
  assertMatchResources(world);
  assertMatchVictory(world);
  if (probe) {
    probe.step();
    futureCheckedTicks++;
    if (probe.snapshot() !== world.snapshot())
      throw Error(`Archived future differs at ${world.tick}`);
    if (world.tick >= probeUntil || world.winner) {
      futureChecks++;
      probe = null;
    }
  }
  if (world.tick % 3600 === 0 && !world.winner) {
    checkpoint();
    console.log(
      JSON.stringify({ stage: 'archived continuation', seed: job.seed, tick: world.tick })
    );
  }
}
const final = world.snapshot(),
  finalPath = resolve(job.output, 'final.match.json');
const restored = World.fromSnapshot(final, battlefield());
if (restored.snapshot() !== final) throw Error('Final archived round-trip differs');
roundTrips++;
writeFileSync(finalPath, final + '\n', { flag: 'wx' });
const report = {
  format: 1,
  ruleset: __SIMULATION_HASH__,
  seed: job.seed,
  startTick: job.startTick,
  stopTick: job.stopTick,
  finalTick: world.tick,
  winner: world.winner,
  outcome: world.winner ? 'continued-victory' : 'continued-unfinished',
  checkedTicks,
  roundTrips,
  futureChecks,
  futureCheckedTicks,
  checkpoints,
  finalPath,
  finalStateSha256: sha(final),
  originalCohortOutcomeUnchanged: true,
};
writeFileSync(resolve(job.output, 'report.json'), JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(report));
