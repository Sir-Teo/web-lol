import { MASTER_YI_W_AUDIO as P } from '../content/masteryi-w-audio';
import type { MeditateAudioRecord } from '../simulation/masteryi-meditate-audio';
export interface MasterYiWAudioRecord extends MeditateAudioRecord {
  id: number;
  x: number;
  y: number;
  castVisible: boolean;
  stopVisible: boolean;
}
export interface MasterYiWAudioState {
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
/** Finite cast follows the actor; living channel stops use the captured end.
 * No unbound loop or foley is dispatched. Recordings keep their own source clock. */
export function masterYiWStates(
  records: readonly MasterYiWAudioRecord[],
  tick: number
): MasterYiWAudioState[] {
  const states: MasterYiWAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, profile] of P.entries()) {
      const ending = profile.kind === 'deactivate';
      if (
        ending
          ? !r.stop ||
            !['complete', 'order', 'control', 'mana'].includes(r.stop.reason) ||
            !r.stopVisible
          : !r.castVisible
      )
        continue;
      const age = (tick - (ending ? r.stop!.tick : r.startTick)) / 60;
      if (age < 0 || age >= profile.variants[0].durationSeconds) continue;
      const point = ending ? r.stop!.point : r;
      states.push({
        key: `${r.id}:${r.startTick}:${profileIndex}`,
        profileIndex,
        id: r.id,
        eventTick: ending ? r.stop!.tick : r.startTick,
        variant: 0,
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
