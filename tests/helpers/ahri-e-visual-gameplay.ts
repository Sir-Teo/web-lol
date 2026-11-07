import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';

export const E_VISUAL_GAMEPLAY_CASES = [
  'hit',
  'miss',
  'windup-death',
  'flight-death',
  'buff-caster-death',
  'target-death',
  'lethal-hit',
  'moving-target',
  'moving-caster',
  'flash-after-release',
  'overlap',
  'replacement',
  'hidden-reveal',
  'tenacity',
  'victory-windup',
  'victory-flight',
  'victory-buff',
] as const;
export type EVisualGameplayCase = (typeof E_VISUAL_GAMEPLAY_CASES)[number];
/** Identical real casts against current or archived World. All older histories,
 * including Charm audio and W visuals, remain in the projected complete state. */
export function eVisualGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: EVisualGameplayCase
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
  const team = scenario === 'hidden-reveal' ? 'red' : 'blue';
  const enemy = team === 'blue' ? 'red' : 'blue';
  const caster = w.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  Object.assign(caster, { ai: false, damage: 0 });
  w.learnSpell('e', caster.id);
  const target = w.spawn(
    'champion',
    enemy,
    { x: 500, y: scenario === 'miss' ? 500 : 0 },
    scenario === 'tenacity' ? 'garen' : 'lux'
  );
  Object.assign(target, {
    ai: false,
    hp: scenario === 'lethal-hit' ? 1 : 10000,
    maxHp: 10000,
    magicResist: 0,
  });
  if (scenario === 'tenacity') {
    w.learnSpell('w', target.id);
    w.enqueue({ type: 'cast', unit: target.id, ability: 'w', point: { x: target.x, y: target.y } });
  }
  if (scenario === 'moving-target') w.setOrder(target, { type: 'move', point: { x: 500, y: -40 } });
  w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
  let other: typeof caster | undefined;
  let secondTarget: typeof target | undefined;
  if (scenario === 'overlap' || scenario === 'replacement') {
    const y = scenario === 'overlap' ? 250 : 0;
    other = w.spawn('champion', team, { x: -100, y }, 'ahri');
    Object.assign(other, { ai: false, damage: 0 });
    w.learnSpell('e', other.id);
    if (scenario === 'overlap') {
      secondTarget = w.spawn('champion', enemy, { x: 500, y }, 'lux');
      Object.assign(secondTarget, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
    }
    w.enqueue({ type: 'cast', unit: other.id, ability: 'e', point: { x: 900, y } });
  }
  const at = new Set([0, 1, 5, 15, 16, 17, 20, 30, 35, 40, 45, 60, 90, 120, 180, 300, 420, 480]);
  const samples: { tick: number; state: string; snapshot: string }[] = [];
  let hitSeen = false;
  for (let tick = 0; tick <= 480; tick++) {
    if (
      (scenario === 'windup-death' && tick === 5) ||
      (scenario === 'flight-death' && tick === 20) ||
      (scenario === 'buff-caster-death' && tick === 50)
    )
      w.damage(target, caster, 1e6, 'true');
    if (scenario === 'target-death' && tick === 50) w.damage(caster, target, 1e6, 'true');
    if (scenario === 'hidden-reveal' && tick === 25) revealed = true;
    if (scenario === 'moving-caster' && tick === 17)
      w.setOrder(caster, { type: 'move', point: { x: -1000, y: 200 } });
    if (scenario === 'flash-after-release' && tick === 17)
      w.enqueue({
        type: 'cast',
        unit: caster.id,
        ability: w.summonerSlot('flash', caster.id)!,
        point: { x: -100, y: 0 },
      });
    if (scenario === 'flash-after-release' && tick === 18 && caster.x !== -100)
      throw Error('Post-release E Flash did not move');
    hitSeen ||= w.ahriCharmAudio.some((r) => r.sourceId === caster.id && r.hit !== null);
    if (
      tick === 20 &&
      scenario === 'flight-death' &&
      !w.projectiles.some((p) => p.source === caster.id && p.type === 'charm')
    )
      throw Error('Released Charm did not survive caster death');
    if (
      tick === 45 &&
      [
        'hit',
        'moving-target',
        'moving-caster',
        'flash-after-release',
        'hidden-reveal',
        'buff-caster-death',
      ].includes(scenario) &&
      (!hitSeen || target.charm?.sourceId !== caster.id)
    )
      throw Error('Expected genuine Charm contact and control: ' + scenario);
    if (
      tick === 45 &&
      scenario === 'tenacity' &&
      (!target.charm?.tenacityApplied || target.charm.endTick - target.charm.startTick !== 29)
    )
      throw Error('Courage fixture did not sample tenacity');
    if (tick === 45 && scenario === 'replacement' && target.charm?.sourceId !== other?.id)
      throw Error('Later Charm did not replace control ownership');
    if (
      tick === 45 &&
      scenario === 'overlap' &&
      (target.charm?.sourceId !== caster.id || secondTarget?.charm?.sourceId !== other?.id)
    )
      throw Error('Overlapping casts did not own separate target controls');
    if (
      tick === 60 &&
      scenario === 'lethal-hit' &&
      (!hitSeen || w.alive(target) || target.charm !== null)
    )
      throw Error('Lethal hit fixture attached control or missed');
    if (tick === 60 && ['miss', 'windup-death'].includes(scenario) && hitSeen)
      throw Error('Miss or canceled windup hit');
    if (
      (scenario === 'victory-windup' && tick === 5) ||
      (scenario === 'victory-flight' && tick === 20) ||
      (scenario === 'victory-buff' && tick === 45)
    ) {
      if (scenario === 'victory-windup' && w.championState(caster.id)?.pendingCast?.ability !== 'e')
        throw Error('Victory fixture lost E windup');
      if (scenario === 'victory-flight' && !w.projectiles.some((p) => p.type === 'charm'))
        throw Error('Victory fixture lost E flight');
      if (scenario === 'victory-buff' && !target.charm) throw Error('Victory fixture lost E buff');
      const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
      w.damage(w.hero, nexus, 1e6, 'true');
      if (w.winner !== 'blue') throw Error('E baseline did not reach victory');
    }
    if (at.has(tick) || w.winner) {
      const snapshot = w.snapshot();
      const state = JSON.parse(snapshot);
      delete state.version;
      delete state.ruleset;
      delete state.ahriEVisuals;
      samples.push({ tick, state: JSON.stringify(state), snapshot });
    }
    if (w.winner) break;
    if (tick < 480) w.step();
  }
  return samples;
}
