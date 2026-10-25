import { AHRI_PASSIVE } from '../content/ahri-passive';
import { AHRI_PASSIVE_POLICY as POLICY } from '../content/ahri-passive-policy';
import { acceleratingMotion } from './ahri-orb-motion';
import { consumeSpiritEssence } from './ahri-spirit-rush';
import { direction, distance, type Vec2 } from './math';
import { isLaneMinionKind, type Team, type Unit } from './types';
import type { SpiritRush } from './ahri-spirit-rush';

export interface EssenceCounter {
  sourceId: number;
  stacks: number;
  lastKillTick: number | null;
}
export interface AhriEssence {
  id: number;
  sourceId: number;
  team: Team;
  victimId: number;
  kind: 'minion' | 'champion';
  startTick: number;
  lastTick: number;
  level: number;
  power: number;
  heal: number;
  origin: Vec2;
  position: Vec2;
  previous: Vec2;
  stopTick: number | null;
  stopReason: 'consumed' | 'death' | 'expired' | null;
  healed: number | null;
}
interface EssenceWorld {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  ahriCounters: EssenceCounter[];
  ahriEssences: AhriEssence[];
  ahriRushes: SpiritRush[];
  unit(id: number): Unit | undefined;
  alive(u: Unit): boolean;
  abilityPower(u: Unit): number;
  championState(
    id: number
  ):
    | {
        level: number;
        damageContributors: { sourceId: number; lastDamageTick: number; creditSourceId?: number }[];
      }
    | undefined;
  emit(type: 'heal', point: Vec2, fields: { value: number; unit: number; team: Team }): void;
}
const xy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
export function essenceHeal(kind: AhriEssence['kind'], level: number, power: number): number {
  if (
    !Number.isInteger(level) ||
    level < POLICY.minimumLevel ||
    level > POLICY.maximumLevel ||
    !Number.isFinite(power) ||
    power < 0
  )
    throw new RangeError('Invalid Essence Theft heal');
  const declaration =
    AHRI_PASSIVE.healCalculations[kind === 'champion' ? 'ChampionHeal' : 'MinionHeal'];
  return (
    declaration.startValue +
    ((declaration.endValue - declaration.startValue) * (level - 1)) / 17 +
    declaration.statCoefficient * power
  );
}
function spawnEssence(
  world: EssenceWorld,
  source: Unit,
  victim: Unit,
  kind: AhriEssence['kind']
): void {
  const level = world.championState(source.id)!.level,
    power = world.abilityPower(source);
  world.ahriEssences.push({
    id: world.nextId++,
    sourceId: source.id,
    team: source.team as Team,
    victimId: victim.id,
    kind,
    startTick: world.tick,
    lastTick: world.tick,
    level,
    power,
    heal: essenceHeal(kind, level, power),
    origin: xy(victim),
    position: xy(victim),
    previous: xy(victim),
    stopTick: null,
    stopReason: null,
    healed: null,
  });
}
/** Called once per actual death after kill credit/XP. Only living enemy Ahri
 * owners participate; champion credit uses the retained recent damage owners,
 * without a visibility/range gate or shared assist/support-window substitution. */
export function onEssenceDeath(world: EssenceWorld, victim: Unit, killer: Unit | undefined): void {
  if (world.winner) return;
  if (isLaneMinionKind(victim.kind) || victim.kind === 'monster') {
    if (
      !killer ||
      killer.champion !== 'ahri' ||
      killer.team === victim.team ||
      !world.alive(killer)
    )
      return;
    const counter = world.ahriCounters.find((c) => c.sourceId === killer.id);
    if (!counter) throw Error('Ahri passive counter is missing');
    counter.stacks++;
    counter.lastKillTick = world.tick;
    if (counter.stacks === AHRI_PASSIVE.maxStacks) {
      counter.stacks = 0;
      spawnEssence(world, killer, victim, 'minion');
    }
  } else if (victim.kind === 'champion') {
    const contributors = world.championState(victim.id)!.damageContributors;
    for (const counter of world.ahriCounters) {
      const source = world.unit(counter.sourceId);
      if (!source || source.team === victim.team || !world.alive(source)) continue;
      if (
        contributors.some(
          (c) =>
            (c.creditSourceId ?? c.sourceId) === source.id &&
            world.tick - c.lastDamageTick <= POLICY.takedownWindowTicks
        )
      )
        spawnEssence(world, source, victim, 'champion');
    }
  }
}
export function stopEssences(world: EssenceWorld, sourceId: number): void {
  for (const essence of world.ahriEssences)
    if (essence.sourceId === sourceId && essence.stopTick === null) {
      essence.stopTick = world.tick;
      essence.lastTick = world.tick;
      essence.stopReason = 'death';
      essence.healed = 0;
    }
}
export function essenceTravelStep(startTick: number, tick: number): number {
  const age = (tick - startTick + 1) / 60,
    previous = Math.max(0, age - 1 / 60);
  return (
    acceleratingMotion(age, AHRI_PASSIVE.missile).distance -
    acceleratingMotion(previous, AHRI_PASSIVE.missile).distance
  );
}
/** Local homing/consumption policy. The committed source supplies kinematic
 * values, but does not attach this missile's arrival to healing/R script code. */
export function advanceEssences(world: EssenceWorld): void {
  for (const essence of world.ahriEssences) {
    if (essence.stopTick !== null) continue;
    essence.previous = xy(essence.position);
    essence.lastTick = world.tick;
    const source = world.unit(essence.sourceId);
    if (!source || !world.alive(source)) {
      essence.stopTick = world.tick;
      essence.stopReason = 'death';
      essence.healed = 0;
      continue;
    }
    if (world.tick - essence.startTick >= POLICY.maximumPursuitTicks) {
      essence.stopTick = world.tick;
      essence.stopReason = 'expired';
      essence.healed = 0;
      continue;
    }
    const step = essenceTravelStep(essence.startTick, world.tick),
      remaining = distance(essence.position, source);
    if (remaining <= step) {
      essence.position = xy(source);
      essence.stopTick = world.tick;
      essence.stopReason = 'consumed';
      essence.healed = Math.min(essence.heal, Math.max(0, source.maxHp - source.hp));
      source.hp += essence.healed;
      if (essence.healed > 0)
        world.emit('heal', source, { value: essence.healed, unit: source.id, team: essence.team });
      if (essence.kind === 'champion')
        consumeSpiritEssence(world, source.id, essence.id, essence.victimId, essence.startTick);
    } else {
      const dir = direction(essence.position, source);
      essence.position.x += dir.x * step;
      essence.position.y += dir.y * step;
    }
  }
  world.ahriEssences = world.ahriEssences.filter(
    (e) => e.stopTick === null || world.tick < e.stopTick + POLICY.historyTicks
  );
}
