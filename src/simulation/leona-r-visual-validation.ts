import type { ChampionState, Unit } from './types';
import type { SolarFlareVisual, SolarPoseFrame } from './leona-r-visuals';
import { solarVisualExpiry } from './leona-r-visuals';
import { capturePoseFrame, samePose, validPoseFrame } from './pose-history';
import { impactTargetRig } from '../content/impact-target';
import { championDeathTicks } from './champion-death';
import { LEONA_COMBAT_POLICY as policy } from '../content/leona-combat-policy';
import { LEONA_SPELLS } from '../content/leona-spells';
import timing from '../content/leona-r-history-bounds.json';
type SavedWorld = { tick: number; nextId: number; winner: unknown; units: Unit[] };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const pointEqual = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  near(a.x, b.x) && near(a.y, b.y);
const equalAudience = (a: readonly string[], b: readonly string[]) =>
  JSON.stringify(a) === JSON.stringify(b);
const fail = () => {
  throw Error('Saved match contains invalid Solar Flare presentation.');
};
function poseHistory(
  frames: SolarPoseFrame[],
  start: number,
  end: number,
  rig: string | null,
  detached: number | null,
  target: Unit | undefined,
  now: number
) {
  if (frames.length !== end - start + 1) return false;
  for (const [i, f] of frames.entries())
    if (
      f.tick !== start + i ||
      !validPoseFrame(f, rig, detached === null || f.tick < detached) ||
      (i > 0 &&
        detached !== null &&
        f.tick > detached &&
        (!samePose(f, frames[i - 1]) || !equalAudience(f.audience, frames[i - 1].audience)))
    )
      return false;
  return (
    detached !== null ||
    end < now ||
    (!!target && target.hp > 0 && samePose(frames.at(-1)!, capturePoseFrame(target, now)))
  );
}
export function validateSolarVisuals(owner: ChampionState, source: Unit, world: SavedWorld) {
  let previous: SolarFlareVisual | undefined;
  for (const r of owner.leonaRVisuals) {
    const release = r.startTick + policy.solarWindupTicks,
      impact = r.startTick + policy.solarImpactTicks,
      rootStart = Math.max(r.startTick, world.tick - timing.bounds.sourceWindow + 1),
      d = r.death,
      hit = r.impact,
      live = owner.leonaR;
    if (
      source.champion !== 'leona' ||
      r.rank > owner.spellRanks.r ||
      r.radius !== source.radius ||
      r.startTick > world.tick ||
      world.tick >= solarVisualExpiry(r) ||
      (previous &&
        (r.startTick <= previous.startTick ||
          previous.endTick === null ||
          previous.endTick > r.startTick)) ||
      r.castFrame.tick !== r.startTick ||
      Math.hypot(r.point.x - r.castFrame.x, r.point.y - r.castFrame.y) >
        LEONA_SPELLS.r.castRange + 1e-6 ||
      (r.endTick === null) !== (r.endReason === null) ||
      (r.endTick !== null && (r.endTick < r.startTick || r.endTick > world.tick)) ||
      (r.release &&
        (r.release.tick !== release ||
          release > world.tick ||
          (r.endTick !== null && release > r.endTick))) ||
      (r.endReason === 'impact' && (!hit || !r.release || r.endTick !== impact)) ||
      (r.endReason !== 'impact' && hit !== null) ||
      (r.endReason === 'death' &&
        (r.release !== null || !d || d.tick !== r.endTick || r.endTick! >= release)) ||
      (r.endReason === 'match-end' &&
        (world.winner === null ||
          r.endTick !== world.tick ||
          r.endTick > impact ||
          (!r.release && r.endTick > release))) ||
      (r.endTick === null &&
        (world.winner !== null ||
          world.tick >= impact ||
          !live ||
          live.startTick !== r.startTick ||
          live.rank !== r.rank ||
          !pointEqual(live.point, r.point) ||
          !pointEqual(live.origin, r.castFrame) ||
          (r.release !== null) !== live.released ||
          (r.release !== null) !== world.tick >= release)) ||
      r.frames.length !== world.tick - rootStart + 1 ||
      r.frames.some(
        (f, i) =>
          f.tick !== rootStart + i ||
          !validPoseFrame(f, 'leona-base', !d || f.tick < d.tick) ||
          (d &&
            f.tick >= d.tick &&
            (!samePose(f, d.frame) || !equalAudience(f.audience, d.frame.audience)))
      ) ||
      (!d && (source.hp <= 0 || !samePose(r.frames.at(-1)!, capturePoseFrame(source, world.tick))))
    )
      fail();
    if (
      d &&
      (d.tick < r.startTick ||
        d.tick > world.tick ||
        d.level > owner.level ||
        d.frame.tick !== d.tick ||
        d.respawnTick !== d.tick + championDeathTicks(d.level, d.tick) ||
        !validPoseFrame(d.frame, 'leona-base', false) ||
        (world.tick < d.respawnTick
          ? source.deadAt !== d.tick
          : source.deadAt !== null && source.deadAt < d.respawnTick))
    )
      fail();
    if (hit) {
      if (hit.tick !== impact || hit.tick > world.tick) fail();
      let prior = 0;
      for (const c of hit.contacts) {
        const target = world.units.find((u) => u.id === c.targetId),
          distance = Math.hypot(c.point.x - r.point.x, c.point.y - r.point.y),
          end = Math.min(world.tick, hit.tick + timing.bounds.contact - 1);
        if (
          c.targetId <= prior ||
          c.targetId >= world.nextId ||
          c.targetTeam === source.team ||
          distance > LEONA_SPELLS.r.authoredOuterRadius + c.radius + 1e-6 ||
          c.center !== distance <= LEONA_SPELLS.r.authoredInnerRadius + c.radius ||
          (target &&
            (target.team !== c.targetTeam ||
              target.kind !== c.targetKind ||
              target.radius !== c.radius ||
              impactTargetRig(target) !== c.targetRig)) ||
          (c.detachedTick !== null &&
            (c.detachedTick < hit.tick ||
              c.detachedTick > end ||
              (end === world.tick && target && target.deadAt !== c.detachedTick))) ||
          !poseHistory(c.frames, hit.tick, end, c.targetRig, c.detachedTick, target, world.tick)
        )
          fail();
        prior = c.targetId;
      }
    }
    previous = r;
  }
  if (
    owner.leonaR &&
    !owner.leonaRVisuals.some((r) => r.startTick === owner.leonaR!.startTick && r.endTick === null)
  )
    fail();
}
