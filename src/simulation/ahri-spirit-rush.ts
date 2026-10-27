import { AHRI_R } from '../content/ahri-r';
import { AHRI_R_POLICY as POLICY } from '../content/ahri-r-policy';
import { DT } from '../content/rules';
import { direction, distance, type Vec2 } from './math';
import { isStructureKind, type Team, type Unit } from './types';

export interface SpiritBolt {
  index: number;
  targetId: number;
  position: Vec2;
  previous: Vec2;
  stopTick: number | null;
  stopReason: 'hit' | 'lost-target' | 'expired' | null;
}
export interface SpiritBurst {
  index: number;
  rank: number;
  startTick: number;
  damage: number;
  origin: Vec2;
  destination: Vec2;
  lastTick: number;
  stopTick: number | null;
  stopReason: 'arrived' | 'control' | 'death' | 'flash' | null;
  stopPoint: Vec2 | null;
  control: { rootUntil: number; stunUntil: number; charmUntil: number } | null;
  bolts: SpiritBolt[];
}
export interface SpiritReset {
  essenceId: number;
  victimId: number;
  spawnTick: number;
  consumeTick: number;
  previousEndTick: number;
  endTick: number;
  previousRemaining: number;
  remaining: number;
}
export interface SpiritRush {
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  endTick: number;
  nextCastTick: number;
  remainingCasts: number;
  stopTick: number | null;
  stopReason: 'expired' | 'death' | null;
  bursts: SpiritBurst[];
  resets: SpiritReset[];
}
interface RushWorld {
  tick: number;
  nextId: number;
  ahriRushes: SpiritRush[];
  units: Unit[];
  battlefield: { reachable(point: Vec2, radius: number, team: Team): Vec2 };
  unit(id: number): Unit | undefined;
  alive(unit: Unit): boolean;
  targetable(unit: Unit): boolean;
  visible(unit: Unit, team: Team): boolean;
  damage(source: Unit, target: Unit, raw: number, kind: 'magic', category: 'area'): void;
}
const xy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });

export function spiritRushDamage(rank: number, power: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 3 || !Number.isFinite(power) || power < 0)
    throw new RangeError('Invalid Spirit Rush payload');
  return AHRI_R.damageByRank[rank - 1] + power * AHRI_R.abilityPowerRatio;
}
export function activeSpiritRush(
  world: Pick<RushWorld, 'tick' | 'ahriRushes'>,
  sourceId: number
): SpiritRush | undefined {
  return world.ahriRushes.find(
    (r) => r.sourceId === sourceId && r.stopTick === null && world.tick < r.endTick
  );
}
/** Local Essence policy: consumption restores one stored cast (cap three) and
 * ensures at least ten seconds remain, adding at most ten seconds. The source
 * client intent does not establish this precise native update/ordering rule. */
export function consumeSpiritEssence(
  world: Pick<RushWorld, 'tick' | 'nextId' | 'ahriRushes'>,
  sourceId: number,
  essenceId: number,
  victimId: number,
  spawnTick: number
): boolean {
  const rush = activeSpiritRush(world, sourceId);
  if (!rush) return false;
  if (
    !Number.isSafeInteger(essenceId) ||
    essenceId <= 0 ||
    essenceId >= world.nextId ||
    essenceId === rush.id ||
    !Number.isSafeInteger(victimId) ||
    victimId <= 0 ||
    victimId >= world.nextId ||
    victimId === sourceId ||
    !Number.isSafeInteger(spawnTick) ||
    spawnTick < 0 ||
    spawnTick > world.tick ||
    world.ahriRushes.some((r) => r.resets.some((reset) => reset.essenceId === essenceId))
  )
    throw Error('Invalid champion Essence reset');
  const endTick = Math.max(
      rush.endTick,
      world.tick + Math.round(AHRI_R.passiveDurationExtensionSeconds * 60)
    ),
    remaining = Math.min(AHRI_R.maxCasts, rush.remainingCasts + AHRI_R.resetCasts);
  rush.resets.push({
    essenceId,
    victimId,
    spawnTick,
    consumeTick: world.tick,
    previousEndTick: rush.endTick,
    endTick,
    previousRemaining: rush.remainingCasts,
    remaining,
  });
  rush.endTick = endTick;
  rush.remainingCasts = remaining;
  return true;
}
export function activeSpiritDash(world: RushWorld, sourceId: number): SpiritBurst | undefined {
  return world.ahriRushes
    .find((r) => r.sourceId === sourceId && r.bursts.at(-1)?.stopTick === null)
    ?.bursts.at(-1);
}
/** Endpoint correction is bounded by the named dash distance. Traversal ignores walls;
 * reachable chooses walkable landing ground, with a deterministic inward backoff. */
