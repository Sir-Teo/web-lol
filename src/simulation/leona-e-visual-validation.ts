import type { ChampionState, Projectile, Unit } from './types';
import type { ZenithPointFrame, ZenithPoseFrame, ZenithVisual } from './leona-e-visuals';
import { zenithExpiry } from './leona-e-visuals';
import { samePose, validPoseFrame, capturePoseFrame } from './pose-history';
import { impactTargetRig } from '../content/impact-target';
import { championDeathTicks } from './champion-death';
import { sweepCircle } from './math';
import { LEONA_COMBAT_POLICY as policy } from '../content/leona-combat-policy';
import { LEONA_SPELLS } from '../content/leona-spells';
import timing from '../content/leona-e-history-bounds.json';

type SavedWorld = {
  tick: number;
  nextId: number;
  winner: unknown;
  units: Unit[];
  projectiles: Projectile[];
};
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const pointEqual = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  near(a.x, b.x) && near(a.y, b.y);
const rootEqual = (a: ZenithPointFrame, b: ZenithPointFrame) =>
  pointEqual(a, b) &&
  a.facing === b.facing &&
  JSON.stringify(a.audience) === JSON.stringify(b.audience);
const fail = () => {
  throw Error('Saved match contains invalid Zenith presentation.');
};
function poseHistory(
  frames: ZenithPoseFrame[],
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
        (!samePose(f, frames[i - 1]) ||
          JSON.stringify(f.audience) !== JSON.stringify(frames[i - 1].audience)))
    )
      return false;
  return (
    detached !== null ||
    end < now ||
    (!!target && target.hp > 0 && samePose(frames.at(-1)!, capturePoseFrame(target, now)))
  );
}
export function validateZenithVisuals(owner: ChampionState, source: Unit, world: SavedWorld) {
  const flightTicks = Math.ceil(
      (LEONA_SPELLS.e.missile.castRange * 60) / LEONA_SPELLS.e.missile.speed
    ),
    range = LEONA_SPELLS.e.missile.castRange,
    step = LEONA_SPELLS.e.missile.speed / 60;
  let previous: ZenithVisual | undefined;
  for (const r of owner.leonaEVisuals) {
    const f = r.flight,
      d = r.dash,
      a = r.arrival,
      death = r.death,
      live = world.projectiles.find((p) => p.id === f?.id),
      release = r.startTick + policy.zenithWindupTicks,
      rootStart = Math.max(r.startTick, world.tick - timing.bounds.sourceWindow + 1);
    if (
      source.champion !== 'leona' ||
      r.rank > owner.spellRanks.e ||
      r.radius !== source.radius ||
      r.startTick > world.tick ||
      world.tick >= zenithExpiry(r) ||
      (previous &&
        (r.startTick <= previous.startTick ||
          previous.endTick === null ||
          previous.endTick > r.startTick)) ||
      (r.endTick === null) !== (r.endReason === null) ||
      (r.endTick !== null && (r.endTick < r.startTick || r.endTick > world.tick)) ||
      r.castFrame.tick !== r.startTick ||
      !near(Math.hypot(r.direction.x, r.direction.y), 1) ||
      !near(Math.sin(r.castFrame.facing), r.direction.x) ||
      !near(Math.cos(r.castFrame.facing), r.direction.y) ||
      r.frames.length !== world.tick - rootStart + 1 ||
      r.frames.some(
        (p, i) =>
          p.tick !== rootStart + i || (death && p.tick >= death.tick && !rootEqual(p, death.frame))
      ) ||
      (!death &&
        (!pointEqual(r.frames.at(-1)!, source) ||
          r.frames.at(-1)!.facing !== source.facing ||
          source.hp <= 0))
    )
      fail();
    if (death) {
      if (
        death.tick < r.startTick ||
        death.tick > world.tick ||
        death.level > owner.level ||
        death.respawnTick !== death.tick + championDeathTicks(death.level, death.tick) ||
        death.frame.tick !== death.tick ||
        (world.tick < death.respawnTick
          ? source.deadAt !== death.tick
          : source.deadAt !== null && source.deadAt < death.respawnTick)
      )
        fail();
    }
    if (!f) {
      if (
        d ||
        a ||
        (r.endTick === null
          ? owner.leonaEWindup?.startTick !== r.startTick ||
            owner.leonaEWindup.rank !== r.rank ||
            !pointEqual(owner.leonaEWindup.origin, r.castFrame) ||
            !pointEqual(owner.leonaEWindup.direction, r.direction) ||
            world.winner !== null ||
            world.tick >= release
          : r.endTick > release ||
            !['death', 'match-end'].includes(r.endReason!) ||
            (r.endReason === 'death' && death?.tick !== r.endTick) ||
            (r.endReason === 'match-end' && (world.winner === null || r.endTick !== world.tick)))
      )
        fail();
    } else {
      const end = f.stopTick ?? world.tick;
      if (
        f.id >= world.nextId ||
        f.id === source.id ||
        world.units.some((u) => u.id === f.id) ||
        f.startTick !== release ||
        f.startTick > world.tick ||
        (f.stopTick === null) !== (f.endReason === null) ||
        end < f.startTick ||
        end > world.tick ||
        end >= f.startTick + flightTicks ||
        f.frames.length !== end - f.startTick + 1 ||
        (f.endReason === 'range' && f.stopTick !== f.startTick + flightTicks - 1) ||
        (f.endReason === 'match-end' &&
          (world.winner === null ||
            f.stopTick !== world.tick ||
            d ||
            r.endTick !== f.stopTick ||
            r.endReason !== 'match-end')) ||
        (f.stopTick === null
          ? !live ||
            live.type !== 'zenith' ||
            live.source !== source.id ||
            live.zenith?.castTick !== r.startTick ||
            live.zenith.rank !== r.rank ||
            !pointEqual(live.direction, r.direction) ||
            !live.origin ||
            !pointEqual(live.origin, f.origin) ||
            r.endTick !== null ||
            d !== null ||
            world.winner !== null
          : !!live)
      )
        fail();
      for (const [i, p] of f.frames.entries()) {
        const normalDistance = Math.min(range, (i + 1) * step),
          priorDistance = Math.min(range, i * step);
        const validDistance = (distance: number) =>
          pointEqual(p, {
            x: f.origin.x + r.direction.x * distance,
            y: f.origin.y + r.direction.y * distance,
          }) && near(p.remaining, range - distance);
        if (
          p.tick !== f.startTick + i ||
          (!validDistance(normalDistance) &&
            !(p.tick === f.stopTick && f.endReason === 'match-end' && validDistance(priorDistance)))
        )
          fail();
      }
      if (
        live &&
        (!pointEqual(f.frames.at(-1)!, live) || !near(f.frames.at(-1)!.remaining, live.remaining))
      )
        fail();
      const ids = new Set<number>();
      let last: NonNullable<ZenithVisual['flight']>['contacts'][number] | undefined;
      for (const c of f.contacts) {
        const index = c.tick - f.startTick,
          first = c.frames[0],
          target = world.units.find((u) => u.id === c.targetId),
          frameEnd = Math.min(world.tick, c.tick + timing.bounds.contact - 1);
        if (
          index < 0 ||
          index >= f.frames.length ||
          c.targetId >= world.nextId ||
          ids.has(c.targetId) ||
          c.targetTeam === source.team ||
          ['ward', 'turret', 'inhibitor', 'nexus'].includes(c.targetKind) ||
          (last &&
            (c.tick < last.tick ||
              (c.tick === last.tick &&
                (c.fraction < last.fraction ||
                  (c.fraction === last.fraction && c.targetId <= last.targetId))))) ||
          (target &&
            (target.kind !== c.targetKind ||
              target.team !== c.targetTeam ||
              impactTargetRig(target) !== c.targetRig ||
              target.radius !== c.radius)) ||
          (c.detachedTick !== null &&
            (c.detachedTick < c.tick ||
              c.detachedTick > frameEnd ||
              (frameEnd === world.tick && target && target.deadAt !== c.detachedTick))) ||
          !poseHistory(c.frames, c.tick, frameEnd, c.targetRig, c.detachedTick, target, world.tick)
        )
          fail();
        const from = index === 0 ? f.origin : f.frames[index - 1],
          to = f.frames[index],
          fraction = sweepCircle(from, to, first, policy.zenithRadius + c.radius);
        if (
          fraction === null ||
          !near(fraction, c.fraction) ||
          !pointEqual(c.point, {
            x: from.x + (to.x - from.x) * c.fraction,
            y: from.y + (to.y - from.y) * c.fraction,
          })
        )
          fail();
        ids.add(c.targetId);
        last = c;
      }
      const lastChampion =
        f.contacts.filter((c) => c.targetKind === 'champion').at(-1)?.targetId ?? null;
      if (
        live &&
        (JSON.stringify(live.zenith!.hits) !== JSON.stringify([...ids]) ||
          live.zenith!.lastChampionId !== lastChampion)
      )
        fail();
      if (d) {
        if (
          f.endReason !== 'range' ||
          d.startTick !== f.stopTick ||
          d.startFrame.tick !== d.startTick ||
          d.targetId !== lastChampion ||
          (d.stopTick === null) !== (d.endReason === null) ||
          (d.stopTick === null) !== (d.stopFrame === null) ||
          (d.stopTick === null) !== (d.stopCause === null) ||
          (d.stopTick === null
            ? r.endTick !== null ||
              owner.leonaDash?.castTick !== r.startTick ||
              owner.leonaDash.targetId !== d.targetId ||
              owner.leonaDash.startTick !== d.startTick ||
              death !== null ||
              world.winner !== null
            : (d.stopTick <= d.startTick && d.endReason === 'arrived') ||
              d.stopTick < d.startTick ||
              d.stopTick > world.tick ||
              d.stopFrame!.tick !== d.stopTick ||
              r.endTick !== d.stopTick ||
              r.endReason !== d.endReason ||
              (d.endReason === 'death' && death?.tick !== d.stopTick) ||
              (d.endReason === 'match-end' && (world.winner === null || d.stopTick !== world.tick)))
        )
          fail();
        const cause = d.stopCause;
        if (cause && d.stopTick !== null) {
          const controlled =
            cause.rootUntil > d.stopTick ||
            cause.stunUntil > d.stopTick ||
            (cause.charmUntil ?? 0) > d.stopTick;
          if (
            (cause.targetAlive && !cause.targetPoint) ||
            cause.targetRadius !== f.contacts.find((c) => c.targetId === d.targetId)!.radius ||
            (d.endReason === 'control' && (!controlled || !cause.targetAlive)) ||
            (d.endReason === 'target-lost' && cause.targetAlive) ||
            (d.endReason === 'arrived' &&
              (controlled ||
                !cause.targetAlive ||
                !cause.targetPoint ||
                Math.hypot(
                  cause.attemptPoint.x - cause.targetPoint.x,
                  cause.attemptPoint.y - cause.targetPoint.y
                ) >
                  r.radius + cause.targetRadius + 1e-6))
          )
            fail();
        }
      } else if (
        a ||
        (f.stopTick !== null && (r.endTick !== f.stopTick || r.endReason !== f.endReason))
      )
        fail();
    }
    if (a) {
      const frameEnd = Math.min(world.tick, a.tick + timing.bounds.arrival - 1),
        dead = death && death.tick >= a.tick && death.tick <= frameEnd ? death.tick : null;
      if (
        !d ||
        d.endReason !== 'arrived' ||
        a.tick !== d.stopTick ||
        a.detachedTick !== dead ||
        (death && death.tick < a.tick) ||
        !poseHistory(a.frames, a.tick, frameEnd, 'leona-base', a.detachedTick, source, world.tick)
      )
        fail();
    } else if (d?.endReason === 'arrived') fail();
    previous = r;
  }
  if (
    owner.leonaEWindup &&
    !owner.leonaEVisuals.some(
      (r) =>
        r.startTick === owner.leonaEWindup!.startTick && r.endTick === null && r.flight === null
    )
  )
    fail();
  if (
    owner.leonaDash &&
    !owner.leonaEVisuals.some(
      (r) => r.startTick === owner.leonaDash!.castTick && r.dash?.stopTick === null
    )
  )
    fail();
  for (const p of world.projectiles.filter((p) => p.type === 'zenith' && p.source === source.id))
    if (!owner.leonaEVisuals.some((r) => r.flight?.id === p.id && r.flight.stopTick === null))
      fail();
}
