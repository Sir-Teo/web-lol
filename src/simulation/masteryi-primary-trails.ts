import { renderedEventTick } from './rendered-event-clock';
import {
  PRIMARY_TRAIL_HISTORY_TICKS,
  PRIMARY_TRAIL_MARKERS,
} from '../content/masteryi-primary-trail-timing';
import { appendActorRoot, validateActorRoots } from './actor-root-history';
import { alphaVanished } from './masteryi-alpha-strike';
import type { MasterYiAttackAudio } from './masteryi-aa-presentation';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';
/** Exact first fixed-step crossing of the current primary pose's rendered
 * sample clock. This does not assign native event-clock semantics. */
export function primaryTrailMarkerTick(
  record: Pick<MasterYiAttackAudio, 'startTick' | 'endTick' | 'kind'>
): number {
  return renderedEventTick(
    record,
    PRIMARY_TRAIL_MARKERS[record.kind],
    'Invalid primary trail cycle'
  );
}
export function primaryTrailExpiry(record: MasterYiAttackAudio): number {
  return primaryTrailMarkerTick(record) + 1 + PRIMARY_TRAIL_HISTORY_TICKS;
}
/** Existing validated primary admissions own this rolling visibility history.
 * Cancellation/death cutoff and marker admission remain renderer policies. */
export function advancePrimaryTrailRoots(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const owner = world.championState(unit.id)!;
    if (!owner.masterYiAAAudio.length) continue;
    const frame = {
      tick: world.tick,
      x: unit.x,
      y: unit.y,
      facing: unit.facing,
      audience: (['blue', 'red'] as const).filter(
        (t) => !alphaVanished(owner) && world.visible(unit, t)
      ),
    };
    for (const record of owner.masterYiAAAudio) {
      if (world.tick >= primaryTrailExpiry(record)) {
        if (record.trailFrames.length) record.trailFrames = [];
        continue;
      }
      appendActorRoot(record.trailFrames, frame);
      const first = Math.max(record.startTick, world.tick - PRIMARY_TRAIL_HISTORY_TICKS + 1);
      while (record.trailFrames[0].endTick < first) record.trailFrames.shift();
      record.trailFrames[0].tick = Math.max(first, record.trailFrames[0].tick);
    }
  }
}
export function validatePrimaryTrailRoots(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number }
): void {
  for (const record of owner.masterYiAAAudio) {
    if (world.tick >= primaryTrailExpiry(record)) {
      if (record.trailFrames.length) throw Error('Saved primary trail retained expired roots');
      continue;
    }
    validateActorRoots(
      record.trailFrames,
      Math.max(record.startTick, world.tick - PRIMARY_TRAIL_HISTORY_TICKS + 1),
      world.tick
    );
    const last = record.trailFrames.at(-1)!;
    if (
      last.x !== unit.x ||
      last.y !== unit.y ||
      last.facing !== unit.facing ||
      (alphaVanished(owner)
        ? last.audience.length !== 0
        : !last.audience.includes(unit.team as Team))
    )
      throw Error('Saved primary trail endpoint differs');
  }
}
