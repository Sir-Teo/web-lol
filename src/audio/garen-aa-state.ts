import { GAREN_AA_AUDIO as P } from '../content/garen-aa-audio';
import type { ChampionState } from '../simulation/types';
type Presentation = ChampionState['garenAAVisuals'][number];
type Swing = Pick<
  Presentation,
  | 'startTick'
  | 'releaseTick'
  | 'endTick'
  | 'kind'
  | 'targetId'
  | 'targetTeam'
  | 'targetRig'
  | 'origin'
  | 'castAudience'
  | 'cancelTick'
> & {
  impact: Pick<
    NonNullable<Presentation['impact']>,
    'tick' | 'point' | 'material' | 'audience'
  > | null;
};
export interface GarenAAAudioRecord extends Swing {
  id: number;
  x: number;
  y: number;
  castVisible: boolean;
  hitVisible: boolean;
}
export interface GarenAAAudioState {
  key: string;
  profileIndex: number;
  variant: number;
  age: number;
  offset: number;
  x: number;
  y: number;
}
/** Indexed cosmetic selection only. Native container shuffle/voice state is not
 * reproduced; phase/material/action identity stays stable through saves. */
export function garenAAVariant(id: number, start: number, profile: number) {
  let n =
    Math.imul(id, 0x85ebca6b) ^ Math.imul(start, 0x9e3779b9) ^ Math.imul(profile + 47, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[profile].variants.length;
}
export function garenAAAudioStates(records: readonly GarenAAAudioRecord[], tick: number) {
  const states: GarenAAAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, p] of P.entries()) {
      if (p.kind !== r.kind) continue;
      const hit = p.phase === 'hit';
      if (
        hit
          ? !r.impact || !r.hitVisible || (p.material !== null && p.material !== r.impact.material)
          : !r.castVisible
      )
        continue;
      const age = (tick - (hit ? r.impact!.tick : r.startTick)) / 60,
        variant = garenAAVariant(r.id, r.startTick, profileIndex),
        clip = p.variants[variant],
        rate = 2 ** (p.pitchCents / 1200),
        offset = age * rate;
      if (age < 0 || offset >= clip.durationSeconds) continue;
      const at = hit ? r.impact!.point : r;
      states.push({
        key: `${r.id}:${r.startTick}:${profileIndex}`,
        profileIndex,
        variant,
        age,
        offset,
        x: at.x,
        y: at.y,
      });
    }
  return states;
}