export function spiritRushDestination(world: RushWorld, source: Unit, point: Vec2): Vec2 | null {
  if (source.team === 'neutral' || !Number.isFinite(point.x) || !Number.isFinite(point.y))
    return null;
  const dir = direction(source, point),
    desired = Math.min(AHRI_R.dashDistance, distance(source, point));
  if (!desired) return null;
  for (let d = desired; d > 0; d = Math.max(0, d - POLICY.endpointBackoff)) {
    const end = world.battlefield.reachable(
      { x: source.x + dir.x * d, y: source.y + dir.y * d },
      source.radius,
      source.team
    );
    const length = distance(source, end);
    if (length > 1e-8 && length <= AHRI_R.dashDistance + 1e-8) return xy(end);
  }
  return null;
}
/** Local dispatch policy: select distinct visible enemies at each cast's origin,
 * champions first, then squared distance/ID; no native acquisition callback is claimed. */
export function beginSpiritRush(
  world: RushWorld,
  source: Unit,
  rank: number,
  damage: number,
  destination: Vec2
): SpiritBurst {
  if (
    source.champion !== 'ahri' ||
    source.team === 'neutral' ||
    !world.alive(source) ||
    damage < spiritRushDamage(rank, 0) ||
    !Number.isFinite(damage) ||
    activeSpiritDash(world, source.id) ||
    distance(source, destination) <= 1e-8 ||
    distance(source, destination) > AHRI_R.dashDistance + 1e-8
  )
    throw new Error('Invalid Spirit Rush cast');
  let rush = activeSpiritRush(world, source.id);
  if (rush && (rush.remainingCasts === 0 || world.tick < rush.nextCastTick))
    throw new Error('Spirit Rush recast unavailable');
  if (!rush) {
    rush = {
      id: world.nextId++,
      sourceId: source.id,
      team: source.team,
      startTick: world.tick,
      endTick: world.tick + POLICY.recastWindowTicks,
      nextCastTick: world.tick,
      remainingCasts: AHRI_R.maxCasts,
      stopTick: null,
      stopReason: null,
      bursts: [],
      resets: [],
    };
    world.ahriRushes.push(rush);
  }
  const candidates = world.units
    .filter(
      (u) =>
        u.team !== source.team &&
        world.alive(u) &&
        world.targetable(u) &&
        !isStructureKind(u.kind) &&
        u.kind !== 'ward' &&
        !(u.kind === 'monster' && u.monster.phase === 'returning') &&
        world.visible(u, source.team as Team) &&
        distance(source, u) <= AHRI_R.acquisitionRange
    )
    .sort(
      (a, b) =>
        Number(b.kind === 'champion') - Number(a.kind === 'champion') ||
        distance(source, a) - distance(source, b) ||
        a.id - b.id
    )
    .slice(0, AHRI_R.maxTargets);
  const burst: SpiritBurst = {
    index: rush.bursts.length,
    rank,
    startTick: world.tick,
    damage,
    origin: xy(source),
    destination: xy(destination),
    lastTick: world.tick,
    stopTick: null,
    stopReason: null,
    stopPoint: null,
    control: null,
    bolts: candidates.map((target, index) => ({
      index,
      targetId: target.id,
      position: xy(source),
      previous: xy(source),
      stopTick: null,
      stopReason: null,
    })),
  };
  rush.remainingCasts--;
  rush.nextCastTick = world.tick + POLICY.recastLockoutTicks;
  rush.bursts.push(burst);
  return burst;
}
export function stopSpiritDash(
  world: RushWorld,
  source: Unit,
  reason: NonNullable<SpiritBurst['stopReason']>
): void {
  const dash = activeSpiritDash(world, source.id);
  if (!dash) return;
  const point = world.battlefield.reachable(source, source.radius, source.team as Team);
  source.x = point.x;
  source.y = point.y;
  source.path = [];
  source.pathTarget = source.pathDestination = null;
  source.nextPathTick = world.tick;
  dash.stopTick = world.tick;
  dash.stopReason = reason;
  dash.stopPoint = xy(source);
  dash.lastTick = world.tick;
  dash.control =
    reason === 'control'
      ? {
          rootUntil: source.rootUntil,
          stunUntil: source.stunUntil,
          charmUntil: source.charm?.endTick ?? 0,
        }
      : null;
}
export function advanceSpiritDash(world: RushWorld, source: Unit): void {
  const dash = activeSpiritDash(world, source.id);
  if (!dash) return;
  if (!world.alive(source)) {
    stopSpiritDash(world, source, 'death');
    return;
  }
  if (source.rootUntil > world.tick || source.stunUntil > world.tick || source.charm) {
    stopSpiritDash(world, source, 'control');
    return;
  }
  // Compute from the accepted origin and fixed clock. Accumulated vector steps
  // otherwise drift across the arrival boundary for ordinary angled dashes.
  const dir = direction(dash.origin, dash.destination),
    total = distance(dash.origin, dash.destination),
    travel = Math.min(total, (world.tick - dash.startTick + 1) * AHRI_R.baseDashSpeed * DT),
    arrived = total - travel <= POLICY.arrivalEpsilon;
  const point = arrived
    ? dash.destination
    : { x: dash.origin.x + dir.x * travel, y: dash.origin.y + dir.y * travel };
  source.x = point.x;
  source.y = point.y;
  source.facing = Math.atan2(dir.x, dir.y);
  dash.lastTick = world.tick;
  if (arrived) stopSpiritDash(world, source, 'arrived');
}
export function stopSpiritRush(world: RushWorld, source: Unit): void {
  stopSpiritDash(world, source, 'death');
  for (const rush of world.ahriRushes)
    if (rush.sourceId === source.id && rush.stopTick === null) {
      rush.stopTick = world.tick;
      rush.stopReason = 'death';
      rush.remainingCasts = 0;
    }
  world.ahriRushes = world.ahriRushes.filter(
    (r) =>
      r.stopTick === null ||
      r.bursts.some((b) => b.stopTick === null || b.bolts.some((p) => p.stopTick === null))
  );
}
/** Expiry precedes new commands. An already accepted dash/bolt completes beyond the window. */
export function expireSpiritRushes(world: RushWorld): void {
  for (const rush of world.ahriRushes) {
    const source = world.unit(rush.sourceId);
    if (!source || !world.alive(source)) {
      if (source) stopSpiritRush(world, source);
    }
    if (rush.stopTick === null && world.tick >= rush.endTick) {
      rush.stopTick = rush.endTick;
      rush.stopReason = 'expired';
      rush.remainingCasts = 0;
    }
  }
}
/** Captured single-target bolts home linearly at the child speed. Terrain/other
 * bodies do not intercept; target loss spends the bolt; pursuit is locally bounded. */
