/** Build with Vite SSR, then run the frozen bundle. No accelerated economy,
 * damage, deadlines or forced wins. Unfinished 60-minute games remain evidence. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRift } from '../../src/content/rift';
import { NavGrid } from '../../src/simulation/navgrid';
import { createLaneMatch } from '../../src/simulation/lane-match';
import { World } from '../../src/simulation/world';
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
const folder = '.cache/role-match-audit';
mkdirSync(folder, { recursive: true });
for (const seed of seeds) {
  const w = createLaneMatch(rift);
  w.random.state = seed;
  // Supply the human carry's decisions through the same bot policy for this
  // automated opposing-team audit; production remains one human + nine bots.
  w.hero.ai = true;
  w.hero.lane = rift.lanes.findIndex((l) => l.name === 'bot');
  const start = performance.now(),
    samples = [];
  for (let minute = 1; minute <= 60 && !w.winner; minute++) {
    w.step(Math.min(3600, 60 * 60 * 60 - w.tick));
    World.fromSnapshot(w.snapshot(), rift);
    const champions = w.units.filter((u) => u.kind === 'champion');
    const sample = {
      minute,
      tick: w.tick,
      winner: w.winner,
      units: w.units.length,
      down: w.units.filter((u) => u.structure && !w.alive(u)).length,
      champions: champions.map((u) => {
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
          elapsedSeconds: (performance.now() - start) / 1000,
        })
      );
  }
  const snapshot = w.snapshot();
  writeFileSync(`${folder}/${seed}.match.json`, snapshot + '\n');
  const report = {
    seed,
    ruleset: __SIMULATION_HASH__,
    automatedHumanCarry: true,
    horizonTicks: 216000,
    winner: w.winner,
    finalTick: w.tick,
    elapsedSeconds: (performance.now() - start) / 1000,
    finalSnapshotSha256: createHash('sha256').update(snapshot).digest('hex'),
    samples,
  };
  writeFileSync(`${folder}/${seed}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      seed,
      done: true,
      winner: w.winner,
      tick: w.tick,
      elapsedSeconds: report.elapsedSeconds,
    })
  );
}
