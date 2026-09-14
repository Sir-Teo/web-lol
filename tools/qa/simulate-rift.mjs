/** Headless integration diagnostic. Mirrored Ashe lane teams are not the final role roster. */
import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const seconds = Number(process.argv[2] ?? 600);
const output = process.argv[3] ?? 'artifacts/rift-team-simulation.json';
const roster = process.argv[4] ?? 'ashe';
if (!['ashe', 'mixed', 'lanes'].includes(roster))
  throw new Error('Roster must be ashe, mixed or lanes');
if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
  throw new Error('Duration must be an integer between 1 and 3600 seconds');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { World } = await server.ssrLoadModule('/src/simulation/world.ts');
  const { createLaneMatch } = await server.ssrLoadModule('/src/simulation/lane-match.ts');
  const { NavGrid } = await server.ssrLoadModule('/src/simulation/navgrid.ts');
  const { createRift } = await server.ssrLoadModule('/src/content/rift.ts');
  const metadata = JSON.parse(await readFile('public/assets/maps/rift-nav.json', 'utf8'));
  const bytes = await readFile('public/assets/maps/rift-nav.bin');
  const layout = JSON.parse(await readFile('public/assets/maps/rift-layout.json', 'utf8'));
  const grid = new NavGrid(
    metadata,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  const battlefield = createRift(grid, layout);
  let world;
  let champions = [];
  if (roster === 'lanes') {
    world = createLaneMatch(battlefield);
    champions = world.units.filter((u) => u.kind === 'champion');
  } else {
    battlefield.initialUnits = battlefield.initialUnits.filter(
      (u) => u.kind !== 'champion' && u.kind !== 'dummy'
    );
    world = new World(true, battlefield);
    // 2 top / 1 mid / 2 bottom exercises lane combat and shared rewards. No jungler is impersonated.
    const assignment = [1, 0, 0, 2, 2];

    for (const team of ['blue', 'red']) {
      for (const [slot, lane] of assignment.entries()) {
        const home = battlefield.spawns[team];
        const position = battlefield.reachable(
          { x: home.x + (slot - 2) * 75, y: home.y },
          35,
          team
        );
        const u =
          team === 'blue' && slot === 0
            ? world.hero
            : world.spawn(
                'champion',
                team,
                position,
                roster === 'mixed' && slot === 4 ? 'lux' : 'ashe'
              );
        Object.assign(u, position, { previous: { ...position }, ai: true, lane });
        champions.push(u);
      }
    }
  }
  const samples = [];
  const deaths = [];
  const castCounts = {};
  const violations = [];
  const stationary = new Map(
    champions.map((u) => [u.id, { x: u.x, y: u.y, ticks: 0, longest: 0 }])
  );
  const start = performance.now();
  for (let tick = 0; tick < seconds * 60 && !world.winner; tick++) {
    world.step();
    for (const event of world.events) {
      if (event.tick === world.tick && event.type === 'death') deaths.push({ ...event });
      if (event.tick === world.tick && event.type === 'cast') {
        const key = `${world.unit(event.unit)?.champion ?? 'unknown'}:${event.text}`;
        castCounts[key] = (castCounts[key] ?? 0) + 1;
      }
    }
    for (const u of world.units) {
      if (
        ![u.x, u.y, u.hp, u.mana, u.maxHp, u.maxMana].every(Number.isFinite) ||
        u.hp < 0 ||
        u.hp > u.maxHp + 1e-6 ||
        u.mana < 0 ||
        u.mana > u.maxMana + 1e-6
      )
        violations.push({ tick: world.tick, unit: u.id, reason: 'Invalid position or resources' });
    }
    for (const u of champions) {
      const s = stationary.get(u.id);
      if (u.hp > 0 && Math.hypot(u.x - s.x, u.y - s.y) < 1) s.ticks++;
      else {
        s.x = u.x;
        s.y = u.y;
        s.ticks = 0;
      }
      s.longest = Math.max(s.longest, s.ticks);
    }
    if (violations.length) break;
    if (world.tick % 3600 === 0 || world.winner || world.tick === seconds * 60) {
      samples.push({
        seconds: world.time,
        units: world.units.length,
        champions: champions.map((u) => {
          const s = world.championState(u.id);
          return {
            id: u.id,
            champion: u.champion,
            team: u.team,
            lane: u.lane === null ? null : battlefield.lanes[u.lane].name,
            ai: u.ai,
            x: u.x,
            y: u.y,
            hp: u.hp,
            level: s.level,
            gold: s.gold,
            cs: s.cs,
            kills: s.kills,
            deaths: s.deaths,
            inventory: [...s.inventory],
            order: u.order,
            retreating: u.aiRetreating,
            stationarySeconds: stationary.get(u.id).ticks / 60,
          };
        }),
        structures: world.units
          .filter((u) => u.structure)
          .map((u) => ({
            id: u.id,
            team: u.team,
            role: u.structure.role,
            lane: u.structure.lane,
            hp: u.hp,
          })),
      });
      process.stderr.write(
        `Simulated ${world.time}s; ${world.units.length} units; winner ${world.winner ?? 'none'}\n`
      );
    }
  }
  if (
    world.winner &&
    !world.units.some((u) => u.kind === 'nexus' && u.team !== world.winner && u.hp === 0)
  )
    violations.push({ tick: world.tick, reason: 'Victory without a destroyed opposing Nexus' });
  const snapshot = world.snapshot();
  let restoredEqual = false;
  try {
    const restored = World.fromSnapshot(snapshot, battlefield);
    restoredEqual = restored.snapshot() === snapshot;
    if (!restoredEqual)
      violations.push({ tick: world.tick, reason: 'Checkpoint round trip changed state' });
  } catch (error) {
    violations.push({ tick: world.tick, reason: 'Checkpoint rejected', message: error.message });
  }
  const report = {
    fixture:
      roster === 'lanes'
        ? 'Actual local lane-match factory: idle human Ashe and nine bots, Lux mid, 2 top / 1 mid / 2 bottom. The idle human intentionally creates an asymmetric stress case; not a representative player match.'
        : `Ten automated champions (${roster === 'mixed' ? 'eight Ashe, two Lux' : 'ten Ashe'}), 2 top / 1 mid / 2 bottom per team, source Rift, ordinary starting resources. Diagnostic only: no jungle roles or complete roster.`,
    castCounts,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    worktree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
    requestedSeconds: seconds,
    simulatedSeconds: world.time,
    wallSeconds: (performance.now() - start) / 1000,
    winner: world.winner,
    violations,
    restoredEqual,
    snapshotSHA256: createHash('sha256').update(snapshot).digest('hex'),
    longestStationary: champions.map((u) => ({
      id: u.id,
      seconds: stationary.get(u.id).longest / 60,
    })),
    samples,
    deaths,
  };
  await mkdir(new URL('../../artifacts/', import.meta.url), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await writeFile(output.replace(/\.json$/, '') + '.snapshot.json', snapshot);
  process.stdout.write(
    `${JSON.stringify({ output, simulatedSeconds: world.time, winner: world.winner, violations, restoredEqual })}\n`
  );
  if (violations.length) process.exitCode = 1;
} finally {
  await server.close();
}
