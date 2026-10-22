import { ORACLE_POLICY as P, trinketScaling } from '../content/trinkets';
import type { World } from './world';
import type { Faction, Unit } from './types';
import { averageChampionLevel, spendTrinket, trinketError } from './trinkets';
import { distance } from './math';

export function requestOracle(w: World, owner: Unit): string | null {
  const error = trinketError(w, owner, 'oracle');
  if (error) return error;
  const s = w.championState(owner.id)!.trinket;
  spendTrinket(w, s);
  s.cooldownTick = w.tick + P.cooldownTicks;
  s.scan = {
    startTick: w.tick,
    endTick: w.tick + P.durationTicks,
    radius: trinketScaling('oracle', averageChampionLevel(w)).radius,
    pulseStartTick: null,
    nextPulseTick: w.tick,
    echoes: [],
  };
  return null;
}
/** Detection is independent of ordinary terrain sight and does not reveal ground. */
export function wardDetected(w: World, ward: Unit, team: Faction): boolean {
  if (ward.kind !== 'ward' || team === 'neutral' || ward.team === team || !w.alive(ward))
    return false;
  return w.units.some((owner) => {
    if (owner.kind !== 'champion' || owner.team !== team) return false;
    const scan = w.championState(owner.id)!.trinket.scan;
    return !!scan && scan.endTick > w.tick && distance(owner, ward) <= scan.radius;
  });
}
export function wardDisabled(w: World, ward: Unit): boolean {
  return wardDetected(w, ward, ward.team === 'blue' ? 'red' : 'blue');
}
export function advanceOracles(w: World): void {
  for (const owner of w.units) {
    const scan = w.championState(owner.id)?.trinket.scan;
    if (!scan || scan.endTick <= w.tick) continue;
    if (scan.nextPulseTick > w.tick) continue;
    scan.pulseStartTick ??= w.tick;
    scan.nextPulseTick = w.tick + P.echoTicks;
    scan.echoes = w.units
      .filter(
        (u) =>
          u.kind === 'champion' &&
          u.team !== owner.team &&
          w.alive(u) &&
          distance(owner, u) <= scan.radius &&
          !w.visible(u, owner.team)
      )
      .map((u) => ({
        targetId: u.id,
        point: { x: u.x, y: u.y },
        facing: u.facing,
        origin: { x: owner.x, y: owner.y },
        createdTick: w.tick,
        endTick: w.tick + P.echoTicks,
      }));
  }
}
