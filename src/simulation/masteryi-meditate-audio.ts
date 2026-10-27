import {
  MASTER_YI_W_CAST_AUDIO_TICKS,
  MASTER_YI_W_END_AUDIO_TICKS,
} from '../content/masteryi-w-audio-timing';
import { MEDITATE_TICKS } from './masteryi-meditate';
import type { ChampionState, Unit, Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';
export type MeditateAudioStop = 'complete' | 'order' | 'control' | 'mana' | 'death' | 'victory';
export interface MeditateAudioRecord {
  startTick: number;
  endTick: number;
  rank: number;
  origin: Vec2;
  castAudience: Team[];
  stop: { tick: number; reason: MeditateAudioStop; point: Vec2; audience: Team[] } | null;
}
export function meditateAudioExpiry(r: MeditateAudioRecord): number {
  return r.stop === null
    ? Infinity
    : Math.max(
        r.startTick + MASTER_YI_W_CAST_AUDIO_TICKS,
        r.stop.tick + MASTER_YI_W_END_AUDIO_TICKS
      );
}
export function beginMeditateAudio(world: World, unit: Unit): void {
  const owner = world.championState(unit.id)!,
    c = owner.meditate!;
  owner.meditateAudio.push({
    startTick: c.startTick,
    endTick: c.endTick,
    rank: c.rank,
    origin: { x: unit.x, y: unit.y },
    castAudience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    stop: null,
  });
}
/** Local ending at a living channel's actual completion/interruption. Death and
 * victory close history while preserving finite onset; they infer no ending cue.
 * Slot18's Stop remains a declaration; no unbound loop Play is synthesized. */
export function stopMeditateAudio(
  owner: ChampionState,
  world: World,
  unit: Unit,
  reason: MeditateAudioStop
): void {
  const c = owner.meditate;
  if (!c) return;
  const r = owner.meditateAudio.find((r) => r.startTick === c.startTick);
  if (!r || r.stop) return;
  r.stop = {
    tick: c.stopTick ?? world.tick,
    reason,
    point: { x: unit.x, y: unit.y },
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
  };
}
export function validateMeditateAudio(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; winner: Team | null }
): void {
  let before = -1;
  for (const r of owner.meditateAudio) {
    const c = owner.meditate,
      s = r.stop;
    if (
      unit.champion !== 'masteryi' ||
      r.startTick <= before ||
      r.startTick > world.tick ||
      r.endTick !== r.startTick + MEDITATE_TICKS ||
      r.rank > owner.spellRanks.w ||
      !r.castAudience.includes(unit.team as Team) ||
      world.tick >= meditateAudioExpiry(r)
    )
      throw Error('Saved match contains invalid Meditate audio history.');
    if (!s) {
      if (
        !c ||
        c.startTick !== r.startTick ||
        c.stopTick !== null ||
        unit.hp <= 0 ||
        world.winner !== null ||
        world.tick >= r.endTick
      )
        throw Error('Saved match contains unowned Meditate audio history.');
    } else if (
      s.tick < r.startTick ||
      s.tick > world.tick ||
      s.tick > r.endTick ||
      !s.audience.includes(unit.team as Team) ||
      (s.reason === 'complete' && s.tick !== r.endTick) ||
      (s.reason === 'death' && unit.deadAt !== s.tick) ||
      (s.reason === 'victory' && (world.winner === null || world.tick !== s.tick))
    )
      throw Error('Saved match contains invalid Meditate audio stop.');
    if (
      c?.startTick === r.startTick &&
      (c.rank !== r.rank ||
        c.endTick !== r.endTick ||
        c.stopTick !== (s?.tick ?? null) ||
        c.stopReason !== (s?.reason ?? null))
    )
      throw Error('Saved match contains inconsistent Meditate audio/channel clocks.');
    before = r.startTick;
  }
  if (owner.meditate && !owner.meditateAudio.some((r) => r.startTick === owner.meditate!.startTick))
    throw Error('Saved match lacks its Meditate audio history.');
  for (const visual of owner.meditateBuffVisuals) {
    const r = owner.meditateAudio.find((r) => r.startTick === visual.startTick);
    if (
      !r ||
      r.rank !== visual.rank ||
      JSON.stringify(r.castAudience) !== JSON.stringify(visual.audience) ||
      r.endTick !== visual.endTick ||
      (r.stop?.tick ?? null) !== visual.stopTick ||
      (r.stop?.reason ?? null) !== visual.stopReason
    )
      throw Error('Saved match contains inconsistent Meditate buff/audio history.');
  }
}
