import { AHRI_Q } from '../content/ahri-q';
import { AHRI_Q_POLICY } from '../content/ahri-q-policy';
import { advanceAhriOrbMotion, createAhriOrbMotion, type AhriOrbMotion } from './ahri-orb-motion';
import { sweepCircle, type Vec2 } from './math';
import type { Team, Unit } from './types';

export interface AhriOrb extends AhriOrbMotion {
  id: number;
  sourceId: number;
  team: Team;
  rank: number;
  damage: number;
  outwardHits: number[];
  returnHits: number[];
}

interface OrbWorld {
  tick: number;
  nextId: number;
  ahriOrbs: AhriOrb[];
  units: Unit[];
  unit(id: number): Unit | undefined;
  alive(unit: Unit): boolean;
  damage(source: Unit, target: Unit, raw: number, kind: 'magic' | 'true', category: 'area'): void;
}

export function ahriOrbDamage(rank: number, abilityPower: number): number {
  if (
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > 5 ||
    !Number.isFinite(abilityPower) ||
    abilityPower < 0
  )
    throw new RangeError('Invalid Ahri orb payload');
  return AHRI_Q.namedDamageByRank[rank - 1] + abilityPower * AHRI_Q_POLICY.damageAbilityPowerRatio;
}

export function beginAhriOrb(
  world: OrbWorld,
  source: Unit,
  aim: Vec2,
  rank: number,
  damage: number
): void {
  if (!Number.isFinite(damage) || damage < ahriOrbDamage(rank, 0))
    throw new RangeError('Invalid Ahri orb damage');
  if (source.champion !== 'ahri' || source.team === 'neutral')
    throw new Error('Invalid Ahri orb source');
  const motion = createAhriOrbMotion(source, aim, world.tick);
  world.ahriOrbs.push({
    ...motion,
    id: world.nextId++,
    sourceId: source.id,
    team: source.team,
    rank,
    damage,
    outwardHits: [],
    returnHits: [],
  });
}

/** Local Q policy: all living hostile champions, lane units, dummies and neutral
 * monsters; structures/wards excluded. Terrain does not stop either leg. Dead
 * casters retain their moving return target. Each leg has its own hit set. */
export function advanceAhriOrbs(world: OrbWorld): void {
  const survivors: AhriOrb[] = [];
  for (const orb of world.ahriOrbs) {
    const source = world.unit(orb.sourceId);
    if (!source || world.tick - orb.launchTick >= AHRI_Q_POLICY.maximumFlightTicks) continue;
    const movement = advanceAhriOrbMotion(orb, world.tick, source);
    Object.assign(orb, movement.motion);
    for (const segment of movement.segments) {
      const hitIds = segment.leg === 'outward' ? orb.outwardHits : orb.returnHits;
      const contacts = world.units
        .filter(
          (unit) =>
            unit.id !== source.id &&
            unit.team !== orb.team &&
            world.alive(unit) &&
            !['turret', 'nexus', 'inhibitor', 'ward'].includes(unit.kind) &&
            !hitIds.includes(unit.id)
        )
        .flatMap((unit) => {
          const at = sweepCircle(
            segment.from,
            segment.to,
            unit,
            AHRI_Q_POLICY.collisionRadius + unit.radius
          );
          return at === null ? [] : [{ unit, at }];
        })
        .sort((a, b) => a.at - b.at || a.unit.id - b.unit.id);
      for (const { unit } of contacts) {
        if (!world.alive(unit)) continue;
        hitIds.push(unit.id);
        world.damage(
          source,
          unit,
          orb.damage,
          segment.leg === 'outward'
            ? AHRI_Q_POLICY.outwardDamageType
            : AHRI_Q_POLICY.returnDamageType,
          'area'
        );
      }
    }
    if (!movement.finished) survivors.push(orb);
  }
  world.ahriOrbs = survivors;
}
