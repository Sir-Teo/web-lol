import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';
export const Q_CAST_GAMEPLAY_CASES = [
  'stationary',
  'move-windup',
  'move-flight',
  'flash-flight',
  'death-windup',
  'death-flight',
  'two-casters',
  'hidden-birth',
  'victory-windup',
  'victory-flight',
] as const;
export type QCastGameplayCase = (typeof Q_CAST_GAMEPLAY_CASES)[number];
/** Run the actual archived World; retain all earlier presentation histories. */
export function qCastGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: QCastGameplayCase
) {
  let revealed = scenario !== 'hidden-birth';
  const w = new WorldType(false, {
    ...base,
    initialUnits: [],
    lineOfSight: () => revealed,
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
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  Object.assign(enemy, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  w.learnSpell('q', ahri.id);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  w.step();
  const initial = w.ahriOrbAudio.find((r) => r.sourceId === ahri.id);
  if (initial?.castTick !== 1 || !w.championState(ahri.id)?.pendingCast)
    throw Error('Q cast baseline did not accept genuine windup');
  const at = new Set([
    1, 4, 5, 6, 9, 10, 11, 15, 16, 19, 20, 21, 29, 30, 34, 35, 40, 41, 60, 120, 129, 130, 239, 240,
    249, 250, 251, 260, 300, 310, 360,
  ]);
  const samples: { tick: number; state: string }[] = [];
  let flashed = false,
    second = false;
  while (w.tick <= 360) {
    if (w.tick === 5) {
      if (scenario === 'move-windup') w.setOrder(ahri, { type: 'move', point: { x: -500, y: 0 } });
      if (scenario === 'death-windup') w.damage(enemy, ahri, 1e6, 'true');
    }
    if (w.tick === 20) {
      if (scenario === 'move-flight') w.setOrder(ahri, { type: 'move', point: { x: -500, y: 0 } });
      if (scenario === 'flash-flight') {
        if (!w.ahriOrbs.some((o) => o.sourceId === ahri.id))
          throw Error('Q cast Flash requires actual released orb');
        w.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: -300, y: 0 } });
      }
      if (scenario === 'death-flight') {
        if (!w.ahriOrbs.some((o) => o.sourceId === ahri.id))
          throw Error('Q cast death requires actual released orb');
        w.damage(enemy, ahri, 1e6, 'true');
      }
      if (scenario === 'hidden-birth') revealed = true;
      if (scenario === 'two-casters') {
        const other = w.spawn('champion', 'blue', { x: 0, y: 100 }, 'ahri');
        other.ai = false;
        w.learnSpell('q', other.id);
        w.enqueue({ type: 'cast', unit: other.id, ability: 'q', point: { x: 900, y: 100 } });
        second = true;
      }
    }
    if (w.tick === 21 && scenario === 'flash-flight') {
      flashed = w.events.some((e) => e.type === 'cast' && e.unit === ahri.id && e.text === 'd');
      if (!flashed || ahri.x !== -300)
        throw Error('Q cast baseline Flash was not accepted after release');
    }
    if (
      (scenario === 'victory-windup' && w.tick === 5) ||
      (scenario === 'victory-flight' && w.tick === 20)
    ) {
      const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
      w.damage(w.hero, nexus, 1e6, 'true');
      if (w.winner !== 'blue') throw Error('Q cast baseline did not reach victory');
    }
    if (at.has(w.tick)) {
      const state = JSON.parse(w.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriQCastVisuals;
      samples.push({ tick: w.tick, state: JSON.stringify(state) });
    }
    if (w.winner || w.tick === 360) break;
    w.step();
  }
  if (scenario === 'two-casters' && !second) throw Error('Q cast second caster fixture failed');
  if (scenario === 'flash-flight' && !flashed) throw Error('Q cast Flash fixture failed');
  return samples;
}
