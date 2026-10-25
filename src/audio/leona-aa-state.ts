import { LEONA_AA_AUDIO as P } from '../content/leona-aa-audio';
import type { LeonaAttackVisual } from '../simulation/leona-aa-visuals';
import type { Team } from '../simulation/types';
import type { SourceAudioState } from './finite-source-audio';
export const LEONA_AA_AUDIO_KINDS = [
  'normalCast',
  'criticalCast',
  'criticalHit',
  'hitFlesh',
  'hitMetal',
  'hitStone',
  'hitWood',
] as const;
export type LeonaAAAudioKind = (typeof LEONA_AA_AUDIO_KINDS)[number];
export interface LeonaAAAudioRecord extends LeonaAttackVisual {
  id: number;
}
const role = (container: (typeof P.containers)[number], gainDb: number) => ({
  gainDb,
  policy: container.policy,
  variants: container.variants,
});
/** Alias casts share one local cap; identical media does not merge normal/crit caps.
 * Attack3 has zero source weight and is absent from the current local selection;
 * its LPF20 container remains prepared data, without invented DSP or invocation. */
export const LEONA_AA_AUDIO_PROFILE = {
  normalCast: role(P.containers[0], P.containers[0].authoredProperties.values.MakeUpGain),
  criticalCast: role(P.containers[1], P.containers[1].authoredProperties.values.MakeUpGain),
  criticalHit: role(P.containers[2], P.containers[2].authoredProperties.values.MakeUpGain),
  hitFlesh: role(P.containers[3], P.hitSwitch.authoredProperties.values.MakeUpGain),
  hitMetal: role(P.containers[4], P.hitSwitch.authoredProperties.values.MakeUpGain),
  hitStone: role(P.containers[5], P.hitSwitch.authoredProperties.values.MakeUpGain),
  hitWood: role(P.containers[6], P.hitSwitch.authoredProperties.values.MakeUpGain),
  attenuation: P.attenuation,
} as const;
function randomWord(id: number, start: number, kind: LeonaAAAudioKind, salt: number) {
  let n =
    Math.imul(id, 0x85ebca6b) ^
    Math.imul(start, 0x9e3779b9) ^
    Math.imul(LEONA_AA_AUDIO_KINDS.indexOf(kind) + salt, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return (n ^ (n >>> 15)) >>> 0;
}
/** Indexed cosmetic choices, independent of gameplay RNG/native shuffle state. */
export function leonaAAVariant(id: number, start: number, kind: LeonaAAAudioKind) {
  return randomWord(id, start, kind, 113) % LEONA_AA_AUDIO_PROFILE[kind].variants.length;
}
export function leonaAAPitchCents(id: number, start: number, kind: LeonaAAAudioKind) {
  if (!kind.startsWith('hit')) return 0;
  const range = P.hitSwitch.authoredProperties.ranges.Pitch;
  return range.min + (range.max - range.min) * (randomWord(id, start, kind, 127) / 0xffffffff);
}
/** Audio needs only the bounded saved position, independent of attachment pose. */
function pointAt(frames: readonly { tick: number; x: number; y: number }[], tick: number) {
  if (!frames.length) return null;
  const at = Math.max(frames[0].tick, Math.min(frames.at(-1)!.tick, tick)),
    i = Math.floor(at) - frames[0].tick,
    a = frames[i],
    b = frames[Math.min(i + 1, frames.length - 1)],
    alpha = at - a.tick;
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}
/** Local dispatch uses saved resolved slots: attack1→BasicAttack, attack2→2,
 * spell2_attack→4, crit→CritAttack. W→4 and native OnCast/OnHit callsites are not
 * established by declarations. Play delays are scheduled exactly in Web Audio;
 * fixed start/contact audiences prevent later reveal from exposing hidden cues. */
export function leonaAAAudioStates(
  records: readonly LeonaAAAudioRecord[],
  tick: number,
  team: Team = 'blue'
) {
  const states: SourceAudioState<LeonaAAAudioKind>[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    if (tick < r.startTick) continue;
    const emit = (
      kind: LeonaAAAudioKind,
      start: number,
      point: { x: number; y: number },
      audience: readonly Team[]
    ) => {
      if (!audience.includes(team)) return;
      const clip = LEONA_AA_AUDIO_PROFILE[kind].variants[leonaAAVariant(r.id, r.startTick, kind)],
        age = (tick - start) / 60,
        playbackRate = 2 ** (leonaAAPitchCents(r.id, r.startTick, kind) / 1200),
        remaining = clip.durationSeconds / playbackRate - age;
      if (remaining <= 0) return;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant: leonaAAVariant(r.id, r.startTick, kind),
        startTick: start,
        age,
        offset: Math.max(0, age * playbackRate),
        leadSeconds: Math.max(0, -age),
        playbackRate,
        remaining,
        envelope: 1,
        remainingIn: 0,
        fadeStartTick: null,
        stopAtTick: null,
        fadeIn: 1,
        fadeOutSeconds: 0,
        fadeOutAt: 0,
        fadeOutRemaining: 0,
        x: point.x,
        y: point.y,
      });
    };
    const alias =
      r.kind === 'crit'
        ? 'LeonaCritAttack'
        : r.kind === 'attack2'
          ? 'LeonaBasicAttack2'
          : r.kind === 'spell2_attack'
            ? 'LeonaBasicAttack4'
            : 'LeonaBasicAttack';
    const action = P.events.find((e) => e.name === `Play_sfx_Leona_${alias}_OnCast`)!;
    emit(
      r.critical ? 'criticalCast' : 'normalCast',
      r.startTick + action.delaySeconds * 60,
      pointAt(r.frames, tick) ?? r.frames[0],
      r.castAudience
    );
    if (r.impact && tick >= r.impact.tick) {
      const materialKind = {
        Flesh: 'hitFlesh',
        Metal: 'hitMetal',
        Stone: 'hitStone',
        Wood: 'hitWood',
      } as const;
      emit(
        r.critical ? 'criticalHit' : materialKind[r.impact.material],
        r.impact.tick,
        pointAt(r.impact.frames, tick) ?? r.impact.point,
        r.impact.audience
      );
    }
  }
  return states.sort((a, b) => a.startTick - b.startTick || a.key.localeCompare(b.key));
}
