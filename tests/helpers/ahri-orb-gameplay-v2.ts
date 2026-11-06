import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';

export const ORB_GAMEPLAY_CASES = [
  'hit',
  'miss',
  'many-hits',
  'windup-death',
  'flight-death',
  'blocked-flash-windup',
  'flash-after-launch',
  'overlap',
  'moving-caster',
] as const;
export type OrbGameplayCase = (typeof ORB_GAMEPLAY_CASES)[number];
/** Execute identical genuine casts against current or archived World. Only the
 * new Orb audio history and compatibility envelope are excluded. */
export function orbGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: OrbGameplayCase
) {
  const field = {
    ...base,
    initialUnits: [],
    lineOfSight: () => true,
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
  w.learnSpell('q', ahri.id);
  const target = w.spawn('champion', 'red', { x: 500, y: scenario === 'miss' ? 500 : 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  if (scenario === 'many-hits')
    for (let i = 0; i < 8; i++) {
      const unit = w.spawn('melee', 'red', { x: 100 + i * 95, y: 0 });
      Object.assign(unit, { ai: false, hp: 10000, maxHp: 10000 });
    }
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  if (scenario === 'overlap') {
    const other = w.spawn('champion', 'blue', { x: -100, y: 0 }, 'ahri');
    other.ai = false;
    w.learnSpell('q', other.id);
    w.enqueue({ type: 'cast', unit: other.id, ability: 'q', point: { x: 900, y: 0 } });
  }
  const at = new Set([0, 1, 15, 16, 20, 40, 80, 200, 360]);
  const samples: { tick: number; state: string }[] = [];
  for (let tick = 0; tick <= 360; tick++) {
    if ((scenario === 'windup-death' && tick === 1) || (scenario === 'flight-death' && tick === 16))
      w.damage(target, ahri, 1e6, 'true');
    if (
      (scenario === 'blocked-flash-windup' && tick === 1) ||
      (scenario === 'flash-after-launch' && tick === 16)
    )
      w.enqueue({
        type: 'cast',
        unit: ahri.id,
        ability: w.summonerSlot('flash', ahri.id)!,
        point: { x: -100, y: 0 },
      });
    if (scenario === 'moving-caster' && tick === 16)
      w.setOrder(ahri, { type: 'move', point: { x: -1000, y: 200 } });
    if (scenario === 'blocked-flash-windup' && tick === 2 && ahri.x !== 0)
      throw new Error('Windup Flash unexpectedly moved');
    if (scenario === 'flash-after-launch' && tick === 17 && ahri.x !== -100)
      throw new Error('Post-launch Flash did not move');
    if (at.has(tick)) {
      const state = JSON.parse(w.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriOrbAudio;
      samples.push({ tick, state: JSON.stringify(state) });
    }
    if (tick < 360) w.step();
  }
  return samples;
}
