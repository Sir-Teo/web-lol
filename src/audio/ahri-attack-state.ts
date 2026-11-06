import {
  AHRI_ATTACK_AUDIO_PROFILES as P,
  AHRI_ATTACK_AUDIO_LAUNCH_STOP as STOP,
  type AttackAudioKind,
} from '../content/ahri-attack-audio-policy';
import type { AhriAttackAudioRecord } from '../simulation/ahri-attack-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';
export interface AttackAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
  casterPoint(id: number): Vec2 | undefined;
}
export interface AttackAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: AttackAudioKind;
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
}
const kinds = Object.keys(P) as AttackAudioKind[];
/** Per-swing cosmetic draws; native shared/global playlists remain unverified. */
function draw(r: AhriAttackAudioRecord, kind: AttackAudioKind, purpose: number) {
  let n =
    Math.imul(r.sourceId, 0x9e3779b9) ^
    Math.imul(r.startTick, 0xc2b2ae35) ^
    Math.imul(kinds.indexOf(kind) + 1, 0x27d4eb2d) ^
    Math.imul(purpose + 1, 0x846ca68b);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
export function attackAudioStates(
  records: readonly AhriAttackAudioRecord[],
  tick: number,
  scene: AttackAudioScene
) {
  const states: AttackAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: AttackAudioKind,
      birth: number,
      audience: readonly Team[],
      point: Vec2,
      stopTick: number | null = null
    ) => {
      const profile = P[kind],
        age = (tick - birth) / 60;
      if (age < 0 || tick >= birth + profile.maximumTicks) return;
      if (stopTick !== null && tick >= stopTick + STOP.seconds * 60) return;
      const variant = Math.floor(draw(r, kind, 0) * profile.variants.length),
        clip = profile.variants[variant];
      const pitchCents =
        clip.pitchCents +
        clip.pitchRangeCents[0] +
        draw(r, kind, 1) * (clip.pitchRangeCents[1] - clip.pitchRangeCents[0]);
      const rate = 2 ** (pitchCents / 1200),
        stopAge = stopTick === null ? null : (stopTick - birth) / 60;
      const endAge = Math.min(
        clip.durationSeconds / rate,
        stopAge === null ? Infinity : stopAge + STOP.seconds
      );
      if (
        age >= endAge ||
        !audience.includes(scene.team) ||
        (r.team !== scene.team && !scene.visible(point))
      )
        return;
      const ownerKey = `${r.sourceId}:${r.startTick}`;
      states.push({
        key: `${ownerKey}:${kind}`,
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
        stopFadeSeconds: stopAge === null ? 0 : STOP.seconds,
        stopCurve: STOP.curve,
        fadeInSeconds: 0,
        x: point.x,
        y: point.y,
      });
    };
    // No source cast Stop exists: cancelled windups retain their finite master.
    emit('cast', r.startTick, r.audience, scene.casterPoint(r.sourceId) ?? r.origin);
    if (r.launch) {
      emit(
        'launch',
        r.launch.tick,
        r.launch.audience,
        r.launch.currentPoint,
        r.launch.end?.tick ?? null
      );
      if (r.launch.end?.reason === 'hit')
        emit('hit', r.launch.end.tick, r.launch.end.audience, r.launch.end.point);
    }
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
