import { MASTER_YI_Q_AUDIO as P } from '../content/masteryi-q-audio';
import type { AlphaAudioRecord } from '../simulation/masteryi-q-audio';
import { luxHoopChance } from '../render/lux-hoop-particles';
export interface MasterYiQRecord extends AlphaAudioRecord {
  id: number;
  castVisible: boolean;
  contacts: (AlphaAudioRecord['contacts'][number] & { visible: boolean })[];
}
export interface MasterYiQState {
  key: string;
  root: string;
  id: number;
  startTick: number;
  markIndex: number;
  profileIndex: number;
  variant: number;
  age: number;
  offset: number;
  playbackRate: number;
  x: number;
  y: number;
}
/** Captured on-create points and indexed choices never consume World RNG.
 * Native callback, randomness and admission calibration remain unverified. */
export function masterYiQStates(
  records: readonly MasterYiQRecord[],
  tick: number
): MasterYiQState[] {
  const states: MasterYiQState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, p] of P.entries()) {
      const events =
        p.kind === 'cast'
          ? r.castVisible
            ? [{ tick: r.startTick, markIndex: -1, point: r.origin }]
            : []
          : r.contacts.filter((contact) => contact.visible);
      for (const event of events) {
        const seed =
          r.id ^
          Math.imul(r.startTick, 0x9e3779b9) ^
          Math.imul(event.markIndex + 2, 0x27d4eb2d) ^
          Math.imul(profileIndex + 179, 0x85ebca6b);
        const chance = luxHoopChance(seed, 1),
          pitchChance = luxHoopChance(seed ^ 0x165667b1, 1);
        const variant = Math.min(p.variants.length - 1, Math.floor(chance * p.variants.length));
        const pitch =
          p.pitchCents +
          p.pitchModifiers.reduce(
            (sum, m) => sum + m.minimum + (m.maximum - m.minimum) * pitchChance,
            0
          );
        // AudioParam.value uses float32. Seek with the rate actually applied
        // by WebAudio, rather than an unrounded double that slowly diverges.
        const playbackRate = Math.fround(2 ** (pitch / 1200)),
          age = (tick - event.tick) / 60,
          offset = age * playbackRate;
        if (age < p.delaySeconds || offset >= p.variants[variant].durationSeconds) continue;
        const root = `${r.id}:${r.startTick}`;
        states.push({
          key: `${root}:${event.markIndex}:${profileIndex}`,
          root,
          id: r.id,
          startTick: event.tick,
          markIndex: event.markIndex,
          profileIndex,
          variant,
          age,
          offset,
          playbackRate,
          x: event.point.x,
          y: event.point.y,
        });
      }
    }
  return states.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      a.id - b.id ||
      a.markIndex - b.markIndex ||
      a.profileIndex - b.profileIndex
  );
}
