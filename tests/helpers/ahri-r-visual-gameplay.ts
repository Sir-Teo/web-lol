import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';

export const R_VISUAL_GAMEPLAY_CASES = [
  'hit',
  'miss',
  'many-targets',
  'three-casts',
  'death-dash',
  'lost-target',
  'moving-target',
  'hidden-recast',
  'root-control',
  'charm-control',
  'flash-dash',
  'essence-extension',
  'rejected-zero-aim',
  'rejected-rooted',
  'death-window',
  'lethal-hit',
  'late-recast',
  'overlap',
  'victory-dash',
  'victory-flight',
  'victory-window',
] as const;
export type RVisualGameplayCase = (typeof R_VISUAL_GAMEPLAY_CASES)[number];
/** Execute genuine R commands in current or archived World. All existing audio and W/Q/E
 * presentation history remains included in the complete gameplay projection. */
export function rVisualGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: RVisualGameplayCase
) {
  let revealed = scenario !== 'hidden-recast';
  const field = {
    ...base,
    initialUnits: [],
    lineOfSight: () => revealed,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p: { x: number; y: number }) => ({ ...p }),
    findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
  };
  const w = new WorldType(false, field);
  w.random.state = 927;
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.gainExperience(1e6, ahri.id);
  w.learnSpell('r', ahri.id);
  const target =
    scenario === 'lethal-hit'
      ? w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux')
      : w.spawn('dummy', 'red', { x: scenario === 'miss' ? 4000 : 400, y: 0 });
  Object.assign(target, {
    ai: false,
    hp: scenario === 'lethal-hit' ? 1 : 10000,
    maxHp: 10000,
    magicResist: 0,
  });
  if (scenario === 'many-targets')
    for (let i = 0; i < 3; i++) {
      const u = w.spawn('champion', 'red', { x: 300 + i * 100, y: 0 }, 'lux');
      Object.assign(u, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
    }
  if (scenario === 'rejected-rooted') ahri.rootUntil = 100;
  const cast = (point: { x: number; y: number }) =>
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point });
  cast({ x: scenario === 'rejected-zero-aim' ? 0 : 900, y: 0 });
  let other: typeof ahri | undefined;
  if (scenario === 'overlap') {
    other = w.spawn('champion', 'blue', { x: 0, y: 100 }, 'ahri');
    other.ai = false;
    w.gainExperience(1e6, other.id);
    w.learnSpell('r', other.id);
    w.enqueue({ type: 'cast', unit: other.id, ability: 'r', point: { x: 900, y: 100 } });
  }
  const at = new Set([
    0, 1, 2, 5, 6, 15, 25, 60, 61, 121, 300, 800, 801, 850, 851, 900, 901, 1401, 1500,
  ]);
  const samples: { tick: number; state: string; snapshot: string }[] = [];
  for (let tick = 0; tick <= 1500; tick++) {
    if (scenario === 'death-window' && tick === 60) w.damage(target, ahri, 1e6, 'true');
    if (scenario === 'late-recast' && tick === 850) cast({ x: 500, y: 900 });
    if (scenario === 'three-casts' && tick === 60) cast({ x: 500, y: 900 });
    if (scenario === 'three-casts' && tick === 120) cast({ x: -100, y: 500 });
    if (scenario === 'death-dash' && tick === 5) w.damage(target, ahri, 1e6, 'true');
    if (scenario === 'lost-target' && tick === 1) w.damage(ahri, target, 1e6, 'true');
    if (scenario === 'moving-target' && tick >= 1 && tick < 260) target.x += 100;
    if (scenario === 'hidden-recast' && tick === 40) revealed = true;
    if (scenario === 'hidden-recast' && tick === 60) cast({ x: 500, y: 900 });
    if (scenario === 'root-control' && tick === 5) w.applyRoot(ahri, 60);
    if (scenario === 'charm-control' && tick === 5) {
      const enemy = w.spawn('champion', 'red', { x: 800, y: 0 }, 'ahri');
      enemy.ai = false;
      w.learnSpell('e', enemy.id);
      w.applyCharm(enemy, ahri, 1);
    }
    if (scenario === 'flash-dash' && tick === 5)
      w.enqueue({
        type: 'cast',
        unit: ahri.id,
        ability: w.summonerSlot('flash', ahri.id)!,
        point: { x: -100, y: 0 },
      });
    if (scenario === 'essence-extension' && tick === 800) {
      const victim = w.spawn('champion', 'red', { x: ahri.x, y: ahri.y }, 'lux');
      victim.ai = false;
      w.damage(ahri, victim, 1e6, 'true');
    }
    const rush = w.ahriRushes.find((r) => r.sourceId === ahri.id);
    if (
      tick === 1 &&
      scenario.startsWith('rejected-') &&
      (rush || w.championState(ahri.id)!.cooldowns.r !== 0)
    )
      throw Error('Rejected R fixture spent resources or created a rush');
    if (
      tick === 1 &&
      scenario === 'many-targets' &&
      (rush?.bursts[0].bolts.length !== 3 ||
        !rush.bursts[0].bolts.every((b) => w.unit(b.targetId)?.kind === 'champion'))
    )
      throw Error('R fixture did not select three champion targets');
    if (
      tick === 60 &&
      scenario === 'hit' &&
      (rush?.bursts[0].bolts.length !== 1 ||
        !rush.bursts[0].bolts.every((b) => b.stopReason === 'hit'))
    )
      throw Error('R hit fixture did not contact');
    if (tick === 60 && scenario === 'miss' && rush?.bursts[0].bolts.length !== 0)
      throw Error('R miss fixture selected a target');
    if (
      tick === 121 &&
      scenario === 'three-casts' &&
      (rush?.bursts.length !== 3 || rush.remainingCasts !== 0 || rush.endTick !== 901)
    )
      throw Error('R recast fixture changed its window or cast count');
    if (tick === 6 && scenario === 'death-dash' && rush?.stopReason !== 'death')
      throw Error('R death fixture did not stop its window');
    if (
      tick === 6 &&
      (scenario === 'root-control' || scenario === 'charm-control') &&
      rush?.bursts[0].stopReason !== 'control'
    )
      throw Error('R control fixture did not interrupt its dash');
    if (
      tick === 6 &&
      scenario === 'flash-dash' &&
      (ahri.x !== -100 || rush?.bursts[0].stopReason !== 'flash')
    )
      throw Error('R Flash fixture did not stop and move');
    if (
      tick === 2 &&
      scenario === 'lost-target' &&
      rush?.bursts[0].bolts[0].stopReason !== 'lost-target'
    )
      throw Error('R target-loss fixture did not stop its bolt');
    if (
      tick === 300 &&
      scenario === 'moving-target' &&
      (rush?.bursts[0].bolts.length !== 1 ||
        !rush.bursts[0].bolts.every((b) => b.stopReason === 'expired'))
    )
      throw Error('R moving target fixture did not reach its deadline');
    if (
      tick === 61 &&
      scenario === 'hidden-recast' &&
      (rush?.bursts.length !== 2 ||
        rush.bursts[0].bolts.length !== 0 ||
        rush.bursts[1].bolts.length !== 1)
    )
      throw Error('R hidden/recast fixture did not preserve cast-time selection');
    if (
      tick === 900 &&
      scenario === 'essence-extension' &&
      (rush?.resets.length !== 1 || rush.endTick <= 901)
    )
      throw Error('R Essence fixture did not extend its window');
    if (
      tick === 61 &&
      scenario === 'death-window' &&
      (w.alive(ahri) ||
        (rush && rush.stopReason !== 'death') ||
        w.ahriSpiritRushAudio.find((r) => r.sourceId === ahri.id)?.end?.reason !== 'death')
    )
      throw Error('R window death did not stop');
    if (tick === 60 && scenario === 'lethal-hit' && (w.alive(target) || !rush?.resets.length))
      throw Error('R lethal contact did not consume Essence');
    if (
      tick === 851 &&
      scenario === 'late-recast' &&
      (rush?.bursts.length !== 2 || rush.endTick !== 901)
    )
      throw Error('Late R recast changed its window');
    if (
      tick === 1 &&
      scenario === 'overlap' &&
      (!other ||
        w.ahriRushes.length !== 2 ||
        new Set(w.ahriRushes.map((r) => r.sourceId)).size !== 2)
    )
      throw Error('R overlap lost source ownership');
    if (
      (scenario === 'victory-dash' && tick === 5) ||
      (scenario === 'victory-flight' && tick === 2) ||
      (scenario === 'victory-window' && tick === 60)
    ) {
      if (scenario === 'victory-dash' && rush?.bursts[0].stopTick !== null)
        throw Error('R victory fixture lost dash');
      if (scenario === 'victory-flight' && !rush?.bursts[0].bolts.some((b) => b.stopTick === null))
        throw Error('R victory fixture lost flight');
      if (scenario === 'victory-window' && rush?.stopTick !== null)
        throw Error('R victory fixture lost window');
      const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
      w.damage(w.hero, nexus, 1e6, 'true');
      if (w.winner !== 'blue') throw Error('R baseline did not reach victory');
    }
    if (tick === 1500 && rush) throw Error('R fixture window did not expire');
    if (at.has(tick) || w.winner) {
      const snapshot = w.snapshot();
      const state = JSON.parse(snapshot);
      delete state.version;
      delete state.ruleset;
      delete state.ahriRVisuals;
      samples.push({ tick, state: JSON.stringify(state), snapshot });
    }
    if (w.winner) break;
    if (tick < 1500) w.step();
  }
  return samples;
}
