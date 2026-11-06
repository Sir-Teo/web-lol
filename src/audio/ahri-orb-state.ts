import {
  AHRI_ORB_AUDIO_PROFILES as P,
  AHRI_ORB_AUDIO_STOPS as STOP,
  orbHitAudioKind,
  type OrbAudioKind,
} from '../content/ahri-orb-audio-policy';
import type { AhriOrbAudioRecord } from '../simulation/ahri-orb-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';

export interface OrbAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
  casterPoint(id: number): Vec2 | undefined;
}
export interface OrbAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: OrbAudioKind;
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
}
const kinds = Object.keys(P) as OrbAudioKind[];
/** Stateless cosmetic draws; this does not consume the simulation PRNG or
 * reproduce native global shuffle/sequence scope. */
function draw(r: AhriOrbAudioRecord, kind: OrbAudioKind, ordinal: number, purpose: number) {
  let n =
    Math.imul(r.sourceId, 0x85ebca6b) ^
    Math.imul(r.castTick, 0x9e3779b9) ^
    Math.imul(kinds.indexOf(kind) + 1, 0xc2b2ae35) ^
    Math.imul(ordinal + 1, 0x27d4eb2d) ^
    Math.imul(purpose + 1, 0x165667b1);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
export function orbAudioStates(
  records: readonly AhriOrbAudioRecord[],
  tick: number,
  scene: OrbAudioScene
) {
  const states: OrbAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: OrbAudioKind,
      phase: string,
      birth: number,
      audience: readonly Team[],
      point: Vec2,
      ordinal = 0,
      stopTick: number | null = null
    ) => {
      if (!audience.includes(scene.team) || (r.team !== scene.team && !scene.visible(point)))
        return;
      const profile = P[kind],
        variant = Math.floor(draw(r, kind, ordinal, 0) * profile.variants.length),
        clip = profile.variants[variant];
      const pitchCents =
        clip.pitchCents +
        clip.pitchRangeCents[0] +
        draw(r, kind, ordinal, 1) * (clip.pitchRangeCents[1] - clip.pitchRangeCents[0]);
      const rate = 2 ** (pitchCents / 1200),
        age = (tick - birth) / 60;
      const stopAge = stopTick === null ? null : (stopTick - birth) / 60;
      const stop = kind === 'outward' ? STOP.outward : STOP.return;
      const endAge = Math.min(
        clip.durationSeconds / rate,
        stopAge === null ? Infinity : stopAge + stop.seconds
      );
      if (age < 0 || age >= endAge) return;
      const ownerKey = `${r.sourceId}:${r.castTick}`;
      states.push({
        key: `${ownerKey}:${phase}`,
        ownerKey,
        birthTick: birth,
        kind,
        variant,
        rate,
        pitchCents,
        age,
        offset: age * rate,
        endAge,
        stopAge,
        stopFadeSeconds: stopAge === null ? 0 : stop.seconds,
        stopCurve: stop.curve,
        fadeInSeconds: 0,
        x: point.x,
        y: point.y,
      });
    };
    emit('cast', 'cast', r.castTick, r.castAudience, scene.casterPoint(r.sourceId) ?? r.origin);
    if (r.launch)
      emit(
        'outward',
        'outward',
        r.launch.tick,
        r.launch.audience,
        r.launch.currentPoint,
        0,
        r.turn?.tick ?? r.end?.tick ?? null
      );
    if (r.turn)
      emit(
        'return',
        'return',
        r.turn.tick,
        r.turn.audience,
        r.turn.currentPoint,
        0,
        r.end?.tick ?? null
      );
    const ordinals = { outward: 0, return: 0 };
    for (const h of r.hits) {
      const ordinal = ordinals[h.leg]++;
      emit(
        orbHitAudioKind(h.leg, ordinal),
        `hit:${h.leg}:${ordinal}`,
        h.tick,
        h.audience,
        h.point,
        ordinal
      );
    }
    if (r.end?.reason === 'caught')
      emit('deactivate', 'deactivate', r.end.tick, r.end.audience, r.end.point);
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
