import {
  MASTER_YI_E_CAST_AUDIO_TICKS,
  MASTER_YI_E_ACTIVATE_AUDIO_TICKS,
  MASTER_YI_E_END_AUDIO_TICKS,
} from '../content/masteryi-e-audio-timing';
import { WUJU_STYLE_TICKS } from './masteryi-wuju-style';
import type { ChampionState, Unit, Team } from './types';
import type { Vec2 } from './math';
type Observation = { tick: number; visible(unit: Unit, team: Team): boolean };
export type WujuStyleAudioStop = 'expired' | 'death' | 'victory' | 'recast';
export interface WujuStyleAudioRecord {
  startTick: number;
  rank: number;
  origin: Vec2;
  castAudience: Team[];
  stop: {
    tick: number;
    reason: WujuStyleAudioStop;
    endTick: number;
    pausedTicks: number;
    point: Vec2;
    audience: Team[];
  } | null;
}
export function wujuStyleAudioExpiry(r: WujuStyleAudioRecord): number {
  return r.stop === null
    ? Infinity
    : Math.max(
        r.startTick + MASTER_YI_E_CAST_AUDIO_TICKS,
        r.startTick + MASTER_YI_E_ACTIVATE_AUDIO_TICKS,
        r.stop.tick + MASTER_YI_E_END_AUDIO_TICKS
      );
}
export function beginWujuStyleAudio(owner: ChampionState, unit: Unit, world: Observation): void {
  const buff = owner.wujuStyle!;
  owner.wujuStyleAudio.push({
    startTick: buff.startTick,
    rank: buff.rank,
    origin: { x: unit.x, y: unit.y },
    castAudience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    stop: null,
  });
}
/** Finite cast/activation never restart or stretch when Q/W pause the buff.
 * Only natural expiry creates its captured ending; other removals keep onset tails. */
export function stopWujuStyleAudio(
  owner: ChampionState,
  unit: Unit,
  world: Observation,
  reason: WujuStyleAudioStop
): void {
  const buff = owner.wujuStyle;
  if (!buff) return;
  const record = owner.wujuStyleAudio.find((r) => r.startTick === buff.startTick);
  if (!record || record.stop) return;
  record.stop = {
    tick: world.tick,
    reason,
    endTick: buff.endTick,
    pausedTicks: buff.pausedTicks,
    point: { x: unit.x, y: unit.y },
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
  };
}
export function validateWujuStyleAudio(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; winner: Team | null }
): void {
  let before = -1,
    active = 0;
  for (const r of owner.wujuStyleAudio) {
    const s = r.stop,
      buff = owner.wujuStyle;
    if (
      unit.champion !== 'masteryi' ||
      r.startTick <= before ||
      r.startTick > world.tick ||
      r.rank > owner.spellRanks.e ||
      !r.castAudience.includes(unit.team as Team) ||
      world.tick >= wujuStyleAudioExpiry(r)
    )
      throw Error('Saved match contains invalid Wuju Style audio history.');
    if (!s) {
      active++;
      if (
        !buff ||
        buff.startTick !== r.startTick ||
        buff.rank !== r.rank ||
        unit.hp <= 0 ||
        world.winner !== null
      )
        throw Error('Saved match contains unowned Wuju Style audio history.');
    } else if (
      s.tick < r.startTick ||
      s.tick > world.tick ||
      !s.audience.includes(unit.team as Team) ||
      s.pausedTicks > s.tick - r.startTick ||
      s.endTick !== r.startTick + WUJU_STYLE_TICKS + s.pausedTicks ||
      (s.reason === 'expired' ? s.tick !== s.endTick : s.tick >= s.endTick) ||
      (s.reason === 'death' && unit.deadAt !== s.tick) ||
      (s.reason === 'victory' && (world.winner === null || world.tick !== s.tick)) ||
      (s.reason === 'recast' &&
        !owner.wujuStyleAudio.some(
          (next) => next.startTick === s.tick && next.startTick > r.startTick
        ))
    )
      throw Error('Saved match contains invalid Wuju Style audio stop.');
    before = r.startTick;
  }
  if (active !== (owner.wujuStyle ? 1 : 0))
    throw Error('Saved match lacks its active Wuju Style audio history.');
}
