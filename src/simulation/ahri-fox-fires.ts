import { AHRI_W } from '../content/ahri-w';
import { AHRI_W_POLICY } from '../content/ahri-w-policy';
import { DT } from '../content/rules';
import { direction, distance, type Vec2 } from './math';
import { isLaneMinionKind, type Unit, type Team } from './types';

export interface FoxFire {
  index: number;
  phase: 'orbit' | 'flight' | 'spent';
  position: Vec2;
  previous: Vec2;
  targetId: number | null;
  dispatchTick: number | null;
  stopTick: number | null;
  stopReason: 'hit' | 'lost-target' | 'expired' | 'death' | null;
  hit: { repeat: boolean; minionBonus: boolean } | null;
}
export interface FoxFireCast {
  id: number;
  sourceId: number;
  team: Team;
  rank: number;
  damage: number;
  startTick: number;
  releaseTick: number;
  lastTick: number;
  facing: number;
  released: boolean;
  stopTick: number | null;
  fires: FoxFire[];
}
interface FoxFireWorld {
  tick: number;
  nextId: number;
  units: Unit[];
  ahriFoxFires: FoxFireCast[];
  unit(id: number): Unit | undefined;
  alive(unit: Unit): boolean;
  targetable(unit: Unit): boolean;
  visible(unit: Unit, team: Team): boolean;
  damage(source: Unit, target: Unit, raw: number, kind: 'magic', category: 'area'): void;
}

export function foxFireDamage(rank: number, abilityPower: number): number {
  if (
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > 5 ||
    !Number.isFinite(abilityPower) ||
    abilityPower < 0
  )
    throw new RangeError('Invalid Fox-Fire payload');
  return AHRI_W.damageByRank[rank - 1] + abilityPower * AHRI_W.abilityPowerRatio;
}

export function foxFireOrbitPoint(
  cast: Pick<FoxFireCast, 'startTick' | 'facing'>,
  index: number,
  tick: number,
  source: Vec2
): Vec2 {
  const angle =
    cast.facing +
    (index * 2 * Math.PI) / AHRI_W.clientFireCount +
    AHRI_W.orbit.angularVelocity * (tick - cast.startTick) * DT;
  return {
    x: source.x + Math.sin(angle) * AHRI_W.orbitRadius,
    y: source.y + Math.cos(angle) * AHRI_W.orbitRadius,
  };
}

export function beginFoxFireCast(
  world: FoxFireWorld,
  source: Unit,
  rank: number,
  damage: number
): void {
  if (
    source.champion !== 'ahri' ||
    source.team === 'neutral' ||
    !Number.isFinite(damage) ||
    damage < foxFireDamage(rank, 0)
  )
    throw new Error('Invalid Fox-Fire source or payload');
  const cast: FoxFireCast = {
    id: world.nextId++,
    sourceId: source.id,
    team: source.team,
    rank,
    damage,
    startTick: world.tick,
    releaseTick: world.tick + AHRI_W_POLICY.windupTicks,
    lastTick: world.tick - 1,
    facing: source.facing,
    released: false,
    stopTick: null,
    fires: [],
  };
  cast.fires = Array.from({ length: AHRI_W.clientFireCount }, (_, index) => {
    const point = foxFireOrbitPoint(cast, index, world.tick, source);
    return {
      index,
      phase: 'orbit',
      position: point,
      previous: { ...point },
      targetId: null,
      dispatchTick: null,
      stopTick: null,
      stopReason: null,
      hit: null,
    };
  });
  world.ahriFoxFires.push(cast);
}

export function releaseFoxFireCast(world: FoxFireWorld, source: Unit, startTick: number): void {
  const cast = world.ahriFoxFires.find(
    (cast) => cast.sourceId === source.id && cast.startTick === startTick
  );
  if (!cast || cast.stopTick !== null || world.tick !== cast.releaseTick)
    throw new Error('Missing committed Fox-Fire cast');
  cast.released = true;
}

export function foxFireMovementBonus(
  world: Pick<FoxFireWorld, 'tick' | 'ahriFoxFires' | 'alive'>,
  source: Unit
): number {
  if (source.champion !== 'ahri' || !world.alive(source)) return 0;
  return world.ahriFoxFires
    .filter((cast) => cast.sourceId === source.id && cast.stopTick === null)
    .reduce(
      (bonus, cast) =>
        Math.max(
          bonus,
          AHRI_W.movementSpeedFraction *
            Math.max(0, 1 - (world.tick - cast.startTick) / AHRI_W_POLICY.movementTicks)
        ),
      0
    );
}

function finish(fire: FoxFire, tick: number, reason: NonNullable<FoxFire['stopReason']>): void {
  fire.phase = 'spent';
  fire.stopTick = tick;
  fire.stopReason = reason;
}

