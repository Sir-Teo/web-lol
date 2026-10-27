import { MASTER_YI_R_AUDIO as P } from '../content/masteryi-r-audio';
import type { HighlanderAudioRecord } from '../simulation/masteryi-highlander-audio';
export interface MasterYiRAudioRecord extends HighlanderAudioRecord {
  id: number;
  x: number;
  y: number;
  castVisible: boolean;
  stopVisible: boolean;
}
export interface MasterYiRAudioState {
  key: string;
  profileIndex: number;
  variant: number;
  age: number;
  offset: number;
  leadSeconds: number;
  playbackRate: number;
  x: number;
  y: number;
}
/** Finite onset follows its owner. Only natural expiry produces a captured end;
 * buff extensions/pauses never restart or stretch either source recording. */
export function masterYiRStates(
  records: readonly MasterYiRAudioRecord[],
  tick: number
): MasterYiRAudioState[] {
  const states: MasterYiRAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, profile] of P.entries()) {
      const ending = profile.kind === 'deactivate';
      if (ending ? r.stop?.reason !== 'expired' || !r.stopVisible : !r.castVisible) continue;
      const age = (tick - (ending ? r.stop!.tick : r.startTick)) / 60;
      if (age < 0 || age >= profile.variants[0].durationSeconds) continue;
      const point = ending ? r.stop!.point : r;
      states.push({
        key: `${r.id}:${r.startTick}:${profileIndex}`,
        profileIndex,
        variant: 0,
        age,
        offset: age,
        leadSeconds: 0,
        playbackRate: 1,
        x: point.x,
        y: point.y,
      });
    }
  return states;
}
