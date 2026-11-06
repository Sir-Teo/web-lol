import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';

export const PASSIVE_GAMEPLAY_CASES = [
  'ninth-minion',
  'ninth-monster',
  'champion',
  'overheal',
  'full-health',
  'death-flight',
  'moving-owner',
  'captured-power',
  'eight-kills',
  'rush-extension',
] as const;
export type PassiveGameplayCase = (typeof PASSIVE_GAMEPLAY_CASES)[number];
/** Execute the same real deaths and ticks against current and frozen Worlds.
 * Existing R/W/Q/E presentation histories stay in the complete projection. */
export function passiveGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: PassiveGameplayCase
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
  w.random.state = 927;
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  if (scenario !== 'full-health') ahri.hp = scenario === 'overheal' ? ahri.maxHp - 2 : 100;
  if (scenario === 'captured-power') w.championState(ahri.id)!.inventory = ['tome'];
  if (scenario === 'rush-extension') {
    w.gainExperience(1e6, ahri.id);
    w.learnSpell('r', ahri.id);
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: 900, y: 0 } });
    w.step();
  }
  const champion = scenario === 'champion' || scenario === 'rush-extension';
  const count = champion ? 1 : scenario === 'eight-kills' ? 8 : 9;
  for (let i = 0; i < count; i++) {
    const victim = champion
      ? w.spawn('champion', 'red', { x: ahri.x + 400, y: ahri.y }, 'lux')
      : scenario === 'ninth-monster' && i === 8
        ? w.spawnMonster({ x: 400, y: 0 })
        : w.spawn('melee', 'red', { x: 400, y: 0 });
    Object.assign(victim, { ai: false, experienceBounty: 0, goldBounty: 0 });
    w.damage(ahri, victim, 1e6, 'true');
  }
  if (w.ahriEssences.length !== (scenario === 'eight-kills' ? 0 : 1))
    throw Error('Passive birth fixture failed');
  if (w.ahriCounters[0].stacks !== (scenario === 'eight-kills' ? 8 : 0))
    throw Error('Passive counter fixture failed');
  if (scenario === 'captured-power') {
    if (Math.abs(w.ahriEssences[0].heal - 39) > 1e-6) throw Error('Captured AP fixture failed');
    w.championState(ahri.id)!.inventory = [];
    w.gainExperience(1e6, ahri.id);
  }
  let terminal: { stopReason: string | null; healed: number | null } | undefined;
  const samples: { tick: number; state: string }[] = [];
  const at = new Set([0, 1, 2, 5, 10, 20, 30, 60, 120, 240, 600, 1500]);
  for (let elapsed = 0; elapsed <= 1500; elapsed++) {
    if (elapsed === 2 && scenario === 'death-flight') w.damage(w.hero, ahri, 1e6, 'true');
    if (elapsed > 0 && elapsed < 20 && scenario === 'moving-owner') ahri.x -= 10;
    if (w.ahriEssences[0]?.stopTick !== null && w.ahriEssences[0])
      terminal = { ...w.ahriEssences[0] };
    if (elapsed === 60 && scenario !== 'eight-kills') {
      const essence = terminal;
      if (!essence || essence.stopReason !== (scenario === 'death-flight' ? 'death' : 'consumed'))
        throw Error('Passive terminal fixture failed');
      if (scenario === 'full-health' && essence.healed !== 0)
        throw Error('Overheal fixture failed');
      if (scenario === 'overheal' && !(essence.healed! >= 0 && essence.healed! <= 2))
        throw Error('Clamp fixture failed');
      if (scenario === 'captured-power' && Math.abs(essence.healed! - 39) > 1e-6)
        throw Error('Captured heal changed');
      if (scenario === 'rush-extension' && w.ahriRushes[0]?.resets.length !== 1)
        throw Error('Passive R extension fixture failed');
    }
    if (at.has(elapsed)) {
      const state = JSON.parse(w.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriPassiveAudio;
      samples.push({ tick: w.tick, state: JSON.stringify(state) });
    }
    if (elapsed < 1500) w.step();
  }
  return samples;
}
