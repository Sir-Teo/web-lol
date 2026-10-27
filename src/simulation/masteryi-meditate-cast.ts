import { MEDITATE_CAST_HISTORY_TICKS } from '../content/masteryi-w-cast-timing';
import { alphaVanished } from './masteryi-alpha-strike';
import type { ChampionState, Team, Unit } from './types';
import type { World } from './world';

export interface MeditateCastFrame {
  tick: number;
  x: number;
  y: number;
  facing: number;
  audience: Team[];
}
export interface MeditateCastVisual {
  startTick: number;
  rank: number;
  audience: Team[];
  detachedTick: number | null;
  frames: MeditateCastFrame[];
}
function frame(world: World, unit: Unit): MeditateCastFrame {
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter(
      (team) => !alphaVanished(world.championState(unit.id)) && world.visible(unit, team)
    ),
  };
}
/** Creation is independent of subsequent channel interruption. This finite
 * local actor-root adapter does not assert native particle/script callbacks. */
export function captureMeditateCast(world: World, unit: Unit): void {
  const owner = world.championState(unit.id);
  if (unit.champion !== 'masteryi' || !owner?.meditate) return;
  const first = frame(world, unit);
  owner.meditateCastVisuals.push({
    startTick: world.tick,
    rank: owner.meditate.rank,
    audience: [...first.audience],
    detachedTick: null,
    frames: [first],
  });
}

export function advanceMeditateCasts(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const records = world.championState(unit.id)?.meditateCastVisuals;
    if (!records?.length) continue;
    for (const record of records) {
      if (world.tick >= record.startTick + MEDITATE_CAST_HISTORY_TICKS) continue;
      const previous = record.frames.at(-1)!;
      const current =
        record.detachedTick === null
          ? frame(world, unit)
          : { ...structuredClone(previous), tick: world.tick };
      if (!world.alive(unit) && record.detachedTick === null) {
        record.detachedTick = world.tick;
        if (world.tick === record.startTick) current.audience = [...record.audience];
      }
      if (previous.tick === world.tick) record.frames[record.frames.length - 1] = current;
      else record.frames.push(current);
    }
  }
}

export function validateMeditateCasts(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number }
): void {
  let before = -1;
  for (const record of owner.meditateCastVisuals) {
    const last = record.frames.at(-1)!;
    if (
      unit.champion !== 'masteryi' ||
      record.rank > owner.spellRanks.w ||
      record.startTick <= before ||
      record.startTick > world.tick ||
      world.tick >= record.startTick + MEDITATE_CAST_HISTORY_TICKS ||
      !record.audience.includes(unit.team as Team) ||
      record.frames.length !== world.tick - record.startTick + 1 ||
      (record.detachedTick !== null &&
        (record.detachedTick < record.startTick ||
          record.detachedTick > world.tick ||
          unit.deadAt === null)) ||
      (record.detachedTick === null &&
        (unit.hp <= 0 || last.x !== unit.x || last.y !== unit.y || last.facing !== unit.facing)) ||
      (owner.meditate?.startTick === record.startTick && owner.meditate.rank !== record.rank)
    )
      throw Error('Saved match contains invalid Meditate cast history.');
    record.frames.forEach((f, index) => {
      const previous = record.frames[index - 1];
      if (
        f.tick !== record.startTick + index ||
        (previous &&
          record.detachedTick !== null &&
          f.tick > record.detachedTick &&
          (f.x !== previous.x ||
            f.y !== previous.y ||
            f.facing !== previous.facing ||
            JSON.stringify(f.audience) !== JSON.stringify(previous.audience)))
      )
        throw Error('Saved match contains invalid Meditate cast frames.');
    });
    before = record.startTick;
  }
  if (
    owner.meditate &&
    world.tick < owner.meditate.startTick + MEDITATE_CAST_HISTORY_TICKS &&
    !owner.meditateCastVisuals.some((record) => record.startTick === owner.meditate!.startTick)
  )
    throw Error('Saved match lacks its accepted Meditate cast.');
}
