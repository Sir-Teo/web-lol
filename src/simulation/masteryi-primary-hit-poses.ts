import { PRIMARY_HIT_HISTORY_TICKS } from '../content/masteryi-primary-hit-timing';
import { STRUCTURE_ANIMATION_PROFILES } from '../content/structure-animation';
import { capturePoseFrame, validPoseFrame, samePose } from './pose-history';
import type { MasterYiAttackAudio } from './masteryi-aa-presentation';
import type { Unit } from './types';
import type { World } from './world';

/** Independent target pose endpoints survive target removal and source death.
 * Finalize the contact tick after animation/death/recall placement, preserving
 * its admitted audience when lethal cleanup removes its final vision source. */
export function advancePrimaryHitPoses(world: World): void {
  for (const owner of world.units) {
    if (owner.champion !== 'masteryi') continue;
    for (const record of world.championState(owner.id)?.masterYiAAAudio ?? []) {
      const hit = record.impact;
      if (!hit || world.tick >= hit.tick + PRIMARY_HIT_HISTORY_TICKS) continue;
      const target = world.unit(record.targetId),
        previous = hit.frames.at(-1)!;
      const frame =
        hit.detachedTick === null && target
          ? {
              ...capturePoseFrame(target, world.tick),
              audience: (['blue', 'red'] as const).filter((t) => world.visible(target, t)),
            }
          : { ...structuredClone(previous), tick: world.tick };
      if (
        target &&
        !world.alive(target) &&
        world.tick === hit.tick &&
        frame.x === hit.point.x &&
        frame.y === hit.point.y
      )
        frame.audience = [...hit.audience];
      if (hit.detachedTick === null && (!target || !world.alive(target)))
        hit.detachedTick = world.tick;
      if (previous.tick === frame.tick) hit.frames[hit.frames.length - 1] = frame;
      else hit.frames.push(frame);
    }
  }
}

export function validatePrimaryHitPose(
  record: MasterYiAttackAudio,
  target: Unit | undefined,
  tick: number
): void {
  const hit = record.impact;
  if (!hit) return;
  const end = Math.min(tick, hit.tick + PRIMARY_HIT_HISTORY_TICKS - 1);
  if (
    (!Object.hasOwn(STRUCTURE_ANIMATION_PROFILES, record.targetRig ?? '') &&
      hit.targetTransform !== null) ||
    (target &&
      (hit.radius !== target.radius ||
        JSON.stringify(hit.targetTransform) !==
          JSON.stringify(target.structureTransform ?? null))) ||
    hit.frames.length !== end - hit.tick + 1 ||
    (hit.detachedTick !== null && (hit.detachedTick < hit.tick || hit.detachedTick > end)) ||
    (hit.detachedTick === null &&
      end === tick &&
      (!target ||
        target.hp <= 0 ||
        !samePose(hit.frames.at(-1)!, capturePoseFrame(target, tick)))) ||
    hit.frames.some(
      (frame, index) =>
        frame.tick !== hit.tick + index ||
        (record.targetTeam !== 'neutral' && !frame.audience.includes(record.targetTeam)) ||
        !validPoseFrame(
          frame,
          record.targetRig,
          hit.detachedTick === null || frame.tick < hit.detachedTick
        ) ||
        (index > 0 &&
          hit.detachedTick !== null &&
          frame.tick > hit.detachedTick &&
          (!samePose(frame, hit.frames[index - 1]) ||
            JSON.stringify(frame.audience) !== JSON.stringify(hit.frames[index - 1].audience)))
    )
  )
    throw Error('Saved match contains invalid Master Yi primary contact pose history.');
}
