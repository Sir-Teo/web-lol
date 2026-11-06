import { AHRI_W_POLICY } from '../content/ahri-w-policy';
import { AHRI_FOX_FIRE_AUDIO_TICKS as T } from '../content/ahri-fox-fire-audio-timing';
import type { FoxFire, FoxFireCast } from './ahri-fox-fires';
import type { Vec2 } from './math';
import type { Team, Unit } from './types';
import type { World } from './world';

export interface AhriFoxFireAudioRecord {
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  facing: number;
  origin: Vec2;
  audience: Team[];
  activationStop: {
    tick: number;
    point: Vec2;
    reason: 'released' | 'expired' | 'death' | 'match-end';
    audience: Team[];
  } | null;
  fires: {
    index: number;
    launch: {
      tick: number;
      targetId: number;
      sourcePoint: Vec2;
      origin: Vec2;
      currentPoint: Vec2;
      audience: Team[];
    } | null;
    end: {
      tick: number;
      point: Vec2;
      reason: 'hit' | 'lost-target' | 'expired' | 'death' | 'match-end';
      audience: Team[];
    } | null;
  }[];
}
export interface FoxFireAudioWorld {
  tick: number;
  ahriFoxFireAudio?: AhriFoxFireAudioRecord[];
  pointVisible?(point: Vec2, team: Team): boolean;
  unit(id: number): Unit | undefined;
}
const point = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const audience = (w: FoxFireAudioWorld, p: Vec2, team: Team): Team[] =>
  (['blue', 'red'] as Team[]).filter((t) => t === team || w.pointVisible?.(p, t));
const record = (w: FoxFireAudioWorld, cast: FoxFireCast) =>
  w.ahriFoxFireAudio?.find((r) => r.id === cast.id);
function stopActivation(
  w: FoxFireAudioWorld,
  r: AhriFoxFireAudioRecord,
  reason: NonNullable<AhriFoxFireAudioRecord['activationStop']>['reason']
) {
  if (r.activationStop) return;
  const p = point(w.unit(r.sourceId) ?? r.origin);
  r.activationStop = { tick: w.tick, point: p, reason, audience: audience(w, p, r.team) };
}
export function beginFoxFireAudio(w: FoxFireAudioWorld, cast: FoxFireCast, source: Unit) {
  w.ahriFoxFireAudio?.push({
    id: cast.id,
    sourceId: cast.sourceId,
    team: cast.team,
    startTick: cast.startTick,
    facing: cast.facing,
    origin: point(source),
    audience: audience(w, source, cast.team),
    activationStop: null,
    fires: cast.fires.map((f) => ({ index: f.index, launch: null, end: null })),
  });
}
export function launchFoxFireAudio(w: FoxFireAudioWorld, cast: FoxFireCast, fire: FoxFire) {
  const r = record(w, cast);
  if (!r) return;
  r.fires[fire.index].launch = {
    tick: w.tick,
    targetId: fire.targetId!,
    sourcePoint: point(w.unit(cast.sourceId)!),
    origin: point(fire.position),
    currentPoint: point(fire.position),
    audience: audience(w, fire.position, cast.team),
  };
  if (!cast.fires.some((f) => f.phase === 'orbit')) stopActivation(w, r, 'released');
}
export function finishFoxFireAudio(w: FoxFireAudioWorld, cast: FoxFireCast, fire: FoxFire) {
  const r = record(w, cast);
  if (!r) return;
  const f = r.fires[fire.index],
    p = point(fire.position);
  if (f.end) return;
  if (f.launch) f.launch.currentPoint = p;
  f.end = { tick: w.tick, point: p, reason: fire.stopReason!, audience: audience(w, p, cast.team) };
  if (!cast.fires.some((f) => f.phase === 'orbit'))
    stopActivation(
      w,
      r,
      fire.stopReason === 'death' ? 'death' : fire.stopReason === 'expired' ? 'expired' : 'released'
    );
}
/** Terminal settlement observes existing endpoints before gameplay clears them. */
export function finishAllFoxFireAudio(w: World) {
  for (const r of w.ahriFoxFireAudio) {
    stopActivation(w, r, 'match-end');
    const cast = w.ahriFoxFires.find((c) => c.id === r.id);
    for (const f of r.fires) {
      if (f.end) continue;
      const p = point(cast?.fires[f.index].position ?? f.launch?.currentPoint ?? r.origin);
      if (f.launch) f.launch.currentPoint = p;
      f.end = { tick: w.tick, point: p, reason: 'match-end', audience: audience(w, p, r.team) };
    }
  }
}
export function foxFireAudioExpiry(r: AhriFoxFireAudioRecord) {
  if (!r.activationStop || r.fires.some((f) => !f.end)) return Infinity;
  let expiry = Math.max(
    r.startTick + T.cast,
    r.startTick + AHRI_W_POLICY.movementTicks,
    r.activationStop.tick + T.activationStop,
    r.activationStop.tick + T.tail
  );
  for (const f of r.fires) {
    if (f.launch)
      expiry = Math.max(expiry, Math.min(f.launch.tick + T.launch, f.end!.tick + T.launchStop));
    if (f.end!.reason === 'hit') expiry = Math.max(expiry, f.end!.tick + T.hit);
  }
  return expiry;
}
/** Source dispatch observation only; does not allocate identities or draw RNG. */
export function advanceFoxFireAudio(w: World) {
  if (!w.ahriFoxFireAudio.length) return;
  for (const r of w.ahriFoxFireAudio) {
    const cast = w.ahriFoxFires.find((c) => c.id === r.id);
    if (cast)
      for (const f of r.fires)
        if (f.launch && !f.end) f.launch.currentPoint = point(cast.fires[f.index].position);
    if (r.startTick === w.tick) r.audience = audience(w, r.origin, r.team);
    if (r.activationStop?.tick === w.tick)
      r.activationStop.audience = audience(w, r.activationStop.point, r.team);
    for (const f of r.fires) {
      if (f.launch?.tick === w.tick) f.launch.audience = audience(w, f.launch.origin, r.team);
      if (f.end?.tick === w.tick) f.end.audience = audience(w, f.end.point, r.team);
    }
  }
  w.ahriFoxFireAudio = w.ahriFoxFireAudio.filter((r) => w.tick < foxFireAudioExpiry(r));
}
