import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';
export const ATTACK_GAMEPLAY_CASES = [
  'hit',
  'critical',
  'cancel-move',
  'death-windup',
  'death-flight',
  'lost-target-windup',
  'lost-target-flight',
  'flash-flight',
  'moving-target',
  'lethal-champion',
] as const;
export type AttackGameplayCase = (typeof ATTACK_GAMEPLAY_CASES)[number];
/** Real attack orders/deaths/Flash in current or independently archived World.
 * Existing passive/R/W/Q/E histories stay in complete gameplay projections. */
export function attackGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: AttackGameplayCase
) {
  const w = new WorldType(false, {
    ...base,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = 1e9;
  w.random.state = 1;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = w.spawn(
    scenario === 'lethal-champion' ? 'champion' : 'dummy',
    'red',
    { x: 450, y: 0 },
    scenario === 'lethal-champion' ? 'lux' : undefined
  );
  Object.assign(target, {
    ai: false,
    hp: scenario === 'lethal-champion' ? 1 : 10000,
    maxHp: 10000,
    armor: 0,
    experienceBounty: 0,
    goldBounty: 0,
  });
  if (scenario === 'critical') w.championState(ahri.id)!.inventory = Array(6).fill('agility');
  const originalX = ahri.x;
  w.setOrder(ahri, { type: 'attack', target: target.id });
  const at = new Set([0, 1, 5, 6, 18, 19, 25, 35, 60, 120, 300, 600]);
  const samples: { tick: number; state: string }[] = [];
  let launched = false,
    critical = false;
  for (let tick = 0; tick <= 600; tick++) {
    if (tick === 1) {
      if (!ahri.attackCycle || ahri.releaseTick !== 19) throw Error('Attack windup fixture failed');
      critical = !!ahri.attackCycle.critical;
      if (critical !== (scenario === 'critical')) throw Error('Attack critical fixture failed');
    }
    if (tick === 5 && scenario === 'cancel-move')
      w.setOrder(ahri, { type: 'move', point: { x: -300, y: 0 } });
    if (tick === 5 && scenario === 'death-windup') w.damage(w.hero, ahri, 1e6, 'true');
    if (tick === 5 && scenario === 'lost-target-windup') w.damage(w.hero, target, 1e6, 'true');
    if (tick === 20) w.setOrder(ahri, { type: 'idle' });
    if (tick === 25 && scenario === 'death-flight') w.damage(w.hero, ahri, 1e6, 'true');
    if (tick === 25 && scenario === 'lost-target-flight') w.damage(w.hero, target, 1e6, 'true');
    if (tick === 25 && scenario === 'flash-flight')
      w.enqueue({
        type: 'cast',
        unit: ahri.id,
        ability: w.summonerSlot('flash', ahri.id)!,
        point: { x: -300, y: 0 },
      });
    if (tick >= 20 && tick < 80 && scenario === 'moving-target') target.x += 10;
    if (w.projectiles.some((p) => p.source === ahri.id)) launched = true;
    if (tick === 26 && scenario === 'flash-flight' && Math.abs(ahri.x - originalX) < 200)
      throw Error('Attack Flash fixture failed');
    if (tick === 120) {
      const cancelled = ['cancel-move', 'death-windup', 'lost-target-windup'].includes(scenario);
      if (launched === cancelled) throw Error('Attack launch/cancellation fixture failed');
      if (
        ['hit', 'critical', 'moving-target', 'flash-flight'].includes(scenario) &&
        !(target.hp < target.maxHp)
      )
        throw Error('Attack contact fixture failed');
      if (
        scenario === 'lethal-champion' &&
        (!w.ahriPassiveAudio.some((r) => r.end?.reason === 'consumed') || target.hp > 0)
      )
        throw Error('Attack passive consumption fixture failed');
    }
    if (at.has(tick)) {
      const state = JSON.parse(w.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriAttackAudio;
      samples.push({ tick, state: JSON.stringify(state) });
    }
    if (tick < 600) w.step();
  }
  return samples;
}
