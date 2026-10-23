/** Frozen headless role audit. Normal rules, no forced winner; retain failures
 * and unfinished horizons. Rendering and natural human play are separate gates. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRift } from '../../src/content/rift';
import { NavGrid } from '../../src/simulation/navgrid';
import { createLaneMatch } from '../../src/simulation/lane-match';
import { World } from '../../src/simulation/world';
import { distance } from '../../src/simulation/math';
import type { TeamGoalKind } from '../../src/simulation/bot-team';
const seeds = process.argv.slice(2).map(Number);
if (!seeds.length || seeds.some((s) => !Number.isInteger(s) || s <= 0 || s > 0xffffffff))
  throw Error('Pass positive uint32 seeds.');
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const folder = `.cache/role-match-audit/${__SIMULATION_HASH__.slice(0, 12)}`;
mkdirSync(folder, { recursive: true });
const kinds = ['defend', 'push', 'gank', 'river'] as const;
const counts = () => Object.fromEntries(kinds.map((k) => [k, 0])) as Record<TeamGoalKind, number>;
for (const seed of seeds) {
  const w = createLaneMatch(rift);
  w.random.state = seed;
  w.hero.ai = true;
  w.hero.lane = rift.lanes.findIndex((l) => l.name === 'bot');
  const start = performance.now(),
    samples = [],
    goalTicks = counts(),
    attackTicks = counts(),
    arrivedTicks = counts(),
    riverClaims = { blue: 0, red: 0 };
  const structures = w.units.filter((u) => u.structure),
    destroyed = new Set<number>(),
    destruction = [];
  let checkedTicks = 0,
    failure: string | null = null;
  try {
    for (let minute = 1; minute <= 60 && !w.winner; minute++) {
      for (let t = 0; t < 3600 && !w.winner; t++) {
        w.step();
        checkedTicks++;
        for (const u of w.units)
          if (
            ![u.x, u.y, u.hp, u.maxHp, u.mana, u.maxMana].every(Number.isFinite) ||
            u.hp < 0 ||
            u.hp > u.maxHp ||
            u.mana < 0 ||
            u.mana > u.maxMana
          )
            throw Error(`Invalid unit ${u.id} at tick ${w.tick}`);
        for (const s of structures)
          if (!w.alive(s) && !destroyed.has(s.id)) {
            destroyed.add(s.id);
            destruction.push({
              tick: w.tick,
              id: s.id,
              team: s.team,
              role: s.structure!.role,
              lane: s.structure!.lane,
            });
          }
        for (const team of ['blue', 'red'] as const)
          for (const g of w.teamPlans![team].assignments) {
            const u = w.unit(g.unitId)!;
            if (!w.alive(u)) continue;
            goalTicks[g.kind]++;
            if (u.attackTarget === g.targetId) attackTicks[g.kind]++;
            if (distance(u, g.point) <= 1000) arrivedTicks[g.kind]++;
          }
        for (const shrine of w.scuttlers!.shrines)
          if (shrine.startTick === w.tick) riverClaims[shrine.team]++;
      }
      const raw = w.snapshot();
      if (World.fromSnapshot(raw, rift).snapshot() !== raw)
        throw Error(`Checkpoint mismatch at ${w.tick}`);
      const sample = {
        minute,
        tick: w.tick,
        winner: w.winner,
        units: w.units.length,
        down: w.units.filter((u) => u.structure && !w.alive(u)).length,
        goalTicks: { ...goalTicks },
        attackTicks: { ...attackTicks },
        riverClaims: { ...riverClaims },
        champions: w.units
          .filter((u) => u.kind === 'champion')
          .map((u) => {
            const s = w.championState(u.id)!;
            return {
              id: u.id,
              team: u.team,
              role: s.role,
              level: s.level,
              cs: s.cs,
              kills: s.kills,
              deaths: s.deaths,
              gold: Math.floor(s.gold),
              x: Math.round(u.x),
              y: Math.round(u.y),
              order: u.order,
            };
          }),
      };
      samples.push(sample);
      if (minute % 5 === 0 || w.winner)
        console.log(
          JSON.stringify({
            seed,
            minute,
            tick: w.tick,
            winner: w.winner,
            down: sample.down,
            units: sample.units,
            goalTicks,
            attackTicks,
            riverClaims,
            elapsedSeconds: (performance.now() - start) / 1000,
          })
        );
    }
    if (w.winner) {
      const enemy = w.winner === 'blue' ? 'red' : 'blue',
        base = w.units.filter((u) => u.team === enemy && u.structure);
      if (
        !base.some((u) => u.kind === 'nexus' && !w.alive(u)) ||
        base.filter((u) => u.structure!.role === 'nexus-turret' && !w.alive(u)).length !== 2 ||
        !base.some((u) => u.kind === 'inhibitor' && !w.alive(u))
      )
        throw Error('Invalid victory structure state');
    }
  } catch (error) {
    failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
  }
  let snapshotPath = `${folder}/${seed}.match.json`,
    snapshotHash: string | null = null;
  try {
    const raw = w.snapshot();
    writeFileSync(snapshotPath, raw + '\n');
    snapshotHash = createHash('sha256').update(raw).digest('hex');
  } catch {
    snapshotPath = `${folder}/${seed}.invalid-state.json`;
    writeFileSync(
      snapshotPath,
      JSON.stringify(
        {
          tick: w.tick,
          units: w.units,
          champions: w.units.filter((u) => u.kind === 'champion').map((u) => w.championState(u.id)),
          teamPlans: w.teamPlans,
          jungleCamps: w.jungleCamps,
          scuttlers: w.scuttlers,
        },
        (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v),
        2
      ) + '\n'
    );
  }
  const report = {
    seed,
    ruleset: __SIMULATION_HASH__,
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    },
    automatedHumanCarry: true,
    horizonTicks: 216000,
    winner: w.winner,
    finalTick: w.tick,
    checkedTicks,
    failure,
    elapsedSeconds: (performance.now() - start) / 1000,
    snapshotPath,
    finalSnapshotSha256: snapshotHash,
    goalTicks,
    attackTicks,
    arrivedTicks,
    riverClaims,
    destruction,
    samples,
  };
  writeFileSync(`${folder}/${seed}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      seed,
      done: true,
      winner: w.winner,
      tick: w.tick,
      failure,
      elapsedSeconds: report.elapsedSeconds,
      reportPath: `${folder}/${seed}.json`,
    })
  );
  if (failure) {
    process.exitCode = 1;
    break;
  }
}
