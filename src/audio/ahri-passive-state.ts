import {
  AHRI_PASSIVE_AUDIO_PROFILES as P,
  type PassiveAudioKind,
} from '../content/ahri-passive-audio-policy';
import type { AhriPassiveAudioRecord } from '../simulation/ahri-passive-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';
export interface PassiveAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
}
export interface PassiveAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: PassiveAudioKind;
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
}
const kinds = Object.keys(P) as PassiveAudioKind[];
/** Stable per-Essence cosmetic draws; no World RNG or native global shuffle claim. */
function draw(r: AhriPassiveAudioRecord, kind: PassiveAudioKind) {
  let n =
    Math.imul(r.id, 0x85ebca6b) ^
    Math.imul(r.sourceId, 0x9e3779b9) ^
    Math.imul(r.startTick, 0xc2b2ae35) ^
    Math.imul(kinds.indexOf(kind) + 1, 0x27d4eb2d);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
export function passiveAudioStates(
  records: readonly AhriPassiveAudioRecord[],
  tick: number,
  scene: PassiveAudioScene
) {
  const states: PassiveAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: PassiveAudioKind,
      birth: number,
      audience: readonly Team[],
      point: Vec2
    ) => {
      const profile = P[kind],
        age = (tick - birth) / 60;
      if (age < 0 || tick >= birth + profile.maximumTicks!) return;
      const variant = Math.floor(draw(r, kind) * profile.variants.length),
        clip = profile.variants[variant];
      // Source has no pitch declarations/modifiers in these four profiles.
      const pitchCents = clip.pitchCents,
        rate = 2 ** (pitchCents / 1200),
        endAge = clip.durationSeconds / rate;
      if (
        age >= endAge ||
        !audience.includes(scene.team) ||
        (r.team !== scene.team && !scene.visible(point))
      )
        return;
      states.push({
        key: `${r.id}:${kind}`,
        ownerKey: String(r.id),
        birthTick: birth,
        kind,
        variant,
        rate,
        pitchCents,
        age,
        offset: age * rate,
        endAge,
        stopAge: null,
        stopFadeSeconds: 0,
        stopCurve: 4,
        fadeInSeconds: 0,
        x: point.x,
        y: point.y,
      });
    };
    emit('launch', r.startTick, r.audience, r.currentPoint);
    if (r.end?.reason === 'consumed') {
      if (r.kind === 'champion') {
        emit('hit', r.end.tick, r.end.audience, r.end.point);
        emit('orbBuffActivate', r.end.tick, r.end.audience, r.end.point);
      } else emit('minionHeal', r.end.tick, r.end.audience, r.end.point);
    }
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
