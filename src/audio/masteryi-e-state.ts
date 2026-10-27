import { luxHoopChance } from '../render/lux-hoop-particles';
import { MASTER_YI_E_AUDIO as P } from '../content/masteryi-e-audio';
import type { WujuStyleAudioRecord } from '../simulation/masteryi-wuju-style-audio';
export interface MasterYiEAudioRecord extends WujuStyleAudioRecord {
  id: number;
  x: number;
  y: number;
  castVisible: boolean;
  stopVisible: boolean;
}
export interface MasterYiEAudioState {
  key: string;
  profileIndex: number;
  id: number;
  eventTick: number;
  variant: number;
  age: number;
  offset: number;
  leadSeconds: number;
  playbackRate: number;
  x: number;
  y: number;
}
/** Indexed cosmetic choices consume no gameplay RNG. Finite cast/activation
 * follow the actor; only natural expiry emits the captured ending. Q/W buff
 * pauses never stretch or restart source recordings. Native shuffle remains separate. */
export function masterYiEStates(
  records: readonly MasterYiEAudioRecord[],
  tick: number
): MasterYiEAudioState[] {
  const states: MasterYiEAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, profile] of P.entries()) {
      const ending = profile.kind === 'deactivate';
      if (ending ? !r.stop || r.stop.reason !== 'expired' || !r.stopVisible : !r.castVisible)
        continue;
      const roll = luxHoopChance(
          r.id ^ Math.imul(r.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 229, 0x85ebca6b),
          1
        ),
        variant = Math.min(profile.variants.length - 1, Math.floor(roll * profile.variants.length)),
        age = (tick - (ending ? r.stop!.tick : r.startTick)) / 60;
      if (age < 0 || age >= profile.variants[variant].durationSeconds) continue;
      const point = ending ? r.stop!.point : r;
      states.push({
        key: `${r.id}:${r.startTick}:${profileIndex}`,
        profileIndex,
        id: r.id,
        eventTick: ending ? r.stop!.tick : r.startTick,
        variant,
        age,
        offset: age,
        leadSeconds: 0,
        playbackRate: 1,
        x: point.x,
        y: point.y,
      });
    }
  return states.sort(
    (a, b) => a.eventTick - b.eventTick || a.id - b.id || a.profileIndex - b.profileIndex
  );
}
