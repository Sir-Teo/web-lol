import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { PLAYER_CHAMPION_ROLES } from '../../src/content/champion-roles';
import { RIFT_BARON } from '../../src/content/baron';
import { createRift } from '../../src/content/rift';
import { TICK_RATE } from '../../src/content/rules';
import { createLaneMatch } from '../../src/simulation/lane-match';
import { distance } from '../../src/simulation/math';
import { NavGrid } from '../../src/simulation/navgrid';
import { World } from '../../src/simulation/world';
import { SNAPSHOT_RULESET, SNAPSHOT_VERSION } from '../../src/simulation/snapshot';
import { cohortProfile } from './lib/cohort-profile';
import { assertMatchResources, assertMatchVictory, observeStructureDamage } from './match-contract';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    minutes: { type: 'string', default: '60' },
    output: { type: 'string' },
  },
});
const [champion, seedText] = positionals;
const seed = Number(seedText);
const minutes = Number(values.minutes);
function playable(name: string | undefined): name is keyof typeof PLAYER_CHAMPION_ROLES {
  return !!name && Object.hasOwn(PLAYER_CHAMPION_ROLES, name);
}
if (
  positionals.length !== 2 ||
  !playable(champion) ||
  !Number.isInteger(seed) ||
  seed < 1 ||
  seed > 0xffffffff ||
  !Number.isInteger(minutes) ||
  minutes < 1 ||
  minutes > 120 ||
  !values.output
)
  throw new Error('Pass CHAMPION UINT32_SEED --output FRESH_DIR [--minutes 1..120].');
const output = values.output;
mkdirSync(output);
const map = 'public/assets/maps/';
const nav = Uint8Array.from(readFileSync(`${map}rift-nav.bin`));
const battlefield = {
  ...createRift(
    new NavGrid(JSON.parse(readFileSync(`${map}rift-nav.json`, 'utf8')), nav.buffer),
    JSON.parse(readFileSync(`${map}rift-layout.json`, 'utf8'))
  ),
  ...cohortProfile().permissions,
};
const role = PLAYER_CHAMPION_ROLES[champion];
const world = createLaneMatch(
  battlefield,
  champion,
  role === 'jungle' ? { d: 'smite', f: 'flash' } : undefined
);
world.random.state = seed;
assert.equal(world.hero.ai, false);
assert.equal(world.player.role, role);
// The acceptance runner controls the player slot using the normal bot policy.
world.hero.ai = true;
world.hero.lane =
  role === 'jungle'
    ? null
    : battlefield.lanes.findIndex(
        (lane) => lane.name === (role === 'support' || role === 'carry' ? 'bot' : role)
      );
if (role === 'jungle') assert.equal(world.buy('mosstomper'), null);
const clears = [];
let lastClearTick: number | null = null;
let rallySamples = 0;
let attackSamples = 0;
let structureHits = 0;
let empoweredStructureHits = 0;
let fight: { score: number; tick: number; raw: string } | null = null;
const damage = world.damage.bind(world);
world.damage = (...args) => {
  const [source, target] = args;
  const before = target.hp;
  const empowered = target.structure && world.baronEmpoweredMinion(source);
  damage(...args);
  if (empowered && target.hp < before) empoweredStructureHits++;
};
observeStructureDamage(world, () => structureHits++);

function assertRestore() {
  const raw = world.snapshot();
  assert.equal(World.fromSnapshot(raw, battlefield).snapshot(), raw);
  return raw;
}
const started = performance.now();
let failure: string | null = null;
try {
  while (!world.winner && world.tick < minutes * 60 * TICK_RATE) {
    world.step();
    const clear = world.riftBaron?.lastClear;
    if (clear && clear.tick !== lastClearTick) {
      clears.push(clear);
      lastClearTick = clear.tick;
      assertRestore();
    }
    if (world.tick % TICK_RATE !== 0) continue;
    assertMatchResources(world);
    assertMatchVictory(world);
    const goals = [...world.teamPlans!.blue.assignments, ...world.teamPlans!.red.assignments];
    if (goals.some((goal) => goal.kind === 'baron-rally')) rallySamples++;
    if (goals.some((goal) => goal.kind === 'baron')) attackSamples++;
    const id = world.riftBaron?.unitId;
    const boss = id == null ? undefined : world.unit(id);
    if (!world.winner && boss && boss.hp < boss.maxHp && world.vulnerable(boss)) {
      const near = world.units.filter(
        (unit) =>
          unit.kind === 'champion' && world.alive(unit) && distance(unit, RIFT_BARON.point) <= 1500
      );
      if (near.some((unit) => unit.team === 'blue') && near.some((unit) => unit.team === 'red')) {
        const score = near.length * 100 + Math.min(world.projectiles.length, 99);
        if (score > (fight?.score ?? 0)) fight = { score, tick: world.tick, raw: world.snapshot() };
      }
    }
  }
  assertMatchResources(world);
  assertMatchVictory(world);
  assert.ok(world.winner, `No natural victory by ${minutes} minutes.`);
  const raw = assertRestore();
  writeFileSync(`${output}/completed.match.json`, raw);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  writeFileSync(`${output}/last.match.json`, world.snapshot());
}
let contestCheckpoint = null;
if (fight) {
  writeFileSync(`${output}/contest.match.json`, fight.raw);
  contestCheckpoint = {
    tick: fight.tick,
    sha256: createHash('sha256').update(fight.raw).digest('hex'),
  };
}
const report = {
  result: failure ? 'failed' : 'passed',
  scope: 'Bot-piloted, normal 5v5 simulation; not human or graphics acceptance.',
  ruleset: SNAPSHOT_RULESET,
  version: SNAPSHOT_VERSION,
  champion,
  role,
  seed,
  tick: world.tick,
  winner: world.winner,
  wallSeconds: (performance.now() - started) / 1000,
  clears,
  rallySamples,
  attackSamples,
  structureHits,
  empoweredStructureHits,
  contestCheckpoint,
  failure,
};
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (failure) process.exitCode = 1;
