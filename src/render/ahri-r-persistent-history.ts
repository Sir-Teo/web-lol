import type { AhriRVisualHistory } from '../simulation/ahri-r-visual-history';
import type { Team } from '../simulation/types';
import type { SurfaceGroup } from './source-particle-surfaces';

export interface RBuffVisualGroup extends SurfaceGroup {
  record: AhriRVisualHistory;
  system: 'Ahri_R_Eyes' | 'Ahri_R_Ready_tar';
  bone: 'L_Eye' | 'R_Eye' | 'C_Buffbone_Glb_Layout_Loc';
}
/** The skin's explicit HasBuff(AhriR) condition names these three instances.
 * Mapping the local observed R window is an adapter policy, not a native script
 * timing claim. Counter comparisons and unjoined systems are excluded. */
export function rBuffVisualGroups(record: AhriRVisualHistory): RBuffVisualGroup[] {
  const instances = [
    ['Ahri_R_Eyes', 'L_Eye'],
    ['Ahri_R_Eyes', 'R_Eye'],
    ['Ahri_R_Ready_tar', 'C_Buffbone_Glb_Layout_Loc'],
  ] as const;
  return instances.map(([system, bone], index) => ({
    key: `${record.id}:buff:${bone}`,
    record,
    system,
    bone,
    startTick: record.startTick,
    stopTick: Math.min(record.end?.tick ?? Infinity, record.sourceEnd?.tick ?? Infinity),
    radius: record.birthPose.radius,
    seed: record.id ^ Math.imul(record.startTick, 0x9e3779b9) ^ Math.imul(index + 1, 0x85ebca6b),
  }));
}
function sample(record: AhriRVisualHistory, tick: number) {
  if (!Number.isFinite(tick) || tick < record.startTick) return null;
  const ending = record.sourceEnd?.pose;
  if (ending && tick >= ending.tick) return { a: ending, b: ending, fraction: 0 };
  const frames = record.sourceFrames;
  if (!frames.length || tick < frames[0].tick) {
    // Birth is independently owned. Never bridge a discarded observation gap.
    return tick === record.birthPose.tick
      ? { a: record.birthPose, b: record.birthPose, fraction: 0 }
      : null;
  }
  let low = 0,
    high = frames.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (frames[middle].tick < tick) low = middle + 1;
    else high = middle;
  }
  const b = frames[low],
    a = frames[Math.max(0, low - 1)];
  if (tick >= b.tick) return { a: b, b, fraction: 0 };
  if (b.tick !== a.tick + 1) return null;
  return { a, b, fraction: (tick - a.tick) / (b.tick - a.tick) };
}
/** Owned caster poses keep following a live body after buff expiry; only death
 * or removal freezes that body. No live unit lookup can attach to its respawn. */
export function rBuffVisualPose(group: RBuffVisualGroup, tick: number) {
  const s = sample(group.record, tick);
  if (!s) return null;
  const { a, b, fraction } = s;
  const angle = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.point.x + (b.point.x - a.point.x) * fraction,
    y: a.point.y + (b.point.y - a.point.y) * fraction,
    facing: fraction === 0 ? a.facing : a.facing + angle * fraction,
    radius: a.radius + (b.radius - a.radius) * fraction,
    animationTimeline: a.animationTimeline,
  };
}
export function rBuffVisualKnown(group: RBuffVisualGroup, tick: number, team: Team) {
  const s = sample(group.record, tick);
  if (!s) return false;
  return s.a.audience.includes(team) && (s.fraction === 0 || s.b.audience.includes(team));
}
