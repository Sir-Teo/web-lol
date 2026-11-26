/** Deterministic 10-champion late-match simulation profiler (Milestone 7.5). */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createRift } from '../../src/content/rift';
import { NavGrid } from '../../src/simulation/navgrid';
import { createLaneMatch } from '../../src/simulation/lane-match';
import { World } from '../../src/simulation/world';
import { cohortProfile } from './lib/cohort-profile';

const { values } = parseArgs({
  options: {
    snapshot: { type: 'string' },
    ticks: { type: 'string', default: '3600' },
    warmup: { type: 'string', default: '300' },
    seed: { type: 'string', default: '26018' },
  },
});

const profile = cohortProfile(false, false, false);
const nav = readFileSync(resolve('public/assets/maps/rift-nav.bin'));
const metadata = JSON.parse(readFileSync(resolve('public/assets/maps/rift-nav.json'), 'utf8'));
const layout = JSON.parse(readFileSync(resolve('public/assets/maps/rift-layout.json'), 'utf8'));
const battlefield = {
  ...createRift(
    new NavGrid(metadata, nav.buffer.slice(nav.byteOffset, nav.byteOffset + nav.byteLength)),
    layout
  ),
  ...profile.permissions,
};

let world: World;
let fixtureSource: string;
if (values.snapshot) {
  const path = resolve(values.snapshot);
  const raw = path.endsWith('.gz')
    ? gunzipSync(readFileSync(path)).toString('utf8').trimEnd()
    : readFileSync(path, 'utf8').trimEnd();
  world = World.fromSnapshot(raw, battlefield);
  world.hero.ai = true;
  fixtureSource = values.snapshot;
} else {
  world = createLaneMatch(battlefield, 'ashe');
  world.random.state = Number(values.seed);
  world.hero.ai = true;
  for (let i = 0; i < 60 * 60 * 20; i++) {
    world.step();
    if (world.winner) break;
  }
  fixtureSource = `generated-seed-${values.seed}-tick-${world.tick}`;
}

const warmupTicks = Number(values.warmup);
for (let i = 0; i < warmupTicks && !world.winner; i++) {
  world.step();
}

const startTick = world.tick;
const sampleCount = Number(values.ticks);
const timesMs: number[] = [];
for (let i = 0; i < sampleCount && !world.winner; i++) {
  const t0 = performance.now();
  world.step();
  timesMs.push(performance.now() - t0);
}

const sorted = [...timesMs].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
const mean = timesMs.reduce((s, v) => s + v, 0) / Math.max(1, timesMs.length);
const champions = world.units.filter((u) => u.kind === 'champion');
const activeWards = world.units.filter((u) => u.kind === 'ward').length;
const activeMinions = world.units.filter((u) => u.kind === 'minion').length;

console.log(
  JSON.stringify({
    fixtureSource,
    startTick,
    endTick: world.tick,
    measuredTicks: timesMs.length,
    distinctChampions: new Set(champions.map((c) => c.champion)).size,
    unitCountAtEnd: world.units.length,
    activeMinions,
    activeWards,
    simulationMsPerTick: {
      mean: Number(mean.toFixed(4)),
      p50: Number(pct(0.5).toFixed(4)),
      p95: Number(pct(0.95).toFixed(4)),
      p99: Number(pct(0.99).toFixed(4)),
      max: Number((sorted.at(-1) ?? 0).toFixed(4)),
    },
    budgetMsPerTickP95: 4.0,
    withinSimulationP95Budget: pct(0.95) <= 4.0,
  })
);