export function advanceSpiritBolts(world: RushWorld): void {
  for (const rush of world.ahriRushes)
    for (const burst of rush.bursts)
      for (const bolt of burst.bolts) {
        if (bolt.stopTick !== null) continue;
        bolt.previous = xy(bolt.position);
        const target = world.unit(bolt.targetId),
          source = world.unit(rush.sourceId);
        if (
          !source ||
          !target ||
          !world.alive(target) ||
          !world.targetable(target) ||
          (target.kind === 'monster' && target.monster.phase === 'returning')
        ) {
          bolt.stopTick = world.tick;
          bolt.stopReason = 'lost-target';
          continue;
        }
        if (world.tick - burst.startTick >= POLICY.maximumBoltTicks) {
          bolt.stopTick = world.tick;
          bolt.stopReason = 'expired';
          continue;
        }
        const remaining = distance(bolt.position, target),
          step = AHRI_R.missile.speed * DT;
        if (remaining <= step) {
          bolt.position = xy(target);
          bolt.stopTick = world.tick;
          bolt.stopReason = 'hit';
          world.damage(source, target, burst.damage, 'magic', 'area');
        } else {
          const dir = direction(bolt.position, target);
          bolt.position.x += dir.x * step;
          bolt.position.y += dir.y * step;
        }
      }
  // Damage callbacks can stop earlier records; retain only after all callbacks finish.
  world.ahriRushes = world.ahriRushes.filter(
    (r) =>
      r.stopTick === null ||
      r.bursts.some((b) => b.stopTick === null || b.bolts.some((p) => p.stopTick === null))
  );
}
