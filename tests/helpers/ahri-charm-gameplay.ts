import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';

export const CHARM_GAMEPLAY_CASES = [
  'hit',
  'miss',
  'windup-death',
  'flight-death',
  'flash',
  'overlap',
] as const;
export type CharmGameplayCase = (typeof CHARM_GAMEPLAY_CASES)[number];
/** Identical inputs can be executed against the archived or current World.
 * Only the new presentation history and compatibility envelope are excluded. */
export function charmGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: CharmGameplayCase
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
  const world = new WorldType(false, field);
  world.random.state = 927;
  world.nextWaveTick = 1_000_000_000;
  Object.assign(world.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const caster = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  caster.ai = false;
  world.learnSpell('e', caster.id);
  const target = world.spawn(
    'champion',
    'red',
    { x: 500, y: scenario === 'miss' ? 500 : 0 },
    'lux'
  );
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  world.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
  if (scenario === 'overlap') {
    const other = world.spawn('champion', 'blue', { x: -100, y: 0 }, 'ahri');
    other.ai = false;
    world.learnSpell('e', other.id);
    world.enqueue({ type: 'cast', unit: other.id, ability: 'e', point: { x: 900, y: 0 } });
  }
  const at = new Set([0, 1, 15, 16, 20, 40, 80, 200]),
    samples: { tick: number; state: string }[] = [];
  for (let tick = 0; tick <= 200; tick++) {
    if ((scenario === 'windup-death' && tick === 1) || (scenario === 'flight-death' && tick === 16))
      world.damage(target, caster, 1e6, 'true');
    if (scenario === 'flash' && tick === 1)
      world.enqueue({ type: 'cast', unit: caster.id, ability: 'd', point: { x: -100, y: 0 } });
    if (at.has(tick)) {
      const state = JSON.parse(world.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriCharmAudio;
      samples.push({ tick, state: JSON.stringify(state) });
    }
    if (tick < 200) world.step();
  }
  return samples;
}