export function stopFoxFireOrbits(
  world: Pick<FoxFireWorld, 'tick' | 'ahriFoxFires'>,
  sourceId: number
): void {
  for (const cast of world.ahriFoxFires) {
    if (cast.sourceId !== sourceId) continue;
    cast.stopTick ??= world.tick;
    for (const fire of cast.fires) if (fire.phase === 'orbit') finish(fire, world.tick, 'death');
  }
  world.ahriFoxFires = world.ahriFoxFires.filter(
    (cast) => cast.sourceId !== sourceId || cast.fires.some((fire) => fire.phase === 'flight')
  );
}

function eligible(world: FoxFireWorld, cast: FoxFireCast, unit: Unit): boolean {
  return (
    unit.team !== cast.team &&
    world.alive(unit) &&
    world.targetable(unit) &&
    !['ward', 'turret', 'nexus', 'inhibitor'].includes(unit.kind)
  );
}

function acquire(
  world: FoxFireWorld,
  cast: FoxFireCast,
  fire: FoxFire,
  source: Unit
): Unit | undefined {
  const age = world.tick - cast.startTick;
  const priority = source.order.type === 'attack' ? world.unit(source.order.target) : undefined;
  if (
    age >= AHRI_W_POLICY.priorityDelayTicks &&
    priority &&
    eligible(world, cast, priority) &&
    world.visible(priority, cast.team) &&
    distance(fire.position, priority) <= AHRI_W.bonusAcquisitionRange
  )
    return priority;
  if (age < AHRI_W_POLICY.ordinaryDelayTicks) return undefined;
  return world.units
    .filter(
      (unit) =>
        eligible(world, cast, unit) &&
        world.visible(unit, cast.team) &&
        distance(fire.position, unit) <= AHRI_W.acquisitionRange
    )
    .sort(
      (a, b) =>
        Number(b.kind === 'champion') - Number(a.kind === 'champion') ||
        distance(fire.position, a) - distance(fire.position, b) ||
        a.id - b.id
    )[0];
}

/** Orbit follows the living caster; committed shots use local linear homing,
 * including after vision loss/death. No interception, terrain stop or refund. */
export function advanceFoxFires(world: FoxFireWorld): void {
  const survivors: FoxFireCast[] = [];
  for (const cast of world.ahriFoxFires) {
    const source = world.unit(cast.sourceId);
    if (!source) continue;
    if (cast.lastTick !== world.tick - 1)
      throw new Error('Fox-Fire requires consecutive fixed steps');
    cast.lastTick = world.tick;
    for (const fire of cast.fires) {
      if (fire.phase === 'spent') continue;
      fire.previous = { ...fire.position };
      if (fire.phase === 'orbit') {
        if (!world.alive(source) || cast.stopTick !== null) {
          finish(fire, world.tick, 'death');
          continue;
        }
        if (world.tick >= cast.startTick + AHRI_W_POLICY.orbitTicks) {
          finish(fire, world.tick, 'expired');
          continue;
        }
        fire.position = foxFireOrbitPoint(cast, fire.index, world.tick, source);
        const target = cast.released ? acquire(world, cast, fire, source) : undefined;
        if (!target) continue;
        fire.targetId = target.id;
        fire.dispatchTick = world.tick;
        fire.phase = 'flight';
        fire.previous = { ...fire.position };
      }
      const target = world.unit(fire.targetId!);
      if (!target || !eligible(world, cast, target)) {
        finish(fire, world.tick, 'lost-target');
        continue;
      }
      if (world.tick - fire.dispatchTick! >= AHRI_W_POLICY.maximumFlightTicks) {
        finish(fire, world.tick, 'expired');
        continue;
      }
      const travel = AHRI_W.damageSplineSpeed * DT,
        remaining = distance(fire.position, target);
      if (remaining <= travel) {
        fire.position = { x: target.x, y: target.y };
        const repeat = cast.fires.some(
          (other) => other !== fire && other.targetId === target.id && other.stopReason === 'hit'
        );
        const minionBonus =
          isLaneMinionKind(target.kind) && target.hp / target.maxHp <= AHRI_W.minionHealthThreshold;
        fire.hit = { repeat, minionBonus };
        finish(fire, world.tick, 'hit');
        world.damage(
          source,
          target,
          cast.damage *
            (repeat ? AHRI_W.repeatDamageMultiplier : 1) *
            (minionBonus ? AHRI_W.minionDamageMultiplier : 1),
          'magic',
          'area'
        );
      } else {
        const delta = direction(fire.position, target);
        fire.position = {
          x: fire.position.x + delta.x * travel,
          y: fire.position.y + delta.y * travel,
        };
      }
    }
    survivors.push(cast);
  }
  // A later impact can kill an owner already processed above. Decide retention
  // after every damage callback so its cancelled orbits cannot be reinserted.
  world.ahriFoxFires = survivors.filter(
    (cast) =>
      cast.fires.some((fire) => fire.phase !== 'spent') ||
      (cast.stopTick === null && world.tick < cast.startTick + AHRI_W_POLICY.movementTicks)
  );
}
