import { AHRI_W } from '../content/ahri-w';
import { AHRI_W_POLICY } from '../content/ahri-w-policy';
import { DT } from '../content/rules';
import { foxFireOrbitPoint } from './ahri-fox-fires';
import { direction, distance, type Vec2 } from './math';
import type { AhriWVisualHistory, WVisualAnchor } from './ahri-w-visual-history';

/** Validate recorded motion independently of the renderer. Cross-links to live
 * casts, retained audio and global identities belong to World restore. */
export function validateWVisualMotion(r: AhriWVisualHistory, tick: number): void {
  const fail = () => {
    throw new Error('Invalid W visual motion history');
  };
  const check = (ok: boolean) => {
    if (!ok) fail();
  };
  const finite = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const same = (a: Vec2, b: Vec2) => finite(a) && finite(b) && distance(a, b) <= 1e-6;
  const clock = (t: number) => Number.isSafeInteger(t) && t >= r.startTick && t <= tick;
  const anchor = (a: WVisualAnchor) => {
    check(clock(a.tick) && finite(a.point));
    const canonical = (['blue', 'red'] as const).filter((team) => a.audience.includes(team));
    check(a.audience.includes(r.team) && JSON.stringify(a.audience) === JSON.stringify(canonical));
  };
  check(Number.isSafeInteger(r.startTick) && r.startTick >= 0 && r.startTick <= tick);
  check(r.releaseTick === r.startTick + AHRI_W_POLICY.windupTicks);
  check(Number.isFinite(r.facing) && finite(r.origin));
  check(r.fires.length === AHRI_W.clientFireCount);
  for (const [index, f] of r.fires.entries()) {
    check(f.index === index);
    anchor(f.birth);
    check(f.birth.tick === r.startTick);
    check(same(f.birth.point, foxFireOrbitPoint(r, index, r.startTick, r.origin)));
    if (f.dispatch) {
      anchor(f.dispatch);
      check(
        f.dispatch.tick >= r.releaseTick && f.dispatch.tick < r.startTick + AHRI_W_POLICY.orbitTicks
      );
      check(Number.isSafeInteger(f.dispatch.targetId) && f.dispatch.targetId > 0);
      check(
        same(f.dispatch.point, foxFireOrbitPoint(r, index, f.dispatch.tick, f.dispatch.sourcePoint))
      );
    }
    check(f.frames.length <= AHRI_W_POLICY.orbitTicks + AHRI_W_POLICY.maximumFlightTicks);
    for (const [i, frame] of f.frames.entries()) {
      anchor(frame);
      check(frame.tick === r.startTick + i && finite(frame.sourcePoint));
      const flight = f.dispatch !== null && frame.tick >= f.dispatch.tick;
      check(frame.phase === (flight ? 'flight' : 'orbit'));
      if (!flight) {
        check(frame.targetPoint === null);
        check(frame.tick < r.startTick + AHRI_W_POLICY.orbitTicks);
        check(same(frame.point, foxFireOrbitPoint(r, index, frame.tick, frame.sourcePoint)));
      } else {
        if (!frame.targetPoint || !finite(frame.targetPoint)) fail();
        const target = frame.targetPoint!;
        const previous =
          frame.tick === f.dispatch!.tick ? f.dispatch!.point : f.frames[i - 1]?.point;
        if (!previous) fail();
        const travel = AHRI_W.damageSplineSpeed * DT;
        const delta = direction(previous!, target);
        const expected =
          distance(previous!, target) <= travel
            ? target
            : {
                x: previous!.x + delta.x * travel,
                y: previous!.y + delta.y * travel,
              };
        check(same(frame.point, expected));
        check(frame.tick - f.dispatch!.tick < AHRI_W_POLICY.maximumFlightTicks);
      }
    }
    const last = f.frames.at(-1);
    if (!f.end) {
      check(last?.tick === tick);
      continue;
    }
    anchor(f.end);
    if (f.dispatch) check(f.end.tick >= f.dispatch.tick);
    check((last?.tick ?? r.startTick - 1) >= f.end.tick - 1);
    check(!last || last.tick <= f.end.tick);
    const endpoint = last?.point ?? f.birth.point;
    check(same(f.end.point, endpoint));
    if (f.end.reason === 'hit' || f.end.reason === 'lost-target') check(f.dispatch !== null);
    if (f.end.reason === 'death') check(f.dispatch === null);
    if (f.end.reason === 'hit')
      check(last?.tick === f.end.tick && same(last.point, last.targetPoint!));
    if (f.end.reason === 'expired')
      check(
        f.end.tick ===
          (f.dispatch
            ? f.dispatch.tick + AHRI_W_POLICY.maximumFlightTicks
            : r.startTick + AHRI_W_POLICY.orbitTicks)
      );
  }
}
