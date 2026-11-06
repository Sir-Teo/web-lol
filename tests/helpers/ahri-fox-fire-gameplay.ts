import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';

export const FOX_FIRE_GAMEPLAY_CASES = [
  'hit',
  'miss',
  'priority',
  'hidden-reveal',
  'windup-death',
  'flight-death',
  'lost-target',
  'moving-target',
  'moving-caster',
  'overlap',
  'flash-after-release',
] as const;
export type FoxFireGameplayCase = (typeof FOX_FIRE_GAMEPLAY_CASES)[number];
/** Run genuine W casts against current or archived World. Existing Q/E audio
 * history stays in the projection; only the proposed W history is excluded. */
export function foxFireGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: FoxFireGameplayCase
) {
  let revealed = scenario !== 'hidden-reveal';
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
  Object.assign(ahri, { ai: false, damage: 0 });
  w.learnSpell('w', ahri.id);
  const target = w.spawn('champion', 'red', { x: scenario === 'miss' ? 3000 : 400, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  if (scenario === 'priority') w.setOrder(ahri, { type: 'attack', target: target.id });
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: 0, y: 0 } });
  if (scenario === 'overlap') {
    const other = w.spawn('champion', 'blue', { x: -100, y: 0 }, 'ahri');
    other.ai = false;
    w.learnSpell('w', other.id);
    w.enqueue({ type: 'cast', unit: other.id, ability: 'w', point: { x: 0, y: 0 } });
  }
  const at = new Set([0, 1, 5, 15, 16, 24, 25, 35, 60, 120, 150, 300]);
  const samples: { tick: number; state: string }[] = [];
  for (let tick = 0; tick <= 300; tick++) {
    if ((scenario === 'windup-death' && tick === 5) || (scenario === 'flight-death' && tick === 30))
      w.damage(target, ahri, 1e6, 'true');
    if (scenario === 'lost-target' && tick === 25) w.damage(ahri, target, 1e6, 'true');
    if (scenario === 'hidden-reveal' && tick === 40) revealed = true;
    if (scenario === 'moving-target' && tick >= 25) target.x += 100;
    if (scenario === 'moving-caster' && tick === 16)
      w.setOrder(ahri, { type: 'move', point: { x: -1000, y: 200 } });
    if (scenario === 'flash-after-release' && tick === 16)
      w.enqueue({
        type: 'cast',
        unit: ahri.id,
        ability: w.summonerSlot('flash', ahri.id)!,
        point: { x: -100, y: 0 },
      });
    if (scenario === 'flash-after-release' && tick === 17 && ahri.x !== -100)
      throw Error('Post-release Flash did not move');
    const cast = w.ahriFoxFires.find((r) => r.sourceId === ahri.id);
    if (tick === 16 && scenario === 'priority' && !cast?.fires.some((f) => f.phase === 'flight'))
      throw Error('Priority fixture did not dispatch early');
    if (
      tick === 35 &&
      scenario === 'hidden-reveal' &&
      !cast?.fires.every((f) => f.phase === 'orbit')
    )
      throw Error('Hidden fixture acquired before reveal');
    if (
      tick === 120 &&
      ['hit', 'priority', 'hidden-reveal'].includes(scenario) &&
      cast?.fires.filter((f) => f.stopReason === 'hit').length !== 3
    )
      throw Error('Expected three Fox-Fire contacts: ' + scenario + ' ' + JSON.stringify(cast));
    if (tick === 6 && scenario === 'windup-death' && cast)
      throw Error('Windup death did not cancel orbits');
    if (
      tick === 31 &&
      scenario === 'flight-death' &&
      !cast?.fires.some((f) => f.phase === 'flight')
    )
      throw Error('Flight-death fixture lost released shots');
    if (
      tick === 26 &&
      scenario === 'lost-target' &&
      !cast?.fires.every((f) => f.stopReason === 'lost-target')
    )
      throw Error('Target loss fixture did not stop flights');
    if (
      tick === 260 &&
      scenario === 'moving-target' &&
      !cast?.fires.some((f) => f.phase === 'flight')
    )
      throw Error('Moving target fixture did not retain the deadline flight');
    if (tick === 150 && scenario === 'miss' && !cast?.fires.every((f) => f.targetId === null))
      throw Error('Miss fixture acquired a target');
    if (tick === 1 && scenario === 'overlap' && w.ahriFoxFires.length !== 2)
      throw Error('Overlap fixture did not cast twice');
    if (at.has(tick)) {
      const state = JSON.parse(w.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriFoxFireAudio;
      samples.push({ tick, state: JSON.stringify(state) });
    }
    if (tick < 300) w.step();
  }
  return samples;
}
