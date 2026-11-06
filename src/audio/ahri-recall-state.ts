import {
  AHRI_RECALL_AUDIO_PROFILE as P,
  AHRI_RECALL_LOCAL_RELEASE as RELEASE,
} from '../content/ahri-recall-audio-policy';
import type { AhriRecallAudioRecord } from '../simulation/ahri-recall-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';
export interface RecallAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
  casterPoint(id: number): Vec2 | undefined;
}
export interface RecallAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: 'recall';
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
}
export function recallAudioStates(
  records: readonly AhriRecallAudioRecord[],
  tick: number,
  scene: RecallAudioScene
) {
  const states: RecallAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const age = (tick - r.startTick) / 60,
      clip = P.variants[0],
      rate = 2 ** (clip.pitchCents / 1200);
    const interrupted = r.end && r.end.reason !== 'complete' ? r.end : null;
    const stopAge = interrupted ? (interrupted.tick - r.startTick) / 60 : null;
    const endAge = Math.min(
      clip.durationSeconds / rate,
      stopAge === null ? Infinity : stopAge + RELEASE.seconds
    );
    const point = interrupted?.point ?? scene.casterPoint(r.sourceId) ?? r.end?.point ?? r.origin;
    if (
      age < 0 ||
      age >= endAge ||
      (interrupted && tick >= interrupted.tick + RELEASE.seconds * 60) ||
      !r.audience.includes(scene.team) ||
      (r.team !== scene.team && !scene.visible(point))
    )
      continue;
    states.push({
      key: String(r.id),
      ownerKey: String(r.id),
      birthTick: r.startTick,
      kind: 'recall',
      variant: 0,
      rate,
      pitchCents: clip.pitchCents,
      age,
      offset: age * rate,
      endAge,
      stopAge,
      stopFadeSeconds: RELEASE.seconds,
      stopCurve: RELEASE.curve,
      fadeInSeconds: 0,
      x: point.x,
      y: point.y,
    });
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
