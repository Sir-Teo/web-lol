import { AHRI_LIFECYCLE_AUDIO_TICKS as T } from '../content/ahri-lifecycle-audio-timing';
import type { Vec2 } from './math';
import type { Team, Unit, SimEvent } from './types';
import type { World } from './world';
export interface AhriLifecycleAudioRecord {
  /** Existing transient death feedback ID; never allocates a simulation identity. */
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  levelAtDeath: number;
  respawnTick: number;
  origin: Vec2;
  audience: Team[];
  respawn: { tick: number; point: Vec2; audience: Team[] } | null;
  terminalTick: number | null;
}
const xy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
export function beginAhriLifecycleAudio(w: World, u: Unit, level: number, event: SimEvent) {
  if (u.champion !== 'ahri') return;
  w.ahriLifecycleAudio.push({
    id: event.id,
    sourceId: u.id,
    team: u.team as Team,
    startTick: w.tick,
    levelAtDeath: level,
    respawnTick: u.respawnTick!,
    origin: xy(u),
    audience: [...event.audience],
    respawn: null,
    terminalTick: null,
  });
}
export function syncAhriLifecycleDeathOrigin(w: World, u: Unit) {
  if (u.champion !== 'ahri') return;
  for (let i = w.ahriLifecycleAudio.length - 1; i >= 0; i--) {
    const entry = w.ahriLifecycleAudio[i];
    if (entry.sourceId === u.id && entry.startTick === w.tick && !entry.respawn) {
      entry.origin = xy(u);
      return;
    }
  }
}
export function respawnAhriLifecycleAudio(w: World, u: Unit, deathTick: number | null) {
  if (u.champion !== 'ahri') return;
  const r = w.ahriLifecycleAudio.find(
    (r) => r.sourceId === u.id && r.startTick === deathTick && !r.respawn && r.terminalTick === null
  );
  if (!r) throw Error('Missing pending Ahri lifecycle death');
  r.respawn = {
    tick: w.tick,
    point: xy(u),
    audience: (['blue', 'red'] as Team[]).filter((t) => t === r.team || w.pointVisible(u, t)),
  };
}
export function finishAllAhriLifecycleAudio(w: World) {
  for (const r of w.ahriLifecycleAudio)
    if (!r.respawn && r.terminalTick === null) r.terminalTick = w.tick;
}
export function ahriLifecycleAudioExpiry(r: AhriLifecycleAudioRecord) {
  // Silent death history retains the actual scheduled return; the death master
  // itself stays finite and never loops while this record waits for respawn.
  if (!r.respawn && r.terminalTick === null) return Infinity;
  return Math.max(r.startTick + T.death, r.respawn ? r.respawn.tick + T.respawn : 0);
}
export function advanceAhriLifecycleAudio(w: World) {
  w.ahriLifecycleAudio = w.ahriLifecycleAudio.filter((r) => w.tick < ahriLifecycleAudioExpiry(r));
}
