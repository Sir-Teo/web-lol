import { MASTER_YI_AA_AUDIO as P } from '../content/masteryi-aa-audio';
import type { MasterYiAttackAudio } from '../simulation/masteryi-aa-presentation';
export interface MasterYiAARecord extends MasterYiAttackAudio {
  id: number;
  x: number;
  y: number;
  castVisible: boolean;
  hitVisible: boolean;
}
export interface MasterYiAAState {
  key: string;
  profileIndex: number;
  variant: number;
  pitchCents: number;
  age: number;
  offset: number;
  leadSeconds: number;
  playbackRate: number;
  x: number;
  y: number;
}
/** Indexed local sampling honors source ranges without consuming combat RNG. */
export function masterYiAudioHash(id: number, start: number, salt: number): number {
  let n = Math.imul(id, 0x85ebca6b) ^ Math.imul(start, 0x9e3779b9) ^ Math.imul(salt, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return (n ^ (n >>> 15)) >>> 0;
}
export function masterYiAAStates(
  records: readonly MasterYiAARecord[],
  tick: number
): MasterYiAAState[] {
  const states: MasterYiAAState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, p] of P.entries()) {
      if (p.kind !== r.kind || tick < r.startTick) continue;
      const hit = p.phase === 'hit';
      if (hit ? !r.impact || !r.hitVisible || p.material !== r.impact.material : !r.castVisible)
        continue;
      const elapsed = (tick - (hit ? r.impact!.tick : r.startTick)) / 60;
      if (elapsed < 0) continue;
      const age = Math.max(0, elapsed - p.delaySeconds),
        leadSeconds = Math.max(0, p.delaySeconds - elapsed);
      const variant = masterYiAudioHash(r.id, r.startTick, profileIndex + 47) % p.variants.length;
      const pitchCents =
        p.pitchCents +
        p.pitchModifiers.reduce(
          (sum, range, i) =>
            sum +
            range.minimum +
            (range.maximum - range.minimum) *
              (masterYiAudioHash(r.id, r.startTick, range.nodeId ^ (i + 101)) / 0x100000000),
          0
        );
      const playbackRate = 2 ** (pitchCents / 1200),
        offset = age * playbackRate;
      if (offset >= p.variants[variant].durationSeconds) continue;
      const point = hit ? r.impact!.point : r;
      states.push({
        key: `${r.id}:${r.startTick}:${profileIndex}`,
        profileIndex,
        variant,
        pitchCents,
        age,
        offset,
        leadSeconds,
        playbackRate,
        x: point.x,
        y: point.y,
      });
    }
  return states;
}
