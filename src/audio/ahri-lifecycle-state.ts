import {
  AHRI_LIFECYCLE_AUDIO_PROFILES as P,
  type LifecycleAudioKind,
} from '../content/ahri-lifecycle-audio-policy';
import type { AhriLifecycleAudioRecord } from '../simulation/ahri-lifecycle-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';
export interface LifecycleAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
  casterPoint(id: number): Vec2 | undefined;
}
export interface LifecycleAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: LifecycleAudioKind;
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
}
export function lifecycleAudioStates(
  records: readonly AhriLifecycleAudioRecord[],
  tick: number,
  scene: LifecycleAudioScene
) {
  const states: LifecycleAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: LifecycleAudioKind,
      birth: number,
      audience: readonly Team[],
      point: Vec2
    ) => {
      const profile = P[kind],
        age = (tick - birth) / 60;
      if (age < 0 || tick >= birth + profile.maximumTicks) return;
      const clip = profile.variants[0],
        pitchCents = clip.pitchCents,
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
        variant: 0,
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
    // A pending respawn retains history, never a looping or extended death voice.
    emit('death', r.startTick, r.audience, r.origin);
    if (r.respawn)
      emit(
        'respawn',
        r.respawn.tick,
        r.respawn.audience,
        scene.casterPoint(r.sourceId) ?? r.respawn.point
      );
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
