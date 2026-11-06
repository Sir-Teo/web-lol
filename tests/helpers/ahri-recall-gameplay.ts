import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';
export const RECALL_GAMEPLAY_CASES = [
  'complete',
  'move',
  'damage',
  'zero-damage',
  'attack',
  'cast',
  'death',
  'hidden',
] as const;
export type RecallGameplayCase = (typeof RECALL_GAMEPLAY_CASES)[number];
/** Execute real channels in current or frozen World, retaining all older audio histories. */
export function recallGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: RecallGameplayCase
) {
  const w = new WorldType(false, {
    ...base,
    initialUnits: [],
    lineOfSight: () => scenario !== 'hidden',
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
  ahri.hp = ahri.maxHp / 2;
  ahri.mana = ahri.maxMana / 2;
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  Object.assign(enemy, { ai: false, hp: 10000, maxHp: 10000 });
  w.learnSpell('q', ahri.id);
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  const state = w.championState(ahri.id)!;
  const deadline = state.recallEnd;
  if (deadline !== 481) throw Error('Recall accepted clock changed');
  const at = new Set([1, 19, 20, 21, 22, 60, 232, 480, 481, 482, 580, 581, 600]);
  const samples: { tick: number; state: string }[] = [];
  while (w.tick <= 600) {
    if (w.tick === 20) {
      if (scenario === 'move') w.setOrder(ahri, { type: 'move', point: { x: -500, y: 0 } });
      if (scenario === 'attack') w.setOrder(ahri, { type: 'attack', target: enemy.id });
      if (scenario === 'damage' || scenario === 'zero-damage' || scenario === 'death')
        w.damage(enemy, ahri, scenario === 'death' ? 1e6 : scenario === 'damage' ? 1 : 0, 'true');
      if (scenario === 'cast')
        w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
    }
    if (
      w.tick === 22 &&
      !['complete', 'zero-damage', 'hidden'].includes(scenario) &&
      state.recallEnd !== null
    )
      throw Error('Recall interruption fixture failed: ' + scenario);
    if (
      w.tick === 480 &&
      ['complete', 'zero-damage', 'hidden'].includes(scenario) &&
      state.recallEnd !== deadline
    )
      throw Error('Recall channel ended early');
    if (
      w.tick === deadline &&
      ['complete', 'zero-damage', 'hidden'].includes(scenario) &&
      (state.recallEnd !== null ||
        ahri.x !== base.spawns.blue.x ||
        ahri.y !== base.spawns.blue.y ||
        ahri.hp !== ahri.maxHp ||
        ahri.mana !== ahri.maxMana)
    )
      throw Error('Recall completion fixture failed');
    if (at.has(w.tick)) {
      const snapshot = JSON.parse(w.snapshot());
      delete snapshot.version;
      delete snapshot.ruleset;
      delete snapshot.ahriRecallAudio;
      samples.push({ tick: w.tick, state: JSON.stringify(snapshot) });
    }
    if (w.tick === 600) break;
    w.step();
  }
  return samples;
}
