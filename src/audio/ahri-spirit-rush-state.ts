import {
  AHRI_SPIRIT_RUSH_AUDIO_PROFILES as P,
  AHRI_SPIRIT_RUSH_AUDIO_LAUNCH_STOP as STOP,
  AHRI_SPIRIT_RUSH_AUDIO_LOCAL_ACTIVATION_STOP as LOCAL,
  type SpiritRushAudioKind,
} from '../content/ahri-spirit-rush-audio-policy';
import type { AhriSpiritRushAudioRecord } from '../simulation/ahri-spirit-rush-audio';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import type { SourceEnvelope } from './source-envelope';
export interface SpiritRushAudioScene {
  team: Team;
  visible(point: Vec2): boolean;
  casterPoint(id: number): Vec2 | undefined;
}
export interface SpiritRushAudioState extends SourceEnvelope, Vec2 {
  key: string;
  ownerKey: string;
  birthTick: number;
  kind: SpiritRushAudioKind;
  variant: number;
  rate: number;
  pitchCents: number;
  offset: number;
  loop: boolean;
}
const kinds = Object.keys(P) as SpiritRushAudioKind[];
/** Cosmetic per-window/burst/bolt draws; no World RNG or native shuffle claim. */
function draw(
  r: AhriSpiritRushAudioRecord,
  kind: SpiritRushAudioKind,
  burst: number,
  bolt: number,
  purpose: number
) {
  let n =
    Math.imul(r.id, 0x85ebca6b) ^
    Math.imul(r.sourceId, 0x9e3779b9) ^
    Math.imul(r.startTick, 0xc2b2ae35) ^
    Math.imul(kinds.indexOf(kind) + 1, 0x27d4eb2d) ^
    Math.imul(burst + 2, 0x165667b1) ^
    Math.imul(bolt + 2, 0x7feb352d) ^
    Math.imul(purpose + 1, 0x846ca68b);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
export function spiritRushAudioStates(
  records: readonly AhriSpiritRushAudioRecord[],
  tick: number,
  scene: SpiritRushAudioScene
) {
  const states: SpiritRushAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: SpiritRushAudioKind,
      phase: string,
      birth: number,
      audience: readonly Team[],
      point: Vec2,
      burst = -1,
      bolt = -1,
      stopTick: number | null = null
    ) => {
      const profile = P[kind],
        age = (tick - birth) / 60;
      if (age < 0 || (profile.maximumTicks !== null && tick >= birth + profile.maximumTicks))
        return;
      const variant = Math.floor(draw(r, kind, burst, bolt, 0) * profile.variants.length),
        clip = profile.variants[variant];
      const pitchCents =
        clip.pitchCents +
        clip.pitchRangeCents[0] +
        draw(r, kind, burst, bolt, 1) * (clip.pitchRangeCents[1] - clip.pitchRangeCents[0]);
      const rate = 2 ** (pitchCents / 1200),
        stopAge = stopTick === null ? null : (stopTick - birth) / 60;
      const stop = kind === 'activation' ? LOCAL : STOP;
      const endAge = Math.min(
        profile.continuous ? Infinity : clip.durationSeconds / rate,
        stopAge === null ? Infinity : stopAge + stop.seconds
      );
      if (
        age >= endAge ||
        !audience.includes(scene.team) ||
        (r.team !== scene.team && !scene.visible(point))
      )
        return;
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
    emit(
      'activation',
      'activation',
      r.startTick,
      r.audience,
      r.end?.point ?? caster,
      -1,
      -1,
      r.end?.tick ?? null
    );
    if (r.end) emit('deactivate', 'deactivate', r.end.tick, r.end.audience, r.end.point);
    for (const b of r.bursts) {
      // Dash interruption does not invent a source Stop-cast event.
      emit('cast', `cast:${b.index}`, b.tick, b.audience, caster, b.index);
      for (const p of b.bolts) {
        emit(
          'launch',
          `launch:${b.index}:${p.index}`,
          b.tick,
          b.audience,
          p.currentPoint,
          b.index,
          p.index,
          p.end?.tick ?? null
        );
        if (p.end?.reason === 'hit')
          emit(
            'hit',
            `hit:${b.index}:${p.index}`,
            p.end.tick,
            p.end.audience,
            p.end.point,
            b.index,
            p.index
          );
      }
    }
  }
  return states.sort((a, b) => a.birthTick - b.birthTick);
}
