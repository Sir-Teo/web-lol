import {
  AHRI_FOX_FIRE_AUDIO_PROFILES as P,
  AHRI_FOX_FIRE_AUDIO_STOPS as STOP,
  type FoxFireAudioKind,
} from '../content/ahri-fox-fire-audio-policy';
import type { AhriFoxFireAudioRecord } from '../simulation/ahri-fox-fire-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';

export interface FoxFireAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
  casterPoint(id: number): Vec2 | undefined;
}
export interface FoxFireAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: FoxFireAudioKind;
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
  loop: boolean;
}
const kinds = Object.keys(P) as FoxFireAudioKind[];
/** Stateless local cosmetic draws, independent of World RNG and native shuffle. */
function draw(r: AhriFoxFireAudioRecord, kind: FoxFireAudioKind, index: number, purpose: number) {
  let n =
    Math.imul(r.id, 0x85ebca6b) ^
    Math.imul(r.sourceId, 0x9e3779b9) ^
    Math.imul(r.startTick, 0xc2b2ae35) ^
    Math.imul(kinds.indexOf(kind) + 1, 0x27d4eb2d) ^
    Math.imul(index + 1, 0x165667b1) ^
    Math.imul(purpose + 1, 0x7feb352d);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
export function foxFireAudioStates(
  records: readonly AhriFoxFireAudioRecord[],
  tick: number,
  scene: FoxFireAudioScene
) {
  const states: FoxFireAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: FoxFireAudioKind,
      phase: string,
      birth: number,
      audience: readonly Team[],
      point: Vec2,
      index = 0,
      stopTick: number | null = null
    ) => {
      if (!audience.includes(scene.team) || (r.team !== scene.team && !scene.visible(point)))
        return;
      const profile = P[kind],
        variant = Math.floor(draw(r, kind, index, 0) * profile.variants.length),
        clip = profile.variants[variant];
      const pitchCents =
        clip.pitchCents +
        clip.pitchRangeCents[0] +
        draw(r, kind, index, 1) * (clip.pitchRangeCents[1] - clip.pitchRangeCents[0]);
      const rate = 2 ** (pitchCents / 1200),
        age = (tick - birth) / 60;
      const stopAge = stopTick === null ? null : (stopTick - birth) / 60;
      const stop = kind === 'activation' ? STOP.activation : STOP.launch;
      const endAge = Math.min(
        profile.continuous ? Infinity : clip.durationSeconds / rate,
        stopAge === null ? Infinity : stopAge + stop.seconds
      );
      if (age < 0 || age >= endAge) return;
      states.push({
        key: `${r.id}:${phase}`,
        ownerKey: String(r.id),
        birthTick: birth,
        kind,
        variant,
        rate,
        pitchCents,
        age,
        offset: profile.continuous ? (age * rate) % clip.durationSeconds : age * rate,
        endAge,
        stopAge,
        stopFadeSeconds: stopAge === null ? 0 : stop.seconds,
        stopCurve: stop.curve,
        fadeInSeconds: 0,
        loop: profile.continuous,
        x: point.x,
        y: point.y,
      });
    };
    const caster = scene.casterPoint(r.sourceId) ?? r.origin;
    emit('cast', 'cast', r.startTick, r.audience, caster);
    emit(
      'activation',
      'activation',
      r.startTick,
      r.audience,
      r.activationStop?.point ?? caster,
      0,
      r.activationStop?.tick ?? null
    );
    if (r.activationStop)
      emit(
        'tail',
        'tail',
        r.activationStop.tick,
        r.activationStop.audience,
        r.activationStop.point
      );
    for (const f of r.fires) {
      if (f.launch)
        emit(
          'launch',
          `launch:${f.index}`,
          f.launch.tick,
          f.launch.audience,
          f.launch.currentPoint,
          f.index,
          f.end?.tick ?? null
        );
      // The separate native Stop-hit event has no assigned local clock.
      if (f.end?.reason === 'hit')
        emit('hit', `hit:${f.index}`, f.end.tick, f.end.audience, f.end.point, f.index);
    }
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
