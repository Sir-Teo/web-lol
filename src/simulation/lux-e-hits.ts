import { LUX_E_HIT_HISTORY_TICKS } from '../content/lux-e-hit';
import type { World } from './world';
import type { Singularity, Unit } from './types';

/** Accepted contact, before damage can kill/remove the victim. Cosmetic history
 * shares the zone/target tuple and consumes no entity ID or World RNG draw. */
export function recordLuxEHit(world: World, zone: Singularity, target: Unit) {
  zone.hits.push({
    targetId: target.id,
    targetTeam: target.team,
    targetRadius: target.radius,
    contact: { x: target.x, y: target.y },
    audience: (['blue', 'red'] as const).filter((team) => world.visible(target, team)),
    detachedTick: null,
    frames: [{ tick: world.tick, x: target.x, y: target.y }],
  });
}
/** End-of-step endpoints survive saves, death, removal and render seeks. A dead
 * victim freezes at its death endpoint; records retire after the source lifetime
 * plus the interpolation endpoint. Victory holds the last saved endpoint. */
export function advanceLuxEHits(world: World) {
  for (const zone of world.singularities) {
    if (zone.detonatedTick === null) continue;
    if (world.tick >= zone.detonatedTick + LUX_E_HIT_HISTORY_TICKS) {
      zone.hits = [];
      continue;
    }
    for (const hit of zone.hits) {
      const target = world.unit(hit.targetId),
        previous = hit.frames.at(-1)!;
      const point = hit.detachedTick === null && target ? target : previous;
      const frame = { tick: world.tick, x: point.x, y: point.y };
      if (hit.detachedTick === null && (!target || !world.alive(target)))
        hit.detachedTick = world.tick;
      if (previous.tick === world.tick) hit.frames[hit.frames.length - 1] = frame;
      else hit.frames.push(frame);
    }
  }
}
