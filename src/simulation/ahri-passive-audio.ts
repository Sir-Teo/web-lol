import { AHRI_PASSIVE_AUDIO_TICKS as T } from '../content/ahri-passive-audio-timing';
import type { AhriEssence } from './ahri-essences';
import type { Vec2 } from './math';
import type { Team } from './types';

export interface AhriPassiveAudioRecord {
  id: number;
  sourceId: number;
  team: Team;
  victimId: number;
  kind: AhriEssence['kind'];
  startTick: number;
  origin: Vec2;
  currentPoint: Vec2;
  audience: Team[];
  end: {
    tick: number;
    point: Vec2;
    reason: 'consumed' | 'death' | 'expired' | 'match-end';
    audience: Team[];
  } | null;
}
export interface PassiveAudioWorld {
  tick: number;
  ahriPassiveAudio?: AhriPassiveAudioRecord[];
  pointVisible?(point: Vec2, team: Team): boolean;
}
const point = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const audience = (w: PassiveAudioWorld, p: Vec2, team: Team): Team[] =>
  (['blue', 'red'] as Team[]).filter((t) => t === team || w.pointVisible?.(p, t));
/** Local dispatch: both homing kinds launch; only consumed Essences play arrival
 * cues. Champion arrival uses hit + orb buff, minion arrival its separate heal.
 * Native script dispatch is unverified. No simulation IDs or RNG are allocated. */
export function beginPassiveAudio(w: PassiveAudioWorld, e: AhriEssence) {
  w.ahriPassiveAudio?.push({
    id: e.id,
    sourceId: e.sourceId,
    team: e.team,
    victimId: e.victimId,
    kind: e.kind,
    startTick: e.startTick,
    origin: point(e.origin),
    currentPoint: point(e.position),
    audience: audience(w, e.origin, e.team),
    end: null,
  });
}
export function finishPassiveAudio(
  w: PassiveAudioWorld,
  e: AhriEssence,
  reason: NonNullable<AhriPassiveAudioRecord['end']>['reason']
) {
  const r = w.ahriPassiveAudio?.find((r) => r.id === e.id);
  if (!r || r.end) return;
  r.currentPoint = point(e.position);
  r.end = {
    tick: e.stopTick ?? w.tick,
    point: point(e.position),
    reason,
    audience: audience(w, e.position, e.team),
  };
}
export function passiveAudioExpiry(r: Pick<AhriPassiveAudioRecord, 'startTick' | 'kind' | 'end'>) {
  if (!r.end) return Infinity;
  return Math.max(
    r.startTick + T.launch,
    r.end.reason === 'consumed'
      ? r.end.tick + (r.kind === 'champion' ? Math.max(T.hit, T.orbBuffActivate) : T.minionHeal)
      : 0
  );
}
export function advancePassiveAudio(
  w: PassiveAudioWorld & { ahriPassiveAudio: AhriPassiveAudioRecord[]; ahriEssences: AhriEssence[] }
) {
  for (const r of w.ahriPassiveAudio) {
    const e = w.ahriEssences.find((e) => e.id === r.id);
    if (e && !r.end) {
      r.currentPoint = point(e.position);
      if (e.stopReason) finishPassiveAudio(w, e, e.stopReason);
    }
    if (r.startTick === w.tick) r.audience = audience(w, r.origin, r.team);
    if (r.end?.tick === w.tick) r.end.audience = audience(w, r.end.point, r.team);
  }
  w.ahriPassiveAudio = w.ahriPassiveAudio.filter((r) => w.tick < passiveAudioExpiry(r));
}
