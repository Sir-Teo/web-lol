/** One immutable-process normal-rules match. Never changes victory or clock rules. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { createRift } from '../../src/content/rift';
import { NavGrid } from '../../src/simulation/navgrid';
import { createLaneMatch } from '../../src/simulation/lane-match';
import { World } from '../../src/simulation/world';
import { assertMatchResources, assertMatchVictory, observeStructureDamage } from './match-contract';

declare const __SIMULATION_HASH__: string;

const { values, positionals } = parseArgs({
  options: {
    minutes: { type: 'string', default: '60' },
    output: { type: 'string' },
    data: { type: 'string', default: 'public/assets/maps' },
  },
  allowPositionals: true,
});
const seed = Number(positionals[0]),
  minutes = Number(values.minutes);
if (
  positionals.length !== 1 ||
  !Number.isInteger(seed) ||
  seed < 1 ||
  seed > 0xffffffff ||
  !Number.isInteger(minutes) ||
  minutes < 1 ||
  minutes > 120 ||
  !values.output
)
  throw new Error('Pass one uint32 seed, --minutes 1..120 and a fresh --output directory.');
const output = resolve(values.output);
if (existsSync(output)) throw new Error('Seed output already exists; retain frozen evidence.');
mkdirSync(output, { recursive: true });
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');
const nav = readFileSync(resolve(values.data!, 'rift-nav.bin'));
const metadata = readFileSync(resolve(values.data!, 'rift-nav.json'), 'utf8');
const layout = readFileSync(resolve(values.data!, 'rift-layout.json'), 'utf8');
function freshBattlefield() {
  return createRift(
    new NavGrid(
      JSON.parse(metadata),
      nav.buffer.slice(nav.byteOffset, nav.byteOffset + nav.byteLength)
    ),
    JSON.parse(layout)
  );
}
const battlefield = freshBattlefield();
const world = createLaneMatch(battlefield);
world.random.state = seed;
world.hero.ai = true; // QA automation only; the production player is unchanged.
world.hero.lane = battlefield.lanes.findIndex((lane) => lane.name === 'bot');
const started = performance.now(),
  samples: object[] = [],
  destruction: object[] = [];
const structureDamage = new Map<number, { hits: number; amount: number }>();
observeStructureDamage(world, (unit, amount) => {
  const record = structureDamage.get(unit.id) ?? { hits: 0, amount: 0 };
  record.hits++;
  record.amount += amount;
  structureDamage.set(unit.id, record);
  if (unit.hp === 0)
    destruction.push({ tick: world.tick, id: unit.id, team: unit.team, ...unit.structure });
});
let failure: { message: string; stack: string | null; cause: string | null } | null = null;
let checkedTicks = 0,
  roundTrips = 0,
  futureChecks = 0,
  futureCheckedTicks = 0;
const probe: { world: World | null; until: number } = { world: null, until: 0 };
const checkpoints: { tick: number; path: string; stateSha256: string; fileSha256: string }[] = [];
function checkpoint() {
  assertMatchVictory(world);
  const raw = world.snapshot();
  const restored = World.fromSnapshot(raw, freshBattlefield());
  if (restored.snapshot() !== raw) throw new Error(`Round-trip mismatch at tick ${world.tick}`);
  roundTrips++;
  const path = `${output}/${String(world.tick).padStart(6, '0')}.match.json`;
  const bytes = raw + '\n';
  writeFileSync(path, bytes);
  checkpoints.push({ tick: world.tick, path, stateSha256: hash(raw), fileSha256: hash(bytes) });
  probe.world = restored;
  probe.until = world.tick + 60;
  const sample = {
    tick: world.tick,
    winner: world.winner,
    units: world.units.length,
    down: world.units.filter((unit) => unit.structure && unit.hp === 0).length,
    champions: world.units
      .filter((unit) => unit.kind === 'champion')
      .map((unit) => {
        const state = world.championState(unit.id)!;
        return {
          id: unit.id,
          team: unit.team,
          champion: unit.champion,
          role: state.role,
          level: state.level,
          gold: state.gold,
          cs: state.cs,
          kills: state.kills,
          deaths: state.deaths,
          x: unit.x,
          y: unit.y,
          order: structuredClone(unit.order),
          retreating: unit.aiRetreating,
        };
      }),
  };
  samples.push(sample);
  writeFileSync(
    `${output}/progress.json`,
    JSON.stringify({
      seed,
      tick: world.tick,
      horizonTicks: minutes * 3600,
      elapsedSeconds: (performance.now() - started) / 1000,
    })
  );
  if (world.tick % 18000 === 0 || world.winner)
    console.log(
      JSON.stringify({
        seed,
        tick: world.tick,
        winner: world.winner,
        elapsedSeconds: (performance.now() - started) / 1000,
      })
    );
}
try {
  assertMatchResources(world);
  while (world.tick < minutes * 3600 && !world.winner) {
    world.step();
    checkedTicks++;
    assertMatchResources(world);
    if (probe.world) {
      probe.world.step();
      futureCheckedTicks++;
      if (world.tick >= probe.until || world.winner) {
        if (probe.world.snapshot() !== world.snapshot())
          throw new Error(`Saved future diverged at tick ${world.tick}`);
        futureChecks++;
        probe.world = null;
      }
    }
    if (world.tick % 3600 === 0 || world.winner) checkpoint();
  }
  assertMatchVictory(world);
  const terminal = world.snapshot();
  if (world.winner) {
    world.step(120);
    if (world.snapshot() !== terminal)
      throw new Error('Winning match advanced after terminal state');
  }
} catch (error) {
  failure = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? null) : null,
    cause: error instanceof Error && error.cause ? String(error.cause) : null,
  };
}
let finalPath = `${output}/final.match.json`,
  finalStateSha256: string | null = null;
try {
  const raw = world.snapshot();
  finalStateSha256 = hash(raw);
  writeFileSync(finalPath, raw + '\n');
} catch {
  failure ??= { message: 'Final checkpoint could not be encoded', stack: null, cause: null };
  finalPath = `${output}/invalid-state.json`;
  writeFileSync(
    finalPath,
    JSON.stringify(
      world,
      (key, value) => {
        if (key === 'battlefield') return { id: value.id };
        if (value instanceof Map) return [...value];
        return typeof value === 'number' && !Number.isFinite(value) ? String(value) : value;
      },
      2
    )
  );
}
const report = {
  seed,
  ruleset: __SIMULATION_HASH__,
  horizonTicks: minutes * 3600,
  outcome: failure ? 'failed' : world.winner ? 'victory' : 'unfinished',
  winner: world.winner,
  finalTick: world.tick,
  checkedTicks,
  failure,
  roundTrips,
  futureChecks,
  futureCheckedTicks,
  automatedHumanCarry: true,
  elapsedSeconds: (performance.now() - started) / 1000,
  runtime: {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
  },
  finalPath,
  finalStateSha256,
  checkpoints,
  destruction,
  structureDamage: [...structureDamage].map(([id, counts]) => ({ id, ...counts })),
  samples,
};
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    seed,
    done: true,
    outcome: report.outcome,
    winner: world.winner,
    tick: world.tick,
    failure: failure?.message ?? null,
    elapsedSeconds: report.elapsedSeconds,
  })
);
if (failure) process.exitCode = 1;
