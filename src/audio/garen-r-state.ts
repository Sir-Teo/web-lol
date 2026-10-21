import { GAREN_R_AUDIO as P } from '../content/garen-r-audio';
import type { ChampionState } from '../simulation/types';

export type GarenRAudioKind = 'cast' | 'hit' | 'kill';
export interface GarenRAudioRecord extends NonNullable<ChampionState['garenRVisual']> {
  id: number;
  x: number;
  y: number;
  castVisible: boolean;
  impactVisible: boolean;
}
export interface GarenRAudioState {
  key: string;
  kind: GarenRAudioKind;
  variant: number;
  age: number;
  x: number;
  y: number;
}
/** Cosmetic indexed variants; source shuffle/global state is not reproduced. */
export function garenRVariant(id: number, startTick: number, kind: GarenRAudioKind) {
  const salt = { cast: 5, hit: 6, kill: 7 }[kind];
  let n =
    Math.imul(id, 0x85ebca6b) ^ Math.imul(startTick, 0x9e3779b9) ^ Math.imul(salt, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Local dispatch: accepted cast, valid recipient release, and an actually
 * lethal R result. No declared stop actions: these one-shots finish naturally.
 * A later target death or caster death never promotes a release into a kill. */
export function garenRAudioStates(records: readonly GarenRAudioRecord[], tick: number) {
  const states: GarenRAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const kind of ['cast', 'hit', 'kill'] as const) {
      if (
        kind === 'cast'
          ? !r.castVisible
          : !r.impactVisible ||
            r.releaseTick === null ||
            r.stopTick !== null ||
            (kind === 'kill' && !r.killed)
      )
        continue;
      const start = kind === 'cast' ? r.startTick : r.releaseTick!;
      const variant = garenRVariant(r.id, r.startTick, kind),
        age = (tick - start) / 60;
      if (age < 0 || age >= P[kind].variants[variant].durationSeconds) continue;
      const point = kind === 'cast' ? r : r.point;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant,
        age,
        x: point.x,
        y: point.y,
      });
    }
  return states;
}
