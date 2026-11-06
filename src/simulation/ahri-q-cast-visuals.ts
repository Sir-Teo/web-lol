import { AHRI_Q_CAST_TIMING as T } from '../content/ahri-q-cast-timing';
import type { Vec2 } from './math';
import type { Team, Unit } from './types';
import type { World } from './world';
export interface AhriQCastVisual {
  sourceId: number;
  team: Team;
  castTick: number;
  origin: Vec2;
  aim: Vec2;
  birth: { tick: number; audience: Team[] } | null;
}
export function beginAhriQCastVisual(w: World, u: Unit, aim: Vec2) {
  if (u.champion !== 'ahri') return;
  w.ahriQCastVisuals.push({
    sourceId: u.id,
    team: u.team as Team,
    castTick: w.tick,
    origin: { x: u.x, y: u.y },
    aim: { x: aim.x, y: aim.y },
    birth: null,
  });
}
/** A cancelled animation cannot dispatch a future event; born particles retain
 * their independent finite life. No simulation ID or RNG is allocated. */
export function cancelUnbornAhriQCastVisual(w: World, sourceId?: number) {
  w.ahriQCastVisuals = w.ahriQCastVisuals.filter(
    (r) => r.birth !== null || (sourceId !== undefined && r.sourceId !== sourceId)
  );
}
export function advanceAhriQCastVisuals(w: World) {
  w.ahriQCastVisuals = w.ahriQCastVisuals.filter((r) => {
    if (w.tick >= r.castTick + T.historyTicks) return false;
    if (r.birth) return true;
    const u = w.unit(r.sourceId),
      pending = w.championState(r.sourceId)?.pendingCast;
    if (
      w.winner ||
      !u ||
      !w.alive(u) ||
      pending?.ability !== 'q' ||
      pending.startTick !== r.castTick
    )
      return false;
    if (w.tick >= r.castTick + T.delayTicks)
      r.birth = {
        tick: r.castTick + T.delayTicks,
        audience: (['blue', 'red'] as Team[]).filter((t) => t === r.team || w.pointVisible(u, t)),
      };
    return true;
  });
}
