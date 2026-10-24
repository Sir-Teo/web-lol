import type { World } from './world';
import type { Unit, LuxIlluminationVisual, LuxImpactFrame, Team } from './types';
import { capturePoseFrame } from './pose-history';
import { impactTargetRig } from '../content/impact-target';
import { SUNLIGHT_VISUAL_HISTORY_TICKS } from '../content/leona-sunlight-presentation';

export interface SunlightVisual extends LuxIlluminationVisual {
  radius: number;
  frames: (LuxImpactFrame & { audience: Team[] })[];
}
function frame(world: World, target: Unit) {
  return {
    ...capturePoseFrame(target, world.tick),
    audience: (['blue', 'red'] as const).filter((t) => world.visible(target, t)),
  };
}
/** Own serial consumes neither gameplay IDs nor World RNG. Dispatch is local:
 * one accepted ally consumption creates a burst, including a lethal proc. */
export function captureSunlightVisual(world: World, source: Unit, target: Unit) {
  const first = frame(world, target);
  world.sunlightVisuals.push({
    id: world.nextSunlightVisual++,
    sourceId: source.id,
    targetId: target.id,
    team: source.team,
    startTick: world.tick,
    critical: false,
    detachedTick: null,
    targetRig: impactTargetRig(target),
    targetTransform: null,
    frames: [first],
    audience: [...first.audience],
    radius: target.radius,
  });
}
export function advanceSunlightVisuals(world: World) {
  world.sunlightVisuals = world.sunlightVisuals.filter(
    (v) => world.tick < v.startTick + SUNLIGHT_VISUAL_HISTORY_TICKS
  );
  for (const v of world.sunlightVisuals) {
    const target = world.unit(v.targetId),
      previous = v.frames.at(-1)!;
    const current =
      (v.detachedTick === null || v.detachedTick === world.tick) && target
        ? frame(world, target)
        : { ...structuredClone(previous), tick: world.tick };
    if (v.detachedTick === null && (!target || !world.alive(target))) v.detachedTick = world.tick;
    if (previous.tick === world.tick) v.frames[v.frames.length - 1] = current;
    else v.frames.push(current);
  }
}
